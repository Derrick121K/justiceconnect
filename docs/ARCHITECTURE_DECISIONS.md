# Architecture Decision Records

## ADR-001 — Modular monolith first

**Decision:** Use Next.js App Router with clearly separated domain modules and server-side application services.  
**Reason:** The first release needs transactional consistency and manageable deployment complexity. Extract services only when scaling or security boundaries justify it.

## ADR-002 — PostgreSQL + PostGIS

**Decision:** Supabase PostgreSQL with PostGIS.  
**Reason:** Legal matters, firms, practitioners, roles and mandates are relational; PostGIS supports nationwide radius and boundary-aware discovery.

## ADR-003 — Privacy-first case matching

**Decision:** Matching returns eligible practitioner profile data to the client but does not expose the client's matter to practitioners by default.  
**Reason:** Case narratives and attachments can contain sensitive personal information. A separate consented server-side disclosure workflow is required.

## ADR-004 — Verification is not self-service

**Decision:** Users may submit evidence but cannot set verification fields. Compliance staff or controlled backend workflows update verification state.  
**Reason:** A self-asserted LPC or FFC status cannot be represented as verified.

## ADR-005 — Subscriptions, not referral commissions

**Decision:** Initial commercial model uses software subscriptions and clearly disclosed marketing services.  
**Reason:** South African professional conduct rules require specialist review of referral fees, fee sharing and paid legal instructions.

## ADR-006 — Geography is reference data

**Decision:** Provinces, municipalities, settlements and suburbs are maintained as versioned data imports.  
**Reason:** A hand-maintained list becomes incomplete and stale; stable source identifiers, provenance and refresh timestamps are required.
