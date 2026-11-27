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


## Database hardening still required

The repository migration `20261110195922_expired_credential_visibility_guard.sql` already checks for a current qualifying credential in candidate matching, disclosure, practitioner interest, client acceptance, consultation requests and public practitioner visibility. Migration `20261110195939_rls_cycle_and_document_metadata_hardening.sql` adds a private current-credential helper used by visibility policies. Remaining database work is to use that helper consistently within transactional workflows, re-check active practitioner account status at the point of use, require complete encrypted credential evidence before approval, and test expiry/suspension edge cases.

Consultation conflict checks currently use a read-then-insert availability check. Concurrent requests may both pass before either insert commits. Add a transaction-scoped lock keyed to the practitioner and prove the fix with concurrent integration tests.

The JusticeConnect Supabase project restore was accepted but the project was still reporting `COMING_UP` on 2026-11-27. No live schema change has been run from this branch. A Supabase development branch was quoted at US$0.01344 per hour and requires explicit owner approval before creation. Track the database work in [PENDING_DATABASE_HARDENING.md](./PENDING_DATABASE_HARDENING.md), inspect migration history after the project is healthy, test only on the approved development branch, and run security/performance advisors before production promotion.

## Important launch blockers

- Repository CI configuration is new and must complete successfully on the pull request before merge.
- No independent RLS adversarial test suite or penetration test has been completed by this branch.
- Rate limiting, abuse detection, secure document storage/scanning, backups/restore drills, monitoring and the POPIA/professional-conduct review remain launch prerequisites.
