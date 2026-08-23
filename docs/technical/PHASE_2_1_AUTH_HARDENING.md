# LPU Events — Phase 2.1 Authentication & Authorization Hardening

**File:** `docs/technical/PHASE_2_1_AUTH_HARDENING.md`  
**Status:** COMPLETE  
**Final Status:** `READY FOR PHASE 3`  
**Date:** 14 August 2026  

---

## 1. Super Admin Bootstrap Mechanism

We implemented a secure, trigger-based bootstrap mechanism to provision the initial Super Admin account:
* **Bootstrap Identity**: `subhamkumar86032@gmail.com`
* **Trigger Implementation**: In `public.handle_new_auth_user()`, we intercept insertions from the `auth.users` schema.
* **Email Normalization**: The email is normalized using `lower(trim(email))` at the trigger layer before matching or inserting to prevent casing or whitespace bypasses (e.g. ` SUBHAMKUMAR86032@gmail.com ` is successfully cleaned and mapped).
* **Security Controls**:
  - The bootstrap check is strictly database-defined; no client variables, localStorage parameters, or URL queries are trusted.
  - The check is restricted to the specific pre-approved email `subhamkumar86032@gmail.com`.
  - Normal authorization is database-backed. After the initial trigger severs as the bootstrap hook, the session verification queries the persistent database role (`SUPER_ADMIN` in `platform_admin_roles`) instead of recalculating the email address matches.

---

## 2. Authentication & Session Security

### 2.1 Email OTP Configuration
* Checked and confirmed in `supabase/config.toml` that Email OTP is the **only** administrative login provider.
* No password configurations, Google Sign-In, or external social providers exist in the client build or local Supabase configuration.

### 2.2 Session Lifecycle and Revocation
* Sessions are handled directly via the official Supabase Auth SDK.
* If an Organizer is deactivated (`is_active = false`) or their organization membership is deleted from `organization_members`, the database-backed checks (`public.is_org_member`) evaluate on subsequent requests, immediately revoking CRUD access even if their client JWT session is technically still valid.

---

## 3. Privilege Escalation & Resource Isolation

### 3.1 Organization Isolation
* Verified that RLS policies derive organization-scoped permissions strictly using the database state `is_org_member(organization_id)` matching the token's authenticated UUID. IDOR attacks that supply unauthorized `organization_id` values in request bodies are immediately blocked by the database layer.

### 3.2 Access Request Security
* The pending request insert trigger `process_access_request_changes` forces all Organizer requests to `PENDING` and clears review stamps, preventing client-side insertion forgery.
* Access approval and rejection RPCs verify caller identity via `public.is_super_admin()` before processing mutations.

---

## 4. Environment Variables Audit

We performed an audit of all environment variables:
* **Root `.env` & `.env.example`**: Inspected and verified that they contain **only public browser-facing configurations** (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`). No server keys (`service_role` keys, database passwords, or third-party secret tokens) are checked in or stored here.
* **Student Web Configuration**: Removed `envDir` from [`apps/student-web/vite.config.ts`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/apps/student-web/vite.config.ts) since it currently has no database or API dependencies, minimizing the student portal footprint.

---

## 5. Security Vulnerabilities Found & Fixed

### 5.1 Email Check Constraint Violation
* **Finding**: The test case checking casing/whitespace normalization with `  SUBHAMKUMAR86032@gmail.com  ` failed during database reset. The untrimmed email was sent directly to `admin_users`, which violated the regex format check constraint (`admin_users_email_check`).
* **Fix**: Updated `handle_new_auth_user()` to clean and store the email via `v_clean_email := lower(trim(new.email))` before mapping it to the `admin_users` table, resolving constraint conflicts and ensuring consistent indexing.

---

## 6. Adversarial Attack Verification Results

We verified that the following unauthorized requests fail:
1. Arbitrary users attempting to trigger the Super Admin role -> **Fails (Trigger ignores non-matching emails)**.
2. Organizers trying to call request approval or rejection RPCs -> **Fails (Throws 'Unauthorized admin action')**.
3. Direct PostgREST inserts to `audit_logs` or `platform_admin_roles` -> **Fails (Blocked by write policies)**.
4. Capitalization or whitespace bypass attempts -> **Fails (Trigger normalizes inputs successfully)**.

### 6.1 Verification Commands
* Database reset: `npx supabase db reset` -> **Exited with code 0** (Schema, triggers, and automated tests pass successfully).
* TypeScript type checks: `npm run typecheck` -> **Exited with code 0** (Success).
* Production builds: `npm run build:student && npm run build:admin` -> **Exited with code 0** (Success).
