# Security model and threat checklist

## Protected information

Account identity, practitioner registration numbers, client matter summaries, confidential notes, documents, messages, consultation details, firm membership and audit events.

## Primary controls

- Supabase Auth email confirmation and cookie session refresh through Next.js 16 `proxy.ts`.
- Server-side `auth.getUser()` checks before mutations; RLS remains the final data-access boundary.
- Role data stored in `user_roles`, never in user-editable metadata.
- RLS policies on all public schema application tables.
- Explicit owner/participant/organisation checks.
- Narrow `SECURITY DEFINER` RPCs with `search_path = ''`, explicit schema qualification, auth checks, and revoked default execute grants.
- AES-256-GCM credential-number encryption; key stored only in server environment.
- No public storage bucket for legal matter files.
- Security response headers; `poweredByHeader` disabled.
- Server Actions reject non-text form values, validate UUID/date/email formats and bound high-risk text fields before database calls.
- Server Actions return generic failure messages rather than forwarding raw Supabase/Auth error details to the browser.
- CI checks dependency advisories, static invariants, type safety, lint, unit tests, Playwright tests and production builds; CodeQL runs on changes and weekly, with action dependencies SHA-pinned.

## Threats to test

1. BOLA/IDOR: replace matter, practitioner, disclosure, firm, conversation or consultation UUIDs.
2. Role escalation: alter user metadata, profile fields, role rows or organisation IDs.
3. RLS bypass: anonymous access, direct PostgREST calls, update without select policy, upsert edge cases.
4. Data disclosure: nested relation joins, views, RPC return fields and error messages.
5. Credential compromise: key rotation, key loss, plaintext logs, backup exposure and admin access.
6. Messaging abuse: spam, harassment, attachment links, cross-conversation reads and rate limits.
7. Firm isolation: access another firm's branches, members, invitations or subscriptions.
8. Workflow races: double acceptance, revoked disclosure, expired credential, suspended practitioner and concurrent status updates.
9. Web risks: CSRF, XSS, open redirects, security headers, brute force and account enumeration.
10. Operational risks: restore tests, audit log retention, secrets rotation and incident escalation.

## Required pre-launch controls not included

- Independent penetration test and RLS adversarial test suite.
- Rate limiting and abuse detection on all intake, message and invitation actions.
- Private document upload with MIME/content validation, antivirus scanning and signed download URLs.
- Automated credential re-checks and expiry notifications.
- Privacy impact assessment, operator agreements and retention/deletion runbooks.
- Backup/restore drill and security incident tabletop exercise.


## Database hardening status

The live JusticeConnect Supabase project reports `ACTIVE_HEALTHY`. The 21-migration database ledger is reconciled with the repository. Four additional migrations were applied on 2026-11-27:

- `20261127122425_firm_workspace_rls_scope_hardening.sql` fixes four firm workspace RLS predicates so branch and firm profile writes are scoped to the correct tenant. A rollback-only two-firm test passed: cross-firm branch INSERT/UPDATE/DELETE and profile UPDATE were denied, while own-firm writes succeeded.
- `20261127122930_practitioner_eligibility_and_consultation_lock.sql` rechecks active practitioner status and current qualifying credentials at workflow boundaries, prevents self-approval and incomplete credential approval, and serializes consultation overlap checks using a transaction-scoped practitioner lock.
- `20261127123216_citext_and_postgis_function_privilege_hardening.sql` moved `citext` to `extensions`. PostGIS ACL restrictions did not take effect and remain unresolved.
- `20261127172902_ffc_credential_review_and_expiry_rules.sql` permits separate review of an LPC-issued, encrypted FFC with its current annual expiry date. FFC does not replace proof of admission/enrolment; the private eligibility helper intentionally excludes FFC as the sole qualifying credential.

The Supabase security advisor still flags PostGIS `public.spatial_ref_sys`. Three `st_estimatedextent` overloads remain executable by `anon` and `authenticated` despite an attempted ACL migration. Do not claim the PostGIS finding is resolved or use `DROP EXTENSION ... CASCADE`. Coordinate a supported change with Supabase Support after a verified backup.

The live two-firm test verifies only the corrected firm/branch write paths. Wider adversarial RLS tests, concurrent consultation integration tests, PostGIS remediation and independent security/privacy reviews are still required. Use [PENDING_DATABASE_HARDENING.md](./PENDING_DATABASE_HARDENING.md) as the authoritative remaining-work checklist.

## Important launch blockers

- Repository CI configuration is new and must complete successfully on the pull request before merge.
- No independent RLS adversarial test suite or penetration test has been completed by this branch.
- Rate limiting, abuse detection, secure document storage/scanning, backups/restore drills, monitoring and the POPIA/professional-conduct review remain launch prerequisites.
