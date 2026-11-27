import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const migration = readFile(
  new URL("../supabase/migrations/20261127190000_jcstudio_and_connected_products.sql", import.meta.url),
  "utf8",
);
const serviceWorker = readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const desktopMain = readFile(new URL("../desktop/main.cjs", import.meta.url), "utf8");

describe("connected legal suite security boundaries", () => {
  it("enables row-level security for every JCStudio data table", async () => {
    const sql = (await migration).toLowerCase();
    for (const table of [
      "practice_matters", "practice_matter_members", "practice_matter_notes",
      "practice_tasks", "practice_events", "practice_time_entries",
      "practice_documents", "practice_invoices", "practice_invoice_items",
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("requires an accepted active mandate and current verified qualification for conversion", async () => {
    const sql = await migration;
    expect(sql).toContain("mandate_row.engagement_status <> 'active'");
    expect(sql).toContain("'lpc_registration','candidate_registration','admission'");
    expect(sql).toContain("verification_status = 'verified'");
    expect(sql).toContain("Africa/Johannesburg");
    expect(sql).toContain("target_source_mandate_id");
    expect(sql).toContain("target_responsible_user_id");
    expect(sql).toContain("list_qualified_firm_practitioners");
  });

  it("does not allow billing-only membership to read ordinary practice matter content", async () => {
    const sql = await migration;
    expect(sql).toContain("mm.permission in ('read','edit','manage')");
    expect(sql).toContain("private.can_bill_practice_matter");
    expect(sql).toContain("studio billing roles read invoices");
    expect(sql).toContain("studio members read internal notes");
  });

  it("records auditable metadata without serialising matter note content", async () => {
    const sql = await migration;
    expect(sql).toContain("private.audit_practice_change");
    expect(sql).toContain("'jcstudio.' || tg_table_name");
    expect(sql).toContain("jsonb_build_object('module','jcstudio','record_id',record_id)");
  });

  it("keeps authenticated pages out of the offline cache", async () => {
    const script = await serviceWorker;
    expect(script).toContain("request.mode !== \"navigate\"");
    expect(script).toContain("fetch(request).catch");
    expect(script).toContain("caches.match(OFFLINE_URL)");
    expect(script).not.toContain("cache.put");
    expect(script).not.toContain("caches.open(CACHE_NAME).then((cache) => cache.addAll");
  });

  it("hardens the desktop renderer and pins navigation to a configured HTTPS origin", async () => {
    const source = await desktopMain;
    expect(source).toContain("contextIsolation: true");
    expect(source).toContain("nodeIntegration: false");
    expect(source).toContain("sandbox: true");
    expect(source).toContain("webSecurity: true");
    expect(source).toContain('target.protocol !== "https:"');
    expect(source).toContain("new URL(value).origin !== trustedOrigin");
  });
});
