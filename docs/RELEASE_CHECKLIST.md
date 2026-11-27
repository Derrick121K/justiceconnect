# Release checklist

## Before local development

- [ ] Create a dedicated Supabase project for JusticeConnect.
- [ ] Configure `.env.local` from `.env.example`.
- [ ] Generate and securely back up `CREDENTIAL_ENCRYPTION_KEY`.
- [ ] Install dependencies and commit the generated package lockfile.
- [ ] Apply all 22 timestamped migrations in ascending filename order to a fresh database; inspect migration history first for an existing database.
- [ ] Run `supabase db advisors` and resolve security/performance findings.
- [ ] Complete the database tasks in `docs/PENDING_DATABASE_HARDENING.md` before real practitioner matching or consultations.
- [ ] Execute `supabase/bootstrap_admin.sql` with the confirmed owner email.
- [ ] Test email confirmation and profile activation.

## Before accepting real enquiries

- [ ] Confirm POPIA Information Officer and publish contact details.
- [ ] Complete privacy impact assessment, retention schedule and data-subject request process.
- [ ] Have South African counsel approve platform terms, legal advertising, referral model and professional verification SOP.
- [ ] Confirm LPC verification procedure and FFC applicability for each practitioner class.
- [ ] Complete municipality/place data quality review and geographic search acceptance tests.
- [ ] Complete private file storage and malware scanning before enabling any upload UI.
- [ ] Configure rate limits, bot/abuse detection, support and complaint handling.
- [ ] Add a formal content-security-policy with nonce strategy after reviewing the Next.js rendering requirements; do not deploy a permissive static CSP as a shortcut.
- [ ] Perform RLS adversarial tests with multiple users and firms.
- [ ] Perform independent penetration test and dependency/SAST scans.
- [ ] Configure backups, restore tests, alerts, incident response and key rotation.
- [ ] Verify accessibility and mobile performance.

## Before production deployment

- [ ] Generate and commit `package-lock.json`.
- [ ] `npm run check:static`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run test:e2e`
- [ ] `npm run build`
- [ ] Ensure the CI and CodeQL workflows pass on the pull request.
- [ ] Resolve all high/critical `npm audit` findings and review moderate findings.
- [ ] Configure Vercel environment variables separately for preview and production.
- [ ] Configure custom domain, TLS, DNS and email sender authentication.
- [ ] Confirm production Supabase RLS, storage policies, backups and region.
- [ ] Run smoke tests against production with non-sensitive test accounts.
