# Release checklist

## Before local development

- [ ] Create a dedicated Supabase project for JusticeConnect.
- [ ] Configure `.env.local` from `.env.example`.
- [ ] Generate and securely back up `CREDENTIAL_ENCRYPTION_KEY`.
- [ ] Install dependencies and commit the generated package lockfile.
- [ ] Apply all 14 migrations in order to a fresh database.
- [ ] Run `supabase db advisors` and resolve findings.
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
- [ ] Configure Vercel environment variables separately for preview and production.
- [ ] Configure custom domain, TLS, DNS and email sender authentication.
- [ ] Confirm production Supabase RLS, storage policies, backups and region.
- [ ] Run smoke tests against production with non-sensitive test accounts.
