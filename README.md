# JusticeConnect

**A South African legal services marketplace and enterprise legal-practice workspace** owned by **JMSE KAPA HOLDINGS (PTY) LTD**.

Brand: midnight navy, white and restrained gold. Market: all nine South African provinces.

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
- PostgreSQL/PostGIS schema, restrictive RLS policies and narrowly scoped security-definer workflows.
- Unit tests, static project checks, deployment and security documentation.

## Not yet production-complete

These features require further implementation or external services and are intentionally not faked:

- Private file upload/download, malware scanning and secure evidence access. `matter_documents` metadata exists, but there is no enabled client upload UI or scanner integration.
- Full municipality, suburb, township, ward and address dataset. The included importer loads GeoNames populated places; authoritative municipal/address sources must supplement it.
- True coordinate-radius search and interactive map UI. Place coordinates are stored for a subsequent PostGIS nearby-search endpoint.
- Calendar provider integration, video consultations, payment gateway, invoicing and subscription billing.
- Practitioner reviews, complaints, mandate document signing and advanced matter-management workflow.
- AI legal research. Do not enable generative legal advice until the corpus, source attribution, evaluation, safeguards and legal review are complete.
- Formal conflict-check and mandate acceptance workflow. A conversation or consultation is not a mandate.
- Production incident response, backups/restore drills, penetration test and independent legal/privacy review.

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

Apply migrations in numeric order:

1. `0001_initial_platform.sql`
2. `0002_practice_area_seed.sql`
3. `0003_onboarding_and_matching_rpc.sql`
4. `0004_privilege_hardening.sql`
5. `0005_consent_based_submission.sql`
6. `0006_owner_scoped_workspace_writes.sql`
7. `0007_identity_and_organisation_bootstrap.sql`
8. `0008_private_case_disclosure_workflow.sql`
9. `0009_national_place_import_support.sql`
10. `0010_compliance_review_workflows.sql`
11. `0011_consultation_lifecycle.sql`
12. `0012_firm_team_invitations.sql`
13. `0013_atomic_practitioner_coverage.sql`
14. `0014_role_helper_execute_hardening.sql`
15. `0015_expired_credential_visibility_guard.sql`

For a linked project, install the Supabase CLI, run `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, inspect the pending migration list, then run `supabase db push`. Alternatively apply the SQL files in order through the SQL editor. Confirm the target project before either route. After migrations, execute `supabase/bootstrap_admin.sql` in the SQL editor after replacing the placeholder with the confirmed owner's account email. This grants the first `super_admin` role. Treat that SQL as privileged break-glass setup and do not expose it in a public route.

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

Local verification completed successfully on the maintainer's Windows development environment:

- Vitest: 13 tests passed.
- TypeScript: passed.
- ESLint: passed with zero errors.
- Next.js 16.4.6 production build: passed.
- npm security audit: zero reported vulnerabilities.

These results do not replace Supabase integration testing, database RLS testing, end-to-end testing or independent security review. JusticeConnect must complete those checks before accepting real client matters.

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
