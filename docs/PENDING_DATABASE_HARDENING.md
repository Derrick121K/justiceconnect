# Pending database hardening — 2026-11-27

## Execution status

**Not applied.** The linked JusticeConnect Supabase project was restored successfully, but its current status is still `COMING_UP`. No database query, migration or advisor run has been performed after restoration. Do not interpret the repository checks as live database verification.

A Supabase development branch was quoted at **US$0.01344 per hour**. Do not create it until the project owner approves this recurring cost. The development branch is the intended test target; do not use the production database for migration iteration.

## Existing controls confirmed in repository migrations

The migration `20261110195922_expired_credential_visibility_guard.sql` already checks for a current, verified qualifying credential in these workflows:

- `public.find_matter_practitioner_candidates`
- `public.share_matter_with_practitioner`
- `public.practitioner_express_interest`
- `public.client_accept_practitioner_interest`
- `public.request_consultation`

The same migration applies current-credential filtering to public practitioner, practice-area and service-area visibility. Migration `20261110195939_rls_cycle_and_document_metadata_hardening.sql` later introduces `private.has_current_practitioner_credential(uuid)` and uses it in public visibility policies.

Therefore, the issue is **not that all current-credential checks are absent**. The remaining improvement is to consolidate transactional eligibility checks on the private helper, also require an active profile status at each privileged workflow boundary, and prove that suspended/inactive profiles cannot continue in a workflow that was previously opened.

## Required database migration work

Generate the migration with the Supabase CLI after the project is healthy and a development branch is approved:

```bash
supabase migration new eligibility_and_consultation_concurrency_hardening
```

Implement and review:

1. **Centralized, current eligibility checks.** Update all five workflows above to use `private.has_current_practitioner_credential(p.id)` and require `public.profiles.status = 'active'` for the practitioner at the point of use. Preserve client ownership, explicit matter-consent, active disclosure, profile visibility, verified practitioner status, matching expertise and existing service-area requirements. For client acceptance, also re-check the matter remains open/eligible and the disclosure remains active.

2. **Credential review integrity.** When a compliance officer chooses `verified`, require a non-empty encrypted registration value, a non-empty issuing body, a supported registration/admission credential type, and a non-expired date. Keep the existing compliance/super-admin authorization and prohibit self-verification. Never log or audit plaintext credential numbers.

3. **Concurrency-safe consultation requests.** The current consultation flow performs a read-then-insert availability check, which can permit two overlapping requests to race. Acquire a transaction-scoped advisory lock keyed to the practitioner before checking for overlap, then perform the overlap check and insert in the same transaction. Keep the fixed 45-minute duration unless product policy explicitly changes. Add an integration test with concurrent callers demonstrating that only one overlapping request can be created.

4. **Least privilege and auditability.** Keep privileged functions schema-qualified with `SET search_path = ''`, validate `auth.uid()` in each exposed privileged workflow, revoke default execution from `PUBLIC` and `anon`, and grant only the intended role. Add audit events for state changes without copying confidential case content or credential data into metadata.

## Required verification before promotion

- Wait until the dedicated JusticeConnect project reports `ACTIVE_HEALTHY`.
- Inspect the actual Supabase migration ledger before creating or applying migrations; never replay migrations already applied.
- Obtain approval for the quoted development-branch cost, create the development branch and apply/test only there.
- Run Supabase security, performance and health advisors; resolve findings or document accepted exceptions.
- Test anonymous access, two clients, multiple practitioners, expired/rejected credentials, suspended/inactive profiles, separate firms, compliance and super-admin roles.
- Attempt IDOR/BOLA access by substituting matter, practitioner, disclosure, consultation and firm UUIDs.
- Test disclosure revocation, matter closure, repeated acceptance, credential expiry and concurrent consultation requests.
- Verify that privileged state changes create expected audit events.
- Review the generated migration diff and prove rollback/recovery before production promotion.

## Separate application and operational gates

- Rate limits and abuse detection for registration, enquiries, messages and invitations.
- Private evidence storage with per-matter authorization, MIME/content validation, malware scanning and short-lived signed downloads. The current application has no enabled upload/scanning flow.
- Independent RLS adversarial testing and penetration testing.
- Backup/restore exercises, monitoring, incident response and encryption-key rotation.
- POPIA privacy-impact assessment, retention/deletion processes, operator agreements, and South African legal/professional-conduct review.

**Release rule:** do not accept real legal matters or represent JusticeConnect as production-secure until database, independent security and operational gates are complete.
