# LPU Events — Phase 1.1 Database Hardening & Security Correction

**File:** `docs/technical/PHASE_1_1_DATABASE_HARDENING.md`  
**Status:** APPROVED  
**Date:** 14 August 2026  

---

## 1. Executive Summary

This report documents the security audit, correction, and database hardening (Phase 1.1) performed on the LPU Events platform. We verified the database schema boundaries, cleaned up ticketing assumptions, and introduced database-level column triggers and API interaction gates to prevent security loopholes.

**FINAL STATUS:** `READY FOR PHASE 2`

---

## 2. Ticketing Boundaries & References Audit

### 2.1 Misinterpreted Ticketing Assumptions Found
- We verified that the platform core is strictly an **event discovery and curation** platform.
- There are no database tables or internal APIs designed to manage student bookings, transactions, verification, reservations, or QR codes.

### 2.2 Obsolete Ticketing References Removed/Fixed
- The entire repository's codebase (`apps/`, `packages/`, `scripts/`, `supabase/migrations/`) was audited for occurrences of ticketing terms (`ticket`, `booking`, `payment`, `refund`, etc.).
- There are **zero** ticketing source files or database schemas. 
- In the documentation (`docs/technical/`), all references to ticketing remain strictly as explicit out-of-scope boundaries (e.g., in `TECH_STACK.md` and `STUDENT_UI_SPEC.md`), ensuring that future development respects the platform boundary.

---

## 3. Database Schema Verification

### 3.1 Actual Database Tables Verified
Our database contains only the authorized operational tables. No ticketing tables (`tickets`, `bookings`, etc.) exist. 

### 3.2 Event Schema Verification
The `events` table was validated against the canonical `DATABASE_SCHEMA.md` to ensure all fields are strictly informational:
- `registration_mode` and `external_registration_url` check mutual exclusion constraints.
- `capacity_limit`, `capacity_counts_by`, `team_pricing_mode`, and `price_amount` exist strictly for event display purposes on the public website.
- No payment gateway integration or ticket count decrementing hooks exist.

---

## 4. Security Findings & Mitigation Controls

### 4.1 RLS & Authorization Verification
- **Role Isolation**: Organizer A cannot access or mutate Organization B's events. RLS policies verify active membership via the database-derived join `public.is_org_member(organization_id)` instead of trusting client-supplied headers.
- **SQL Grant Layer**: Standard database permissions explicitly require grants before RLS evaluation. We added SELECT grants to `anon` and `authenticated` roles, and write permissions only to `authenticated` roles for Organizer actions.

### 4.2 SECURITY DEFINER Hardening
All database-level security definer helper functions (`public.is_super_admin`, `public.is_org_member`, `public.track_advertisement_interaction`, `public.increment_resource_version`) have been secured:
- Fixed explicit `search_path` set to `pg_catalog, public`.
- Schema-qualified all object references.

### 4.3 Public Data Exposure Protection
Anonymous read policies on `events`, `categories`, `advertisements`, and `carousel_items` restrict public SELECT visibility:
- Unpublished event memory drafts or inactive advertisements are hidden.
- Operational logs (`audit_logs`, `outbox_events`, `background_jobs`) have no RLS policy defined for public or organizer clients, blocking all direct read/write API access.

### 4.4 Audit Logs & Outbox Integrity
- Access is restricted to system operations (`auth.uid() is null` / `service_role`). Organizers cannot manually inject, modify, or delete outbox events or audit logs.

### 4.5 Resource Version Controls
- Resource version updates are automated via a unified `increment_resource_version()` trigger. Clients cannot bypass or directly modify the `resource_versions` table.

### 4.6 IDOR and Mass-Assignment Protection (Column-Level Security)
We implemented a set of `BEFORE INSERT OR UPDATE` triggers to enforce column-level immutability for organizers:
- **Event Ownership**: Organizers cannot transfer events to other organizations.
- **Creator Details**: `created_by` is forced to the session user on insert and made immutable on update.
- **Timestamps**: System timestamps (`created_at`, `updated_at`) are managed by database triggers.
- **Lifecycle Transition**: Organizers cannot transition an event status to `COMPLETED` directly; it raises an exception.
- **Metrics Interaction**: Clients increment ad impressions/clicks via the database-secured `track_advertisement_interaction()` function. Direct table writes are blocked.

---

## 5. Database Test Structure & Verification Results

### 5.1 Test Structure Decision
- All tests are located inside `supabase/migrations/20260814000099_database_tests.sql` which executes dynamically during `npx supabase db reset`.
- The runner creates a test context, executes check assertions, changes roles to test RLS and triggers, drops the helper functions, and cleans up seeded data in the correct dependency order.
- This ensures a 100% reproducible and clean schema state for local development.

### 5.2 Verification Commands and Results
- `npx supabase db reset` -> **Exited with code 0** (All migrations applied; all triggers and policy tests passed).
- `npm run typecheck && npm run lint` -> **Exited with code 0** (No TypeScript or code quality issues).
- Monorepo builds -> **Exited with code 0** (Student website and Admin website build correctly).

---

## 6. Remaining Issues
- **None**. The database foundation is secure, hardened, and strictly bounded.
