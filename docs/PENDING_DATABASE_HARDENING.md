# Pending database hardening — 2026-11-27

## Execution status

**Partially remediated.** The dedicated JusticeConnect Supabase project reports `ACTIVE_HEALTHY`. The original 17 migrations were confirmed against the live ledger. Three additional migrations are now applied: firm workspace tenant isolation (`20261127122425`), practitioner eligibility and consultation locking (`20261127122930`), and citext/PostGIS privilege hardening (`20261127123216`). Live catalog verification confirms the firm policies are corrected, the helper functions are installed, and `citext` is in the `extensions` schema. The database remains empty; adversarial tests with multiple real test identities have not yet been run.

A Supabase development branch was quoted at **US$0.01344 per hour**. It is the preferred isolated test target. Do not create the metered branch until the project owner explicitly approves this recurring cost. Do not use production to iterate on schema changes.

## Existing controls already present

Migration `20261110195922_expired_credential_visibility_guard.sql` already checks for a current, verified qualifying credential in candidate matching, disclosure, practitioner interest, client acceptance, consultation requests and public practitioner visibility.

Migration `20261110195939_rls_cycle_and_document_metadata_hardening.sql` adds `private.has_current_practitioner_credential(uuid)` and uses it in public visibility policies.

The remaining work is to use this private helper consistently inside transactional workflows, re-check that practitioner accounts are active at the point of use, require complete encrypted credential evidence before approval, and close a race in consultation conflict checking.

## Confirmed live tenant-isolation defect — priority 0

The live `pg_catalog.pg_policies` definitions show that four firm workspace policies are incorrectly scoped because their SQL uses unqualified column names inside a `firm_members fm` subquery:

- `firm admins create branches`
- `firm admins update branches`
- `firm admins delete branches`
- `firm admins update descriptive profile`

The branch policies currently contain the tautology `fm.firm_id = fm.firm_id`. The firm profile policy compares `fm.firm_id = fm.id`, which incorrectly blocks legitimate administration. The branch predicate can allow an administrator of one firm to mutate branches belonging to another firm.

Migration `20261127122425_firm_workspace_rls_scope_hardening.sql` corrected the four policy predicates. The live `pg_catalog.pg_policies` verification passed with no exceptions. A rollback-only live adversarial test was executed on 2026-11-27 using two temporary users and two firms. Firm A was denied Firm B branch INSERT/UPDATE/DELETE and Firm B profile UPDATE; Firm A's own branch INSERT/UPDATE/DELETE and profile UPDATE succeeded. The transaction was rolled back and a follow-up count confirmed zero test users, profiles, firms, memberships or branches remain. This validates the four corrected policies in the tested paths; broader RLS tests for other platform tables and UUID substitution remain outstanding.

## Other live advisor findings

- `public.spatial_ref_sys` is PostGIS's system reference table. Do not attempt to enable RLS or drop it. PostGIS 3.3.7 is installed in `public` and is not relocatable on this instance; use the Supabase Support-assisted relocation route after a backup, rather than a `DROP EXTENSION ... CASCADE` rebuild.
- PostGIS 3.3.7 remains installed in `public` and is not relocatable by ordinary SQL on this instance. The `spatial_ref_sys` RLS advisor error is a PostGIS system-table warning; follow Supabase Support's supported relocation process after a verified backup. A migration attempted to revoke `PUBLIC`, `anon` and `authenticated` execution from three `st_estimatedextent` overloads, but post-migration catalog checks still show those grants. Do not report this privilege finding as fixed; Supabase Support / extension-owner action is still required. The application's 16 authenticated `SECURITY DEFINER` RPCs are intentional authenticated workflows, not anonymous access; verify their individual auth/role checks before changing grants.
- `fidelity_fund_certificates` has RLS enabled but no policies. It is currently fail-closed; do not add read access until a product workflow and tenant/owner policy are defined.
- Performance advisor reports RLS init-plan warnings, missing FK indexes, unused indexes (expected on a new empty database), and multiple permissive policies. Address these in a separately tested optimization pass; do not drop planned spatial/search indexes based on empty-database statistics.

