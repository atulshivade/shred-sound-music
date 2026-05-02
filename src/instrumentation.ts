/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Used to bring up PGlite (auto-apply schema migrations) so that local dev
 * works with zero external services.
 */
export async function register() {
  // Skip during the edge runtime (proxy.ts) — we only want the Node server.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { dbKind } = await import("./db");
  if (dbKind !== "pglite") return;

  const { applyMigrations } = await import("./db/migrate");
  await applyMigrations();
  console.log("[db] PGlite ready (.data/pgdata) — migrations applied.");
}
