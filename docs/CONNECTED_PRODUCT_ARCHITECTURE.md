# Connected JusticeConnect Product Suite

Owner: JMSE KAPA HOLDINGS (PTY) LTD  
Market: South Africa  
Architecture: modular monolith, one identity provider and one dedicated JusticeConnect Supabase project.

## Product map

| Product | Primary responsibility | Route / delivery |
|---|---|---|
| JusticeConnect | Public legal marketplace, client intake, practitioner and firm discovery, client portal and consent-controlled introductions | Public web application |
| JCStudio | Internal law-practice operations for attorneys, advocates and approved firms | `/jcstudio`, installable PWA, Windows Electron shell |
| Compliance Centre | Practitioner, LPC/FFC credential and law-firm verification, review history and evidence handling | `/compliance` redirects to the restricted `/admin` review workspace |
| Platform Administration | Account and organisation oversight, role governance, aggregate service metrics and audit metadata | `/platform-admin`, super-admin only |

These are connected product areas, not independent accounts or separate databases. Supabase Auth identifies a person once; verified firm membership and database-backed roles determine access. The product shell links the four workspaces, and each module retains its own data boundaries.

## Data hand-off

1. A client submits an enquiry in JusticeConnect. The enquiry is owned by the client and its summary is disclosed only through the existing consented workflow.
2. A practitioner or firm completes suitability and conflict checks outside the automatic matching process. Contact, consultation or interest alone is not treated as a mandate.
3. After the client and practitioner/firm accept a mandate, the mandate must be in `active` status. JCStudio's conversion RPC rechecks the active mandate, the matching firm or practitioner, the source enquiry and current professional eligibility.
4. The RPC creates a separate `practice_matters` record and copies only the client identity/title needed for the instructed file. The internal matter is not the marketplace row; its confidential description and notes never flow back to the public directory or matching inbox.
5. Work allocation, internal notes, tasks, diary events, time entries, document metadata and billing records remain inside the JCStudio matter boundary.
6. Compliance decisions remain in the Compliance Centre. A practitioner cannot self-verify or use an expired qualifying credential to open an independent practice matter.
7. Platform Administration reads aggregate counts and audit metadata. It is not designed as a backdoor for reading client advice, internal notes or document contents.

## Authorisation model

- **Client:** owns client enquiries, controls summary disclosure and participates in their authorised client communications.
- **Individual practitioner:** may open independent JCStudio matters only with a verified public profile and a current, verified qualifying LPC registration/admission record. An FFC is an additional certificate and does not replace this qualifying record.
- **Firm owner / administrator:** can administer an active, verified firm workspace. Their management access does not assert that they personally provide legal services.
- **Firm practitioner:** must be an active member of a verified firm and have current qualifying practitioner verification to open practice matters.
- **Matter team:** access is individually granted by the matter manager. Permission levels are read, edit, manage and billing. Billing-only access does not grant access to private matter notes or documents.
- **Compliance officer:** reviews evidence and makes practitioner, credential and firm verification decisions using the established Compliance Centre workflow.
- **Super administrator:** system-level platform administration. Role assignment is a trusted, audited operation, never a client-side profile field.

Postgres RLS is the enforcement boundary. The interface may hide unavailable controls, but UI state is not a security control. Matter ownership, tenant, source-mandate and client-link fields are immutable after creation. A responsible firm practitioner must be an active member of that firm. Matter membership assignments are the source of practitioner access; disabling a firm membership or suspending/de-verifying a firm also deactivates the member's Studio assignments. Re-activation does not silently restore an old assignment.

## JCStudio domain

The internal practice schema is separate from the JusticeConnect marketplace schema:

- `practice_matters` and `practice_matter_members`
- `practice_matter_notes` for internal-only notes
- `practice_tasks` for individual work allocation and deadlines
- `practice_events` for court dates, consultations, meetings, filings and reminders
- `practice_time_entries` for time and billable work
- `practice_documents` for private document metadata and scan state
- `practice_invoices` and `practice_invoice_items` for ZAR invoice records

Every module record mutation appends an audit event with actor, action, resource type and record identifier. Audit metadata deliberately excludes note bodies, client descriptions, document contents and registration numbers.

### Explicitly not enabled yet

The document table is metadata only. No private bucket, upload/download route, virus scanner or signed-download flow is enabled in this milestone. Do not upload sensitive client material until those controls are implemented and independently tested.

The event table is a local practice diary foundation; external Google/Outlook calendar synchronisation and automated court-system integration are not enabled. Time and invoice tables are structures, not a complete billing engine. Payment processing, tax configuration, trust ledgers, disbursement accounting, reconciliation and electronic mandates require dedicated legal, financial and integration review. No trust money may be recorded as client operating funds in this implementation.

AI case-law research, legal drafting and advice remain disabled pending verified source corpora, citations, evaluation, confidentiality controls and legal review. A generated answer must never silently replace practitioner judgment.

## Web and desktop delivery

The web product remains the source of truth. The PWA manifest and service worker allow installation from compatible browsers, but offline mode displays a reconnect page only. No authenticated legal pages, client information, files or drafts are cached for offline use.

The Windows Electron shell loads the configured HTTPS web origin. It runs with Node integration disabled, context isolation and sandboxing enabled, restricts in-app navigation to the configured origin, denies site permission prompts and opens external HTTPS links in the system browser. It has no embedded service-role credential or local legal database. The first installer is a development package until it is built, smoke-tested and signed with JMSE KAPA's organisational code-signing certificate.

## Operational gates before live practice use

1. Apply and reconcile the JCStudio migration in the dedicated JusticeConnect project only; verify the resulting migration ledger.
2. Test RLS adversarially across two unrelated firms, independent practitioners, matter teams, billing-only team members, clients, compliance staff and super administrators.
3. Add private Storage policies, upload content validation, malware scanning, document quarantine, signed download, version retention and deletion workflows.
4. Add conflict checks, engagement/mandate execution, calendar notifications, reliable event delivery, billing calculations and verified payment-provider callbacks.
5. Complete security testing, backup/restore drills, incident handling, POPIA impact assessment, retention/deletion procedures and South African legal/professional-conduct review.
6. Build the Windows installer on Windows CI, test installation/update/uninstall, configure a code-signing identity, and test supported Windows versions.

The database security advisor currently reports an unresolved RLS finding on PostGIS `public.spatial_ref_sys`; the existing PostGIS function privilege issue also remains. Do not suppress these findings or remove PostGIS with cascade operations. Follow the existing database-hardening runbook and Supabase Support process.

## Intended future expansion

Once the core access model and audit coverage are verified, the modules can expand to client intake pipelines, conflict registers, mandate templates and e-signature, document workflows, versioned precedents, legal research, matter profitability, billing and disbursement workflows, compliance expiry alerts, data subject request handling, operational monitoring, subscription entitlements and multi-branch firm reporting. Each addition must preserve the product boundaries and RLS-by-default.
