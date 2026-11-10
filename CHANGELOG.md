# Changelog

## 0.2.0 — Enterprise foundation expansion

- Added cookie-based Supabase authentication and Next.js 16 proxy session refresh.
- Added client intake, consent-based disclosure, practitioner opportunity workflow and secure conversations.
- Added consultation lifecycle, firm branches and team invitations.
- Added compliance review and AES-256-GCM encryption for practitioner registration numbers.
- Added national populated-place import support, tests, static checks and security documentation.
- Added explicit production-readiness boundaries for document scanning, payments, AI legal research and full geospatial discovery.

## Source quality fixes — 2026-11-10

- Replaced explicit `any` annotations in directory, dashboard, invitations, matter, firm and messaging pages with explicit result-row and embedded-relation types.
- Normalised Supabase embedded relation handling for object, array and null responses.
- Replaced internal home-page route anchors with Next.js `Link` components, escaped JSX apostrophes and assigned stable keys to practice-area icons.
- Removed an unused matter-page icon import and corrected the PostCSS default-export lint warning.
- Set the absolute application root for Turbopack to avoid selecting the unrelated parent `package-lock.json`.
- Added unit coverage for the embedded-relation helper.
