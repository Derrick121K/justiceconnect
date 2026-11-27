# JusticeConnect

**A South African legal services marketplace and enterprise legal-practice workspace** owned by **JMSE KAPA HOLDINGS (PTY) LTD**.

Brand: midnight navy, white and restrained gold. Market: all nine South African provinces.

The connected product suite has four surfaces: **JusticeConnect** (marketplace and client portal), **JCStudio** (legal practice management), **Compliance Centre** (practitioner, credential and firm verification), and **Platform Administration** (restricted system oversight). All four use the JusticeConnect identity, organisation and database security model.

> This repository is a substantial application foundation, not a representation that the service is ready to accept real client matters. Production use requires a configured Supabase project, complete place-data import, security testing, POPIA work, professional-conduct review and operational staffing.

## Included application

- Responsive public home page and premium legal design system.
- Email/password registration, login, logout and cookie-based Supabase SSR session refresh.
- Automatic account profile bootstrap and client role assignment; roles are never derived from user-editable metadata.
- Client legal enquiry submission with explicit matching consent and privacy-notice versioning.
- Private matter dashboard and client-controlled selection of which verified practitioner receives the limited summary.
- Practitioner onboarding, practice-area and province/place service coverage, encrypted credential-number submission.
- Practitioner opportunity inbox limited to explicitly disclosed matters; expression-of-interest workflow.
- Client acceptance of an expression of interest and secure participant-only conversation creation.
- Private messaging and consultation request/confirm/cancel workflows.
- Law firm creation, branch management, team invitations and invitation acceptance.
- Compliance workspace for credential, practitioner and firm review with audit events.
- Public verified practitioner and firm directories, practice-area pages and province discovery.
- GeoNames populated-place import utility for province-aware location discovery.
- JCStudio private practice domain: internal matters, matter-team permissions, confidential notes, tasks, calendar-event foundation, time entries, document metadata and ZAR invoice records. This is separate from marketplace enquiries.
- Accepted mandate conversion from JusticeConnect into a private JCStudio matter, with server-side verification and RLS enforcement.
- JCStudio installable PWA shell and a hardened Windows Electron desktop client wrapper.
- Restricted Platform Administration overview with aggregate platform metrics and audit metadata.
- PostgreSQL/PostGIS schema, restrictive RLS policies and narrowly scoped security-definer workflows.
- Unit tests, static project checks, deployment and security documentation.

## Not yet production-complete

These features require further implementation or external services and are intentionally not faked:

- Private legal document upload/download, malware scanning, quarantine, version history, signed download and secure evidence access. Both marketplace and JCStudio document tables are metadata only; no document bucket or scanner integration is enabled.
- Full municipality, suburb, township, ward and address dataset. The included importer loads GeoNames populated places; authoritative municipal/address sources must supplement it.
- True coordinate-radius search and interactive map UI. Place coordinates are stored for a subsequent PostGIS nearby-search endpoint.
- External calendar provider and court-system integration, video consultations, payment gateway and subscription billing. JCStudio has a practice diary foundation and invoice/time-entry database structures, but a complete billing workflow, tax configuration and reconciliation are not enabled.
- Practitioner reviews, complaints, electronic mandate signing and a complete conflict-check workflow. Active mandate status is required for marketplace conversion, but the full legal engagement and conflict process needs further development and professional review.
- AI legal research. Do not enable generative legal advice until the corpus, source attribution, evaluation, safeguards and legal review are complete.
- Trust accounting, client money ledger, disbursement management and payment reconciliation. Never treat the invoice tables as a regulated trust ledger.
- Production incident response, backups/restore drills, penetration test and independent legal/privacy review.

## JCStudio desktop application

The web application is the system of record. Compatible browsers can install JCStudio as a PWA. A Windows desktop shell is in `desktop/`; it runs the same hosted app using Electron, with Node integration disabled, context isolation, sandboxing and navigation locked to a configured HTTPS origin. It does not locally store legal files or enable offline case access. See [desktop/README.md](desktop/README.md). The installer must be built, smoke-tested and signed with JMSE KAPA's organisational code-signing certificate before production distribution.

See [docs/CONNECTED_PRODUCT_ARCHITECTURE.md](docs/CONNECTED_PRODUCT_ARCHITECTURE.md) for the shared product boundaries, authorisation model and next delivery gates.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- A dedicated Supabase project with PostgreSQL and PostGIS available
- Supabase CLI for applying migrations locally or to a linked project

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key) from the Supabase project settings. Set `CREDENTIAL_ENCRYPTION_KEY` to a unique 32-byte hex key generated with:

```bash
openssl rand -hex 32
```

Keep `.env.local`, all encryption keys and service-role credentials out of Git. The web application does not use the service-role key. The GeoNames import script uses it only from a local server-side process.

## Database setup

Create a new, dedicated Supabase project for JusticeConnect. Do not reuse the database of another JMSE application.

Apply the timestamped SQL files in `supabase/migrations/` in ascending filename order, exactly once, against a dedicated JusticeConnect database. The repository currently contains 23 timestamped migrations. For an existing project, inspect `supabase migration list` and the Supabase migration ledger first; do not replay migrations already recorded as applied. The existing JusticeConnect project has 22 migrations applied. The proposed JCStudio migration is a separate additive change and must be reviewed, validated and applied once before the new JCStudio database-backed routes are enabled. A fresh database must receive the complete ordered migration set, followed by a separate validation pass.

