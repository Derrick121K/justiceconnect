# Pending database hardening — 2026-11-27

## Execution status

**Not applied.** The linked Supabase project named `JusticeConnect` returned `INACTIVE` when checked on 2026-11-27. This repository branch has not changed the live database. Do not interpret the application-side hardening or CI configuration as database verification.

Before database work, restore the dedicated JusticeConnect project, verify its project reference and region, inspect the migration ledger, and confirm a recoverable backup. Do not run any migration against an unrelated JMSE project.

## Required migration work

Generate the migration with the Supabase CLI (do not hand-create a timestamped migration filename):

```bash
supabase migration new current_credential_eligibility_and_consultation_lock
```

Implement and review the following in the generated migration:

1. **Enforce current credentials at every eligibility boundary.** The existing `private.has_current_practitioner_credential(uuid)` helper must be checked by:
   - `public.find_matter_practitioner_candidates`
   - `public.share_matter_with_practitioner`
   - `public.practitioner_express_interest`
   - `public.client_accept_practitioner_interest`
   - `public.request_consultation`

   Verify the practitioner's profile is active, visible and verified as applicable. A practitioner with an expired, rejected, suspended or missing qualifying credential must not receive new disclosures, appear in matching, express interest or be booked.

2. **Strengthen credential review.** Before marking a credential verified, require a non-empty encrypted registration number, a non-empty issuing body and a credential type accepted by the verification procedure. An expiry date earlier than the current date must be rejected. Preserve the rule that the practitioner cannot self-verify. Record the decision in the audit table without storing plaintext credential values.

3. **Make consultation conflict checks concurrency-safe.** The existing availability check is a read followed by an insert and can race under concurrent requests. Acquire a transaction-scoped lock for the practitioner before checking overlaps, then perform the overlap check and insert in the same transaction. An exclusion constraint is an alternative only after verifying the required extension and existing-data compatibility. Add a parallel-request integration test proving that overlapping bookings cannot both be accepted.

4. **Preserve least privilege.** Keep privileged functions schema-qualified with `SET search_path = ''`, check `auth.uid()` inside every exposed privileged workflow, and explicitly revoke default execution from `PUBLIC` and `anon`. Grant only the intended authenticated role. Do not add broad table grants or public storage access.

## Required verification before promotion

- Apply the new migration to a disposable database or Supabase development branch first; do not use production as the test environment.
- Confirm migration history before applying anything to an existing database. Never replay the 17 migrations already recorded in the repository ledger.
- Run Supabase security, performance and health advisors.
- Test anonymous access, two separate clients, two practitioners, an expired practitioner, a suspended practitioner, two firms, a compliance officer and a super administrator.
- Attempt IDOR/BOLA access by substituting matter, practitioner, disclosure, consultation and firm UUIDs.
- Confirm no client can read another client's confidential details, no practitioner can enumerate undisclosed matters, and no firm member can access another firm's records.
- Test credential approval/rejection/expiry, disclosure revocation, repeated acceptance and concurrent consultation requests.
- Verify that all privileged state changes create the expected audit event.
- Only promote after successful automated tests, review of the migration diff and a documented rollback/recovery plan.

## Separate application and operational gates

This migration does not solve application-side or operational requirements that still need separate work:

- Rate limits and abuse detection for account creation, enquiries, messages and invitations.
- Private evidence storage with strict per-matter policies, server-side content inspection, malware scanning and short-lived signed downloads. The current product must not imply that document upload is enabled.
- Independent penetration testing and a full RLS adversarial test suite.
- Backup/restore exercises, monitoring, incident response and credential-key rotation.
- POPIA privacy-impact assessment, retention/deletion processes, and South African legal/professional-conduct review.

**Release rule:** do not accept real legal matters or represent JusticeConnect as production-secure until the database gates and independent operational reviews above are complete.
