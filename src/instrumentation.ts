/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Used to bring up PGlite (auto-apply schema migrations) and, in dev,
 * to optionally bypass TLS verification when the workstation sits behind
 * a corporate proxy that re-signs HTTPS traffic with its own root CA.
 */
export async function register() {
  // Skip during the edge runtime (proxy.ts) — we only want the Node server.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // ── Optional: trust the local TLS chain even if it's a corp-proxy
  // self-signed cert. Without this, Node `fetch()` to api.cloudinary.com
  // (and any other outbound HTTPS) fails with SELF_SIGNED_CERT_IN_CHAIN
  // when the workstation is behind a re-signing MITM proxy. We refuse
  // the bypass in production so this is impossible to ship by accident.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_INSECURE_TLS === "true"
  ) {
    try {
      const { setGlobalDispatcher, Agent } = await import("undici");
      setGlobalDispatcher(
        new Agent({ connect: { rejectUnauthorized: false } }),
      );
      console.warn(
        "[tls] ⚠ ALLOW_INSECURE_TLS=true — outbound HTTPS verification is DISABLED for this dev process. Never enable in production.",
      );
    } catch (err) {
      console.warn("[tls] failed to install insecure dispatcher:", err);
    }
  }

  const { dbKind, db } = await import("./db");

  if (dbKind === "pglite") {
    const { applyMigrations } = await import("./db/migrate");
    await applyMigrations();
    console.log("[db] PGlite ready (.data/pgdata) — migrations applied.");
    return;
  }

  // On the production postgres path (Neon / Supabase / RDS / any
  // managed Postgres) auto-apply the idempotent schema bootstrap so
  // adding a new enum value or column on a deploy never requires the
  // operator to manually hit `/api/admin/dbinit?secret=…`.
  //
  // Every statement is individually idempotent, but issuing all of them
  // costs one network round trip each — seconds of cold-start latency on a
  // managed Postgres for work that is a no-op on all but the first boot of
  // a deploy. `ensureSchemaBootstrap` therefore checks a stored fingerprint
  // in a single round trip and only replays the statements when the schema
  // has actually changed.
  //
  // Opt out by setting `SCHEMA_AUTOHEAL=false` if you prefer to manage
  // migrations entirely out-of-band (e.g. via Drizzle Kit CI).
  if (process.env.SCHEMA_AUTOHEAL === "false") {
    console.log(
      "[db] SCHEMA_AUTOHEAL=false — skipping schema bootstrap on cold start.",
    );
    return;
  }
  try {
    const { ensureSchemaBootstrap } = await import("./db/schema-bootstrap");
    const startedAt = Date.now();
    const { applied, statements } = await ensureSchemaBootstrap(db);
    console.log(
      applied
        ? `[db] postgres schema bootstrap applied — ${statements} idempotent statements ran in ${Date.now() - startedAt}ms.`
        : `[db] postgres schema already at current fingerprint — verified in ${Date.now() - startedAt}ms.`,
    );
  } catch (err) {
    // Don't crash the server on a bootstrap failure — the dbinit route
    // remains the manual escape hatch. Just log loudly so it's obvious
    // in the hosting platform's runtime logs.
    console.error(
      "[db] postgres schema bootstrap FAILED — fall back to /api/admin/dbinit?secret=… to recover:",
      err,
    );
  }
}