## Remaining database hardening

The following changes have been applied and checked in the live project:

- Firm profile and branch admin policies now bind membership to `law_firms.id` / `firm_branches.firm_id` and require an active owner/administrator role.
- Candidate matching, matter disclosure, expression of interest, client acceptance and consultation request workflows now use the private current-credential helper and require an active practitioner account.
- Credential approval rejects practitioner self-approval, missing encrypted registration value, missing issuing body, unsupported credential type and expired credentials.
- Consultation booking obtains a transaction-scoped advisory lock per practitioner before overlap checks and inserts.
- `citext` 1.6 now resides in `extensions`.

Remaining schema changes must be generated with the Supabase CLI and tested on an approved Supabase development branch. That branch was quoted at US$0.01344 per hour; do not create it until the owner approves the metered cost. Do not iterate against production.

1. **Centralized current eligibility checks.** Update `public.find_matter_practitioner_candidates`, `public.share_matter_with_practitioner`, `public.practitioner_express_interest`, `public.client_accept_practitioner_interest` and `public.request_consultation` to use `private.has_current_practitioner_credential(p.id)` and verify the practitioner profile is `active`, in addition to existing verified/visible checks. Preserve client ownership, consent, disclosure, expertise and service-area rules. At acceptance, re-check that the matter remains eligible and its disclosure remains active.

2. **Credential review integrity.** Before setting a credential to `verified`, require a non-empty encrypted registration value, a non-empty issuing body, a supported qualifying credential type and no expired date. Preserve compliance/super-admin authorization and prohibit self-verification. Never log plaintext credential numbers.

3. **Concurrency-safe consultation requests.** The current consultation function performs a read-then-insert availability check and can race. Acquire a transaction-scoped advisory lock keyed to the practitioner before checking overlap, then check and insert within the same transaction. Keep the existing 45-minute duration unless product policy changes. Add concurrent integration coverage proving only one overlapping request can be created.

4. **Least privilege and auditability.** Keep privileged functions schema-qualified with `SET search_path = ''`, validate `auth.uid()`, revoke default execution from `PUBLIC` and `anon`, and grant only the intended role. Audit state changes without storing confidential case content or credential values.

## Verification before promotion

- Confirm the dedicated JusticeConnect project remains `ACTIVE_HEALTHY`.
- Confirm the migration ledger contains the 20 migrations and matches the repository; never replay already-applied migrations.
- Approve the quoted development-branch cost, create that branch and test only there.
- Run Supabase security, performance and health advisors; resolve or document every finding.
- Test anonymous users, multiple clients/practitioners, expired/rejected credentials, inactive/suspended profiles, separate firms, compliance and super-admin roles.
- Test IDOR/BOLA UUID substitution for matters, practitioners, disclosures and consultations. The two-firm cross-tenant branch/profile write test passed in a rolled-back live transaction; expand adversarial testing to other firm resources, invitations, subscriptions and read paths.
- Test disclosure revocation, matter closure, repeated acceptance and concurrent consultation requests.
- Verify audit events, migration history and recovery strategy before production promotion.

## Separate application and operational release gates

- Rate limiting and abuse detection for registration, enquiries, messages and invitations.
- Private evidence storage, per-matter authorization, content validation, malware scanning and short-lived signed downloads. The current application does not have an enabled document-upload/scanning flow.
- Independent RLS adversarial testing and penetration testing.
- Backup/restore exercises, monitoring, incident response and encryption-key rotation.
- POPIA impact assessment, retention/deletion processes, operator agreements and South African legal/professional-conduct review.

**Release rule:** do not accept real legal matters or represent JusticeConnect as production-secure until the database and independent operational gates are complete.