For a linked project, install the Supabase CLI, run `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, inspect the pending migration list, then inspect the pending migration plan and run `supabase db push` only after confirming the linked project reference, reviewing the migration diff, and ensuring a recoverable backup exists. Do not apply migrations to production from an unreviewed local checkout. After migrations, execute `supabase/bootstrap_admin.sql` in the SQL editor after replacing the placeholder with the confirmed owner's account email. This grants the first `super_admin` role. Treat that SQL as privileged break-glass setup and do not expose it in a public route.

### National place import

1. Download and extract the GeoNames South Africa dump (`ZA.txt`) into `data/` from <https://download.geonames.org/export/dump/>.
2. Verify the Admin1 province-code mapping in `scripts/import-geonames.mjs` against the current dataset metadata.
3. Add `SUPABASE_SERVICE_ROLE_KEY` to the local `.env.local` only.
4. Run `npm run import:places`.

The importer uses upsert on the GeoNames ID and can be rerun. It does not include every suburb, township, street, municipal ward or legal service point. Supplement with authoritative datasets before advertising complete city-level coverage.

## Commands

```bash
npm run dev
npm run check:static
npm run typecheck
npm run lint
npm test
npm run build
npm run import:places
```

A `package-lock.json` is committed. Use `npm ci` for reproducible dependency installation.

Historical baseline verification completed successfully on the maintainer's Windows development environment before the current production-readiness branch changes:

- Vitest: 13 tests passed.
- TypeScript: passed.
- ESLint: passed with zero errors.
- Next.js 16.4.6 production build: passed.
- npm security audit: zero reported vulnerabilities.

These historical results do not verify the changes on the current production-readiness branch. The branch CI workflow must rerun all checks and report success before merge. Historical checks also do not replace Supabase integration testing, database RLS testing, end-to-end testing or independent security review. JusticeConnect must complete those checks before accepting real client matters.

## Security and privacy model

- RLS is enabled on application tables. Every exposed table requires an explicit access policy.
- `service_role` must never be used in browser code or exposed via `NEXT_PUBLIC_`.
- User-editable `raw_user_meta_data` is not used for authorization.
- Account roles are inserted by trusted database triggers and assigned by trusted administrators.
- Legal matters are private to their client by default. Matching suggestions return practitioner profile data only.
- The client explicitly selects a practitioner before a limited matter summary is disclosed.
- Practitioners only see summaries disclosed to their own verified profile. No confidential notes or attachments are returned by that feed.
- Expressions of interest and contact invitations use narrow RPC workflows. Messages are readable only by conversation participants.
- Credential registration numbers are encrypted using AES-256-GCM before database storage. The encryption key must be backed up securely and rotated under a documented process.
- Compliance decisions are made by authorised roles and written to audit events.
- A consultation request, message or case submission does not create a legal mandate.

## Legal and operational requirements before launch

JMSE KAPA HOLDINGS (PTY) LTD should obtain South African legal advice on the platform's operating model, LPC professional conduct rules, legal advertising, referral arrangements, FFC requirements, consumer disclosures, terms, POPIA lawful bases, Information Officer obligations, operator agreements, cross-border processing, data retention, complaints and breach response. Complete a privacy impact assessment and independent security assessment before onboarding real matters.

## Project ownership

JusticeConnect is a product of JMSE KAPA HOLDINGS (PTY) LTD. The platform must not imply endorsement by the Legal Practice Council, courts, government or any law firm unless expressly authorised.

## Supabase migration ledger

The following files match the migration versions recorded in the JusticeConnect Supabase project. The 22 entries in this ledger are already applied to that project; do not reapply them there.

<!-- JUSTICECONNECT_SUPABASE_MIGRATIONS_START -->
- `20261110195704_initial_platform.sql`
- `20261110195725_practice_area_seed.sql`
- `20261110195740_onboarding_and_matching_rpc.sql`
- `20261110195748_privilege_hardening.sql`
- `20261110195757_consent_based_submission.sql`
- `20261110195805_owner_scoped_workspace_writes.sql`
- `20261110195814_identity_and_organisation_bootstrap.sql`
- `20261110195823_private_case_disclosure_workflow.sql`
- `20261110195831_national_place_import_support.sql`
- `20261110195840_compliance_review_workflows.sql`
- `20261110195848_consultation_lifecycle.sql`
- `20261110195856_firm_team_invitations.sql`
- `20261110195905_atomic_practitioner_coverage.sql`
- `20261110195913_role_helper_execute_hardening.sql`
- `20261110195922_expired_credential_visibility_guard.sql`
- `20261110195939_rls_cycle_and_document_metadata_hardening.sql`
- `20261110200109_security_definer_helpers_and_rpc_hardening.sql`
- `20261127122425_firm_workspace_rls_scope_hardening.sql`
- `20261127122930_practitioner_eligibility_and_consultation_lock.sql`
- `20261127123216_citext_and_postgis_function_privilege_hardening.sql`
- `20261127172902_ffc_credential_review_and_expiry_rules.sql`
- `20261127173151_south_africa_credential_expiry_timezone.sql`

<!-- JUSTICECONNECT_SUPABASE_MIGRATIONS_END -->

### Proposed next migration

- `20261127190000_jcstudio_and_connected_products.sql` — JCStudio internal practice schema, access helpers, accepted-mandate conversion and product-suite support. This file is **not yet recorded as applied** in the live JusticeConnect migration ledger.
