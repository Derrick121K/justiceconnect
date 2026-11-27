import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const patchUrl = new URL("../supabase/migrations/20261127122425_firm_workspace_rls_scope_hardening.sql", import.meta.url);
const verificationUrl = new URL("../supabase/verification/firm_workspace_rls_policy_check.sql", import.meta.url);

describe("firm workspace tenant isolation policies", () => {
  it("binds every firm member check to the outer tenant row", async () => {
    const sql = (await readFile(patchUrl, "utf8")).toLowerCase();

    expect(sql.match(/fm\.firm_id\s*=\s*law_firms\.id/g)).toHaveLength(2);
    expect(sql.match(/fm\.firm_id\s*=\s*firm_branches\.firm_id/g)).toHaveLength(4);

    expect(sql).not.toMatch(/fm\.firm_id\s*=\s*fm\.firm_id/);
    expect(sql).not.toMatch(/fm\.firm_id\s*=\s*firm_id\b/);
    expect(sql).not.toMatch(/fm\.firm_id\s*=\s*id\b/);
  });

  it("restricts workspace mutations to authenticated firm administrators", async () => {
    const sql = (await readFile(patchUrl, "utf8")).toLowerCase();
    const policies = [
      "firm admins update descriptive profile",
      "firm admins create branches",
      "firm admins update branches",
      "firm admins delete branches",
    ];

    for (const policy of policies) {
      const start = sql.indexOf(`create policy "${policy}"`);
      expect(start, `missing policy: ${policy}`).toBeGreaterThanOrEqual(0);
      const end = sql.indexOf(";", start);
      expect(sql.slice(start, end)).toContain("to authenticated");
      expect(sql.slice(start, end)).toContain("fm.user_id = (select auth.uid())");
      expect(sql.slice(start, end)).toContain("fm.firm_role in ('owner', 'administrator')");
      expect(sql.slice(start, end)).toContain("fm.status = 'active'");
    }
  });

  it("includes a live catalog regression check for the corrected policies", async () => {
    const sql = (await readFile(verificationUrl, "utf8")).toLowerCase();

    expect(sql).toContain("pg_catalog.pg_policies");
    expect(sql).toContain("law_firms administrator update policy");
    expect(sql).toContain("firm_branches insert policy");
    expect(sql).toContain("firm_branches update policy");
    expect(sql).toContain("firm_branches delete policy");
  });
});
