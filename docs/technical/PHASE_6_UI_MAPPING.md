# LPU Events — Phase 6 Admin UI Mapping

**File:** `docs/technical/PHASE_6_UI_MAPPING.md`  
**Status:** COMPLETE  
**Auditor Identity:** Antigravity  
**Date:** 14 August 2026  

This document evaluates the existing UI structure in the admin portal (`apps/admin-web/src/`) and maps its components, states, and operations to the canonical `ADMIN_UI_SPEC.md` and database schema specifications.

---

## 1. Existing Admin Portal Code Audit

| Component / Function | Location in `apps/admin-web/src/` | Behavior & Roles Handled | Database / RPC Bindings |
| :--- | :--- | :--- | :--- |
| `AuthProvider` | `auth.tsx` | Manages authenticated sessions and role-aware admin profiles. | RPC: `get_current_admin_profile`, `log_security_event`. |
| `LoginView` | `App.tsx` | Requests verification code (OTP) and validates it. | Supabase Auth OTP. |
| `AdminDashboard` | `App.tsx` | Main panel with branch renders depending on user authorization status. | Tables: `organizer_access_requests`, `admin_users`. |
| *Super Admin Access Dashboard* | `App.tsx` | Displays list of pending access requests for Super Admins. | RPC: `approve_organizer_access_request`, `reject_organizer_access_request`. |
| *Organizer View* | `App.tsx` | Basic welcome screen with notice: "Organizer event management controls are locked..." | None. |
| *Unapproved User View* | `App.tsx` | Renders the Organizer Access Request submission form and user's past requests. | Table: `organizer_access_requests` (direct inserts). |

---

## 2. Specification Gap Analysis (`ADMIN_UI_SPEC.md` vs Current Code)

### 2.1 Access Request Form Authorization Guard
* **Gap**: Direct inserts into `organizer_access_requests` from the client are currently allowed.
* **Hardening**: Keep mutations going through secure RLS or check validations. The current trigger handles verification. We must ensure unauthenticated users cannot submit. The React state only displays the form if the user is authenticated. This meets the criteria.

### 2.2 Event Management Workspace (Organizer)
* **Gap**: The current Organizer view contains no event management components.
* **Additions Required**:
  * **Organizer Dashboard**: Quick statistics on own events and a list of published/completed events.
  * **Event Form**: Event Creation/Edition interface utilizing `publish_event()` and `edit_event()` RPCs. Fields include Name, Description, Categories, Start/End Timestamps, Venue, Pricing Type, Price Amount, Capacity Limit, and External Registration URL.
  * **Single Event Workspace**: Tabbed layout organizing event details:
    * **Overview**: Details summary.
    * **Registration Info**: List of registration format and capacity data.
    * **Analytics**: Basic mock count charts.
    * **Settings**: Re-edit or Cancellation trigger.
  * **Event Cancellation**: Button to trigger `cancel_event()` RPC.
  * **Ticketing Scope Exclusion**: Strictly omit any screens or components related to Ticket Sales, Ticket Lookup, QR Verification, Ticket Scanner, Payments, Refunds, or internal checkouts.

### 2.3 Super Admin Management Panels
* **Gap**: The current Super Admin view only manages Access Requests. All other administrative panels are missing.
* **Additions Required**:
  * **Access Requests Dashboard**: Renders incoming organizer requests with Approval/Rejection triggers.
  * **Events Management Hub**: Public feed listing all published events, with cancellation hooks (Super Admin can trigger `cancel_event()` on any event).
  * **Carousel Management**: Manage slides for homepage featured events.
  * **Advertisement Management**: Manage sponsored advertisements.
  * **Sponsors**: Manage partner/sponsor entries.
  * **Categories / Subcategories**: Read-only taxonomy overview.
  * **Event Memories**: Manage memory posts.
  * **Global Settings**: Form to view and update settings keys (e.g. `initial_event_limit`, `show_more_increment`, `ad_placement_interval`).
  * **Audit Log Viewer**: Read-only view of `public.audit_logs`.
  * **System Health**: Health panels indicating outbound queue metrics.

---

## 3. Source of Truth & Permission Matrix

| Operation | Authorized Role | Constraint / Method | RLS Restriction |
| :--- | :--- | :--- | :--- |
| **Request Organizer Access** | Authenticated User (No role) | Insert into `organizer_access_requests`. User cannot request `SUPER_ADMIN`. | `auth.uid() = admin_user_id` enforced. |
| **Review Access Requests** | `SUPER_ADMIN` only | RPC: `approve_organizer_access_request` / `reject_organizer_access_request`. | Policies restrict access to Super Admins. |
| **Publish Event** | `ORGANIZER` / `SUPER_ADMIN` | RPC: `publish_event()`. Auto-published. | Direct INSERT blocked on `events`. |
| **Edit Event** | Owner `ORGANIZER` / `SUPER_ADMIN` | RPC: `edit_event()`. | Direct UPDATE blocked on `events`. |
| **Cancel Event** | Owner `ORGANIZER` / `SUPER_ADMIN` | RPC: `cancel_event()`. Hard delete from database. | Direct DELETE blocked on `events`. |
| **Manage Ads & Carousel** | `SUPER_ADMIN` only | Direct write to `advertisements` and `carousel_items`. | Authenticated role RLS block unless Super Admin. |
| **Manage Sponsors & Memories**| `SUPER_ADMIN` only | Direct write to `sponsors` and `event_memories`. | Authenticated role RLS block unless Super Admin. |
| **Manage Global Settings** | `SUPER_ADMIN` only | Update key-value pairs in `global_settings`. | Super Admin write policy enforced. |
| **View Audit Logs** | `SUPER_ADMIN` only | SELECT from `public.audit_logs`. | Super Admin select policy enforced. |

---

## 4. Contradiction Logs
*No design or API spec contradictions found. Schema matches RPC endpoints exactly.*
