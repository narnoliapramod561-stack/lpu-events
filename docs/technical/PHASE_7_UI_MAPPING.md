# LPU Events — Phase 7 UI Mapping & Outbox Monitoring Console

**File:** `docs/technical/PHASE_7_UI_MAPPING.md`  
**Status:** PROPOSED — Pending Approval  
**Version:** 1.0  
**Date:** 14 August 2026

---

## 1. Overview

Phase 7 introduces the Super Admin **Outbox & Notification Operations Console** in the Admin Website (`apps/admin-web/`) and integrates outbox monitoring into the existing `SystemHealthPanel`.

The Student Website UI (`apps/student-web/`) is **completely public and unauthenticated** and requires NO direct UI modifications for Phase 7.

---

## 2. Admin Website Component Mapping

### 2.1 Navigation Sidebar (`apps/admin-web/src/components/Sidebar.tsx`)
* **New Navigation Item**: Add `"outbox"` ("Outbox Queue") to the Super Admin section of the sidebar navigation.
* **Icon**: `⚡` or `📬`.
* **Access Control**: Visible ONLY when authenticated role is `SUPER_ADMIN`.

### 2.2 Outbox Events Panel (`apps/admin-web/src/components/superadmin/OutboxEventsPanel.tsx`)
* **Purpose**: Dedicated management interface for inspecting and retrying background outbox events.
* **UI Features**:
  1. **Queue Summary Bar**:
     - `Pending` count badge (orange)
     - `Processing` count badge (blue)
     - `Processed` count badge (green)
     - `Failed` count badge (red)
  2. **Filter Controls**:
     - Filter by Status: `ALL`, `PENDING`, `PROCESSING`, `PROCESSED`, `FAILED`.
     - Filter by Event Type: `ALL`, `CACHE_INVALIDATION`, `EMAIL_NOTIFICATION`, `AUDIT_LOG_ARCHIVE`.
  3. **Events Data Table**:
     - Columns: `Event ID`, `Type`, `Aggregate Type`, `Status`, `Attempts`, `Available At`, `Last Error`, `Actions`.
     - Expandable JSON payload viewer for inspecting event details.
  4. **Actions**:
     - `Retry Event` button: Triggers `lpuClient.retryOutboxEvent(id)` to reset failed event status to `PENDING`.
     - `Process Outbox` button: Triggers background outbox worker execution.

### 2.3 System Health Panel Update (`apps/admin-web/src/components/superadmin/SystemHealthPanel.tsx`)
* **Enhancement**: Add a direct shortcut button on the `Outbox Pending` metric card linking to the new `Outbox Queue` tab.

---

## 3. Product & Technical Invariants Compliance

* **No Student Login**: Student Website remains 100% public.
* **No Ticketing / Checkout**: No payment or ticket generation UI elements added.
* **Email Credentials Protection**: Zero API keys or secrets exposed in Admin Web frontend bundle.
* **RPC Protection**: All queue operations execute via security-definer RPCs on `lpuClient`.
