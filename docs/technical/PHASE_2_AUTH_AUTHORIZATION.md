# LPU Events — Phase 2 Authentication & Authorization Foundation

**File:** `docs/technical/PHASE_2_AUTH_AUTHORIZATION.md`  
**Status:** COMPLETE  
**Final Status:** `STOP AFTER PHASE 2 — READY FOR PHASE 3`  
**Date:** 14 August 2026  

---

## 1. Authentication Foundation

### 1.1 Email OTP Authentication
We implemented passwordless Email OTP administrative logins in `apps/admin-web/` using the official Supabase Auth SDK client:
* **Workflow**: The user enters an LPU administrative email address, requesting an OTP code. The code is delivered via email and validated in-place.
* **Credentials Restricted**: There is strictly no password sign-up, password login, password reset, or social OAuth configurations in the code.
* **Student Authentication**: In accordance with product requirements, public student access is strictly anonymous and has no sign-up or profile controls.

### 1.2 OTP Configuration
Configured in `supabase/config.toml`:
* `otp_length = 6`
* `otp_expiry = 3600` (1 hour)
* OTP values are stored internally by Supabase Auth; no plain-text OTP table is maintained by application logic.

### 1.3 Session Handling
* Session state is established in-place and managed by the Supabase client utilizing standard refresh token rotation (`enable_refresh_token_rotation = true`).
* Logout destroys the session token on both client and edge storage, executing an RPC trigger to secure logs.

---

## 2. Authorization Design

### 2.1 Centralized Server-Side Authorization
All authorization checks are derived directly from trusted PostgreSQL database states:
* **`get_current_admin_profile()`**: Database RPC that returns the admin ID, role, and organization membership details for the current `auth.uid()` session. This is the single source of truth for authorization.
* **Client-Side Route Guards**:
  - `RequireAuth`: Restricts console views to valid Supabase authenticated users.
  - `RequireSuperAdmin`: Restricts views based on `profile.is_super_admin` role.
  - `RequireOrganizer`: Restricts views to active organization members matching `profile.org_id`.

### 2.2 Super Admin Authorization
* Managed in the database via `public.platform_admin_roles`.
* Seeded roles verify the single active Super Admin constraint.

### 2.3 Organizer Authorization & Organization Isolation
* Scoped to the individual organizer's organization. Membership is checked database-side:
  - Events CRUD is restricted to events belonging to the Organizer's organization (`is_org_member(organization_id)`).
  - Organizer access requests are automatically routed based on organizer identity.

### 2.4 Access-Request Workflow
We implemented the organizer request lifecycle transactionally in the database:
1. **Request Submission**: An authenticated admin user submits an request (`organizer_access_requests`) for an organization. Triggers force status to `PENDING`.
2. **Review Dashboard**: Super Admins see pending requests in their console dashboard.
3. **Approve Request RPC (`approve_organizer_access_request`)**:
   - Creates the organization record (if not exists).
   - Inserts membership record into `organization_members`.
   - Transitions request status to `APPROVED`.
4. **Reject Request RPC (`reject_organizer_access_request`)**:
   - Rejects access and logs the review reason.

---

## 3. Row-Level Security (RLS) & Triggers Integration

* **Sync Trigger (`trg_handle_new_auth_user`)**: Listens to insertions on `auth.users` to automatically populate corresponding profile rows in `public.admin_users` with a safe conflict policy.
* **RLS Policies**: Re-tested and verified that RLS blocks anonymous users from admin mutations, blocks Organizers from cross-organization actions, and restricts writing audit files to edge routines.

---

## 4. Rate Limiting & Abuse Protections

* **OTP Throttling**: Checked in `supabase/config.toml` under `[auth.rate_limit]`:
  - `token_verifications = 30` (maximum verification attempts per 5 minutes).
  - `sign_in_sign_ups = 30` (throttles new sign-in/up operations).
  - `max_frequency = "1s"` (prevents request spamming).
* **Safe Error Messages**: Error payloads mask details to prevent account enumeration (e.g., returning generic "Invalid or expired verification code" for incorrect OTPs).

---

## 5. Testing & Verification Results

### 5.1 Automated Unit & Integration Tests
* We updated the database test suite [`supabase/migrations/20260814000099_database_tests.sql`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/supabase/migrations/20260814000099_database_tests.sql):
  1. **Sync Profile Trigger**: Verified that adding a record in `auth.users` correctly synchronizes `public.admin_users`.
  2. **Role Fetching**: Verified correct profile schema returned by `get_current_admin_profile()`.
  3. **Access Approval & Rejection**: Verified that Organizers cannot approve requests, while Super Admins can transactionally approve them, creating memberships and organizations correctly.
  4. **Security Log RPC**: Verified that security logs write to `audit_logs` using the proper schema layout.

### 5.2 Verification Commands
* Database reset: `npx supabase db reset` -> **Exited with code 0** (Success).
* TypeScript type checks: `npm run typecheck` -> **Exited with code 0** (Success).
* Production builds: `npm run build:student && npm run build:admin` -> **Exited with code 0** (Success).

---

## 6. Loophole & Security Audit (Second Pass)

* **Adversarial Attacker Simulation**: Tested trying to spoof roles by modifying state properties. The database RPC `get_current_admin_profile()` derives properties directly from JWT ID matching `public.admin_users`, making client modifications harmless.
* **Access Requests Integrity**: Organizers cannot update requests to `APPROVED` on insertion (blocked by trigger and RLS insert checks). Approval and rejection require `public.is_super_admin()` to return true.
* **Audit Trail Security**: Clients cannot modify security logs; the `log_security_event` RPC is read-only for mutations.

---

## 7. Remaining Issues
* **None**. Phase 2 authentication and authorization controls are fully implemented, verified, and complete.
