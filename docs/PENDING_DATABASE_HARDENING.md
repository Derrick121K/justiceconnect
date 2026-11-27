# Remaining database and production hardening — 2026-11-27

## Live database status

The dedicated JusticeConnect Supabase project reports `ACTIVE_HEALTHY`. The live migration ledger contains **22 migrations**, including the five additional migrations applied during the production-readiness work:

- `20261127122425_firm_workspace_rls_scope_hardening`
- `20261127122930_practitioner_eligibility_and_consultation_lock`
- `20261127123216_citext_and_postgis_function_privilege_hardening`
- `20261127172902_ffc_credential_review_and_expiry_rules`
- `20261127173151_south_africa_credential_expiry_timezone`

The README migration ledger matches the live ledger. Do not replay migrations already recorded as applied.

## Database hardening confirmed as applied

1. **Firm tenant isolation.** Firm profile and branch administrator policies bind membership checks to the outer `law_firms.id` and `firm_branches.firm_id` rows. A rollback-only two-firm adversarial test confirmed that Firm A cannot insert, update or delete Firm B's branches or update Firm B's profile, while Firm A can update its own records. All temporary test fixtures were rolled back and follow-up counts confirmed no fixtures remained.

2. **Practitioner eligibility.** Candidate matching, matter disclosure, practitioner interest, client acceptance and consultation requests check the private current-credential helper and require an active practitioner account at the point of use. Practitioner profile and credential self-approval are rejected.

3. **Credential evidence.** Credential verification requires encrypted registration data and an issuing body, and rejects expired credentials. The latest review migration separately permits an LPC-issued Fidelity Fund Certificate (FFC) to be reviewed when the encrypted certificate number and current annual expiry date are supplied.

4. **FFC is not admission.** The private practitioner-eligibility helper intentionally continues to require a current qualifying LPC registration, candidate registration or admission/enrolment record. An FFC is an additional, distinct certificate for the practices that require it; it does not alone establish admission/enrolment or enable public practitioner discovery.

5. **South African expiry date.** The eligibility helper and credential review RPC use `Africa/Johannesburg` calendar dates, matching the application's server-side expiry validation.

5. **Consultation race protection.** Consultation requests acquire a transaction-scoped advisory lock for the practitioner before overlap checks and insert, preventing concurrent requests from both passing the same availability check.

6. **Extension placement.** The relocatable `citext` extension has been moved into the `extensions` schema.

## Remaining PostGIS advisor finding

- PostGIS 3.3.7 remains installed in `public` and is not relocatable by ordinary SQL on this instance. The `public.spatial_ref_sys` advisor error concerns the PostGIS system reference table; do not enable RLS on it, drop the extension or run `DROP EXTENSION ... CASCADE`.
- The attempted permission restriction on three `st_estimatedextent` overloads did not change their live ACLs. They remain executable by `anon` and `authenticated`. Do not mark this as fixed.
- Ask Supabase Support for the supported PostGIS schema/ACL remediation path. Complete a recoverable backup first and obtain a written change plan. Re-run the security advisor and inspect the exact function ACLs afterwards.

## Remaining verification and release gates

- Add automated multi-user RLS tests for read and write paths across matters, disclosures, conversations, firm members, invitations, branches and subscriptions. The two-firm branch/profile mutation paths have passed; that is not proof that every table is safe.
- Add a concurrent integration test that creates overlapping consultation requests against a disposable database and proves only one request succeeds.
- Test expired, rejected, suspended, revoked and renewed credential states, including separate admission/LPC registration and FFC evidence.
- Verify that credential replacement does not change historical records, that a verified FFC alone does not enable practitioner discovery, and that expired credentials are excluded immediately.
- Run Supabase security, performance and health advisors after PostGIS remediation. Review RLS init-plan warnings, foreign-key indexes and multiple permissive policies; do not drop unused indexes solely because the new database has low row counts.
- Complete independent penetration testing and a dedicated RLS adversarial review.
- Implement rate limits and abuse detection for registration, enquiries, messages and invitations.
- Implement private evidence storage with per-matter authorization, content validation, malware scanning and short-lived signed downloads before enabling document upload.
- Complete backup/restore drills, monitoring, incident response and credential-encryption key rotation.
- Complete the POPIA impact assessment, retention/deletion processes, operator agreements and South African legal/professional-conduct review.

## Safe operational rule

Continue testing with non-sensitive accounts and fictional matter details. Do not submit real confidential legal matters, expose unverified practitioners in public search, or describe JusticeConnect as production-secure until the PostGIS, independent security, privacy and operational release gates are complete.
