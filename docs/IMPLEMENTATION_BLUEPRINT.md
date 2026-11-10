# JusticeConnect — Implementation Blueprint

## Product principles

1. Client control over disclosure: a submitted enquiry is private until the client selects a practitioner.
2. Professional independence: the platform matches profiles; practitioners assess conflicts, suitability and mandates.
3. Verification transparency: distinguish identity, LPC registration, FFC applicability and firm verification.
4. South African jurisdiction: province, municipality, populated place and remote-service dimensions.
5. Tenant isolation: firm membership and role checks must be enforced in Postgres, not only in UI components.
6. Auditability: privileged status transitions append actor, resource and timestamp records.
7. Least privilege: never grant practitioners blanket read access to all client matters.

## System modules

- Public discovery: landing, verified practitioners, verified firms, practice areas and places.
- Identity: Supabase Auth, profile bootstrap, client role, cookie session refresh.
- Practitioner: profile, expertise, service areas and encrypted credentials.
- Firm: profile, owner membership, branches, invitations and team membership. Practitioner coverage updates are atomic and owner-checked.
- Client intake: draft matter, explicit matching consent, limited matching suggestions.
- Disclosure: client selects practitioner; limited summary copied into a per-practitioner disclosure row.
- Interest and contact: practitioner submits interest; client accepts; participant-only conversation is created.
- Communications: participant-only messages and notifications.
- Consultations: client request; practitioner confirmation; cancellation by either party.
- Compliance: credential review, practitioner approval and firm approval.
- Audit: append-only events for privileged transitions.

## Data boundaries

`legal_matters.confidential_details` is not included in `matter_disclosures`. `matter_documents` metadata exists but upload/download is disabled until private bucket policies and malware scanning are delivered. `matter_disclosures` contains a copy of the client-approved summary and minimal matching metadata. Revoke disclosure by setting `revoked_at`; production UI for revocation remains a planned addition.

## Roles

- `client`: default role after account bootstrap.
- `individual_practitioner`: added when a practitioner profile is created.
- `firm_owner`: added when a firm is created.
- `firm_admin`, `firm_practitioner`, `auditor`: added on invitation acceptance according to the firm membership role.
- `compliance_officer`, `super_admin`: assigned manually by an authorised project owner.

Do not infer privileges from `user_metadata`, display names or client-submitted form fields.

## Milestones

### M0 — Foundation (included)

App shell, design system, auth, core schema, RLS, initial practice taxonomy and project documentation.

### M1 — Client and practitioner workflows (included baseline)

Matter submission, consent capture, practitioner profile, expertise and service-area setup, candidate discovery, client-controlled summary disclosure and expressions of interest.

### M2 — Firm and communications (included baseline)

Firm creation, branches, team invitations, secure conversation creation, participant-only messaging and consultation lifecycle.

### M3 — Compliance (included baseline)

Encrypted credential registration number, credential review, practitioner verification, firm verification and audit records. The compliance workflow still requires SOPs and evidence handling.

### M4 — Production hardening (required)

Run Supabase advisors, migration tests, RLS adversarial tests, SAST/dependency scanning, rate-limit review, backup/restore drills, incident runbooks and independent penetration test.

### M5 — Deferred integrations

Private file upload and malware scanning, complete place datasets, PostGIS nearby search, calendar/video, payments, subscription billing, complaints, reviews, e-signatures and AI legal research.

## Deployment topology

- Next.js on Vercel.
- Dedicated Supabase project and region selected after data residency/latency review.
- Private document storage with scanning pipeline (not enabled in this build).
- Email provider for confirmation and notifications (configure separately).
- Error monitoring and audit alerting (configure separately).

## Acceptance criteria

- An unverified practitioner cannot appear in public search or receive disclosures.
- A client cannot read another client's matter or confidential details.
- A practitioner cannot browse arbitrary legal matters.
- A practitioner sees only disclosures made to their own verified profile.
- A client must explicitly select a practitioner to share a summary.
- Only conversation participants can read and send messages.
- Only authorised compliance roles can change credential/practitioner/firm verification state.
- Only the practitioner can confirm a consultation; either party may cancel.
- Firm team membership is scoped to the firm and invitations require a confirmed account.
- All privileged state changes create audit events.
