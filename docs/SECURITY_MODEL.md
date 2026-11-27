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

The checked-in migrations include a private current-credential helper used by public practitioner discovery. It must also be enforced by every workflow that creates or consumes practitioner opportunities: candidate matching, client disclosure, practitioner interest, client acceptance and consultation requests. Credential review must reject records without encrypted registration data, and status/expiry changes must immediately remove practitioners from all public and transactional eligibility paths.

Consultation conflict checks must be made concurrency-safe. The current read-then-insert check can race when two requests are submitted at nearly the same time. Use a per-practitioner transaction lock or a tested exclusion constraint, then prove the behaviour with concurrent integration tests.

These are database migration tasks, not application-only fixes. The linked JusticeConnect Supabase project was reported as `INACTIVE` on 2026-11-27. No live schema change has been run from this branch. Track the required work in [PENDING_DATABASE_HARDENING.md](./PENDING_DATABASE_HARDENING.md), restore/verify the dedicated project, generate a migration with the Supabase CLI, test on a disposable database or Supabase development branch, and run security/performance advisors before promoting it.

## Important launch blockers

- Repository CI configuration is new and must complete successfully on the pull request before merge.
- No independent RLS adversarial test suite or penetration test has been completed by this branch.
- Rate limiting, abuse detection, secure document storage/scanning, backups/restore drills, monitoring and the POPIA/professional-conduct review remain launch prerequisites.
