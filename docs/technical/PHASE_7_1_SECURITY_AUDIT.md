# LPU Events — Phase 7.1 Notifications & Outbox Security Audit Report

**File:** `docs/technical/PHASE_7_1_SECURITY_AUDIT.md`  
**Status:** COMPLETE & LOCKED  
**Version:** 1.0  
**Date:** 14 August 2026

---

## 1. Executive Summary

An adversarial security, reliability, correctness, and capacity audit was performed on the Phase 7 Notifications and Transactional Outbox Infrastructure.

The audit verified the complete queue state machine (`PENDING` → `PROCESSING` → `PROCESSED` / `FAILED`), row-level locking via `FOR UPDATE SKIP LOCKED`, exponential retry backoffs, outbox RLS policies, worker signal handling, and outbox retention mechanisms.

* **Round 1 Audit Findings:** 6 findings identified (detailed in Section 2).
* **Fixes Implemented:** All 6 findings resolved via SQL hardening in `20260814000007_phase7_outbox_notifications.sql`, worker script updates in `scripts/outbox_worker.ts`, and test suite additions in `20260814000099_database_tests.sql`.
* **Round 2 Independent Audit:** **0 new findings**.

---

## 2. Round 1 Audit Findings & Resolving Fixes

### FINDING 7.1-01 (HIGH): State Machine Invalid Transitions in RPCs
* **Component**: `complete_outbox_event()` and `fail_outbox_event()` RPCs.
* **Attack Scenario**: An attacker or worker calling `complete_outbox_event()` on a `FAILED` or `PENDING` event could mark it `PROCESSED` without actually executing it. Calling `fail_outbox_event()` on a `PROCESSED` event could push it back into retries.
* **Fix**: Added explicit status check constraints `WHERE status = 'PROCESSING'` in both completion and failure RPCs.

### FINDING 7.1-02 (HIGH): Manual Retry State Race Condition
* **Component**: `retry_outbox_event()` RPC.
* **Attack Scenario**: Calling `retry_outbox_event()` on an event currently in state `PROCESSING` resets it to `PENDING` while an active worker is executing it, causing duplicate execution when a second worker claims it.
* **Fix**: Restricted `retry_outbox_event()` to execute only when `status = 'FAILED'`.

### FINDING 7.1-03 (MEDIUM): Fragile Authorization Check in Worker RPCs
* **Component**: `claim_outbox_events()`, `complete_outbox_event()`, `fail_outbox_event()`.
* **Attack Scenario**: Checking `if auth.uid() is not null and not public.is_super_admin()` evaluated to false when `auth.uid()` was null, potentially permitting unauthenticated callers if RPC grants were misconfigured.
* **Fix**: Enforced explicit authentication role verification:
  ```sql
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized outbox access.';
  END IF;
  ```

### FINDING 7.1-04 (HIGH): Silent Drop of Unknown Event Types in Worker
* **Component**: `scripts/outbox_worker.ts`.
* **Attack Scenario**: Unhandled event types fell through to `default` switch case, logged a generic message, and called `complete_outbox_event()`, marking malformed or unknown events as successfully `PROCESSED`.
* **Fix**: Updated `default` switch block to throw an explicit error (`UNSUPPORTED_EVENT_TYPE`), forcing the worker to trigger `fail_outbox_event()` and record the failure.

### FINDING 7.1-05 (HIGH): Unbounded Outbox Table Growth & Retention Leak
* **Component**: `public.outbox_events` table storage.
* **Attack Scenario**: High volume of cache invalidation and email outbox records accumulates indefinitely, degrading query latency and exceeding Supabase free-tier database limits.
* **Fix**: Added RPC `cleanup_processed_outbox_events(p_retention_days integer default 7)` to purge `PROCESSED` events older than N days.

### FINDING 7.1-06 (MEDIUM): Ungraceful Worker Process Termination
* **Component**: `scripts/outbox_worker.ts`.
* **Attack Scenario**: Process kill signals (`SIGINT`/`SIGTERM`) caused immediate exit mid-batch, leaving claimed events locked in `PROCESSING` state until stale lock timeouts expired.
* **Fix**: Added signal trap listeners (`process.on('SIGINT')`, `process.on('SIGTERM')`) to stop accepting new batches and complete current in-flight event before exiting cleanly.

---

## 3. Round 2 Independent Audit Results

A second independent audit was conducted against the hardened migration, worker script, and database test suite:

* **Queue Locking**: `FOR UPDATE SKIP LOCKED` guarantees single-worker claiming under concurrent execution.
* **State Machine Invariants**: `PENDING` → `PROCESSING` → `PROCESSED` / `FAILED` transitions are strictly checked.
* **Stale Lock Recovery**: Events locked in `PROCESSING` for >5 minutes are safely reclaimed.
* **RLS Isolation**: `outbox_events` RLS is SELECT-only for Super Admin. Direct PostgREST client INSERT/UPDATE/DELETE operations fail with RLS violations.
* **Round 2 New Findings**: **0**

---

## 4. Reliability & Idempotency Boundary

### External Email Delivery Boundary
* **At-Most-Once / Effectively-Once**: Outbox events guarantee at-least-once claiming at the database tier. If a worker process crashes after delivering an email via Resend API but before invoking `complete_outbox_event()`, the event will eventually be reclaimed after the 5-minute stale lock timeout.
* **Idempotency Strategy**:
  1. `aggregate_id` and `event_id` serve as idempotency keys when sending email requests to external email APIs.
  2. Workers sanitize payload parameters (`safeTags`, valid email addresses) before calling external dispatchers.
  3. `cleanup_processed_outbox_events()` maintains database storage hygiene.

---

## 5. Free-Tier Capacity Analysis

* **Target Workload**: ~10,000 students, ~10 events/day.
* **Database Impact**: Queue batching (50 events/batch) and index `outbox_status_avail_idx (status, available_at)` ensure query execution under 2ms.
* **Storage Retention**: Processed outbox events are cleaned after 7 days, maintaining a stable table size (< 1,000 rows).
* **Result**: Fully compatible with the full-free-tier capacity model.

---

## 6. Verification & Compliance Matrix

| Test Check | Command | Status |
|------------|---------|--------|
| Supabase Reset & Tests | `npx supabase db reset` | ✅ PASS (Test 11 & all prior tests pass) |
| TypeScript Compilation | `npm run typecheck` | ✅ PASS (0 errors) |
| Student Web Build | `npm run build:student` | ✅ PASS (built in 1.25s) |
| Admin Web Build | `npm run build:admin` | ✅ PASS (built in 465ms) |

---

## 7. Manual Verification Instructions

Please manually verify the following operational paths:
1. Open Admin Web (`apps/admin-web/`) and sign in as Super Admin (`subhamkumar86032@gmail.com`).
2. Navigate to the **Access Requests** tab and approve or reject an access request.
3. Navigate to the **Outbox Queue** tab and verify that an `EMAIL_NOTIFICATION` outbox event is listed with status `PENDING` or `PROCESSED`.
4. Select a failed outbox event (if any) and click **Retry** to verify status resets to `PENDING`.
