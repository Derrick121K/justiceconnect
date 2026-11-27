import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath = new URL(
  "../supabase/migrations/20261127122930_practitioner_eligibility_and_consultation_lock.sql",
  import.meta.url,
);

describe("practitioner eligibility and consultation concurrency migration", () => {
  it("uses the private current-credential helper at every opportunity boundary", async () => {
    const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

    for (const functionName of [
      "find_matter_practitioner_candidates",
      "share_matter_with_practitioner",
      "practitioner_express_interest",
      "client_accept_practitioner_interest",
      "request_consultation",
    ]) {
      expect(sql).toContain(`function public.${functionName}`);
    }

    expect(sql.match(/private\.has_current_practitioner_credential\(p\.id\)/g)).toHaveLength(5);
    expect(sql).toContain("pr.status = 'active'");
  });

  it("prevents self-review and rejects incomplete credential evidence", async () => {
    const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

    expect(sql).toContain("practitioners cannot verify their own credentials");
    expect(sql).toContain("practitioners cannot approve their own profiles");
    expect(sql).toContain("registration_number_encrypted");
    expect(sql).toContain("issuing_body");
    expect(sql).toContain("credential is missing required verification evidence");
  });

  it("serializes consultation overlap checks by practitioner", async () => {
    const sql = (await readFile(migrationPath, "utf8")).toLowerCase();
    const lockPosition = sql.indexOf("pg_advisory_xact_lock");
    const conflictPosition = sql.indexOf("if exists (", lockPosition);
    const insertPosition = sql.indexOf("insert into public.consultations", conflictPosition);

    expect(lockPosition).toBeGreaterThanOrEqual(0);
    expect(conflictPosition).toBeGreaterThan(lockPosition);
    expect(insertPosition).toBeGreaterThan(conflictPosition);
    expect(sql).toContain("interval '45 minutes'");
  });

  it("keeps privileged functions on an empty search path", async () => {
    const sql = (await readFile(migrationPath, "utf8")).toLowerCase();
    const functions = sql.split("create or replace function").slice(1);

    expect(functions.length).toBe(7);
    for (const definition of functions) {
      expect(definition).toContain("security definer");
      expect(definition).toMatch(/set search_path = ''/);
    }
  });
});
