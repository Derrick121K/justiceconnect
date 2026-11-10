# Test Plan

## Automated tests

- Matching eligibility: active + verified + relevant expertise + service-area/remote rules.
- Input schemas: length bounds, enum values, province identifiers and mandatory consent.
- Server actions: unauthenticated requests redirect; invalid values rejected; RPC failures surfaced.
- Database integration: all migrations apply to a clean Supabase project.
- RLS adversarial tests: two clients, two practitioners, two firms, compliance and anonymous user.
- Workflow integration: matter submit → candidate list → selected disclosure → expression of interest → client accepts → secure conversation → message → consultation request → confirm/cancel.
- Compliance: non-compliance role cannot review; practitioner cannot self-verify; expired credential cannot approve; audit event is written.
- Firm: owner membership bootstrap, branch ownership, invitation acceptance, cross-tenant denial.

## Manual acceptance checks

- Responsive layout at mobile, tablet and desktop widths.
- Keyboard navigation, labels, visible focus, screen-reader status messages and colour contrast.
- South African time-zone display and consultation input handling.
- Verify that no private matter text appears in public pages, search results, logs or analytics.
- Confirm no secret appears in client bundles or source maps.

## Commands

```bash
npm run check:static
npm run typecheck
npm run lint
npm test
npm run build
```

Dependency installation and these project commands were not executable in the authoring environment due to npm registry DNS timeouts. Run them in a network-enabled environment before merging or deploying.
