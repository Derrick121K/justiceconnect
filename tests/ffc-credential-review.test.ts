import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath = new URL(
  "../supabase/migrations/20261127172902_ffc_credential_review_and_expiry_rules.sql",
  import.meta.url,
);
const eligibilityMigrationPath = new URL(
  "../supabase/migrations/20261127122930_practitioner_eligibility_and_consultation_lock.sql",
  import.meta.url,
);

describe("Fidelity Fund Certificate review rules", () => {
  it("allows FFC as a separately reviewable LPC-issued credential", async () => {
    const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

    expect(sql).toContain("'ffc'");
    expect(sql).toContain("legal practice council");
    expect(sql).toContain("fidelity fund certificates must include their annual expiry date");
    expect(sql).toContain("credential is already expired");
    expect(sql).toContain("registration_number_encrypted");
  });

  it("does not allow FFC to replace admission or LPC registration for practitioner eligibility", async () => {
    const sql = (await readFile(eligibilityMigrationPath, "utf8")).toLowerCase();
    const helperMigration = await readFile(
      new URL("../supabase/migrations/20261110195922_expired_credential_visibility_guard.sql", import.meta.url),
      "utf8",
    );

    expect(sql).toContain("private.has_current_practitioner_credential(p.id)");
    expect(helperMigration.toLowerCase()).toContain("'lpc_registration', 'candidate_registration', 'admission'");
    expect(helperMigration.toLowerCase()).not.toMatch(/'lpc_registration',\s*'candidate_registration',\s*'admission',\s*'ffc'/);
  });

  it("keeps the review RPC protected and records only the decision", async () => {
    const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("compliance_officer");
    expect(sql).toContain("is_super_admin()");
    expect(sql).toContain("'credential.reviewed'");
    expect(sql).toContain("jsonb_build_object('decision', decision)");
  });
});
