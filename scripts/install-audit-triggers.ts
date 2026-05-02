/**
 * Install SQLite triggers that make AuditEvent append-only — prevents
 * UPDATE and DELETE on the table. Defense-in-depth for compliance:
 * even if a malicious actor with DB access tries to tamper with the
 * audit log, the trigger raises an error and rolls back.
 *
 * Run after every prisma db push: `npx tsx scripts/install-audit-triggers.ts`.
 * Idempotent — drops and recreates the triggers each time.
 *
 * On Postgres (future), the equivalent is RULE statements or row-
 * level security policies. The trigger names + intent stay the same.
 */

import "dotenv/config";
import path from "path";
import Database from "better-sqlite3";

function main() {
  const url = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
  const file = url.replace(/^file:/, "");
  const db = new Database(file);
  try {
    db.exec(`
      DROP TRIGGER IF EXISTS audit_event_no_update;
      DROP TRIGGER IF EXISTS audit_event_no_delete;
      CREATE TRIGGER audit_event_no_update
        BEFORE UPDATE ON "AuditEvent"
        BEGIN
          SELECT RAISE(ABORT, 'AuditEvent is append-only; UPDATE not permitted');
        END;
    `);
    // DELETE trigger only installed in strict mode. Without it, the
    // audit-prune cron can age out old rows. Strict mode (immutable)
    // keeps every row forever, even past retention SLA.
    if (process.env.BCON_AUDIT_IMMUTABLE === "true") {
      db.exec(`
        CREATE TRIGGER audit_event_no_delete
          BEFORE DELETE ON "AuditEvent"
          BEGIN
            SELECT RAISE(ABORT, 'AuditEvent is append-only; DELETE blocked by BCON_AUDIT_IMMUTABLE');
          END;
      `);
      console.log("audit triggers installed (immutable mode — UPDATE + DELETE blocked)");
    } else {
      console.log("audit triggers installed (UPDATE blocked; DELETE permitted for prune cron — set BCON_AUDIT_IMMUTABLE=true to lock)");
    }
  } finally {
    db.close();
  }
}

main();
