import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { db, dbKind } from "./index";

let didMigrate: Promise<void> | null = null;

/**
 * Idempotent: applies any pending Drizzle migrations from `./drizzle`.
 * Cached so concurrent callers share the same in-flight promise.
 */
export function applyMigrations(): Promise<void> {
  if (didMigrate) return didMigrate;
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  didMigrate = (async () => {
    if (dbKind === "pglite") {
      await migratePglite(
        db as unknown as Parameters<typeof migratePglite>[0],
        { migrationsFolder },
      );
    } else {
      await migratePostgres(
        db as unknown as Parameters<typeof migratePostgres>[0],
        { migrationsFolder },
      );
    }
  })();
  return didMigrate;
}
