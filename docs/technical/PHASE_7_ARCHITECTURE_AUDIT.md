# LPU Events — Phase 7 Architecture Audit & Notification System Specification

**File:** `docs/technical/PHASE_7_ARCHITECTURE_AUDIT.md`  
**Status:** PROPOSED — Pending Approval  
**Version:** 1.0  
**Date:** 14 August 2026

---

## 1. Executive Summary

Phase 7 establishes the **Transactional Outbox Engine, Notification Infrastructure, and Background Queue Management** for LPU Events.

The primary objective is to process asynchronous side effects—such as Cloudflare Edge cache invalidation, email notifications for organizer access request decisions, and system alerts—reliably and transactionally without calling external APIs directly inside database transactions.

---

## 2. Phase 7 Scope & Infrastructure Requirements

### 2.1 Scope & Boundaries
* **Transactional Outbox Core**: Standardized processing pipeline for `outbox_events` using row-level database locking (`FOR UPDATE SKIP LOCKED`).
* **Outbox Consumers**:
  1. `CACHE_INVALIDATION`: Processes cache invalidation tags for Cloudflare Edge Cache.
  2. `EMAIL_NOTIFICATION`: Dispatches email notifications for access request approvals/rejections and system alerts.
* **Super Admin Queue Console**: UI panel in Admin Web (`OutboxEventsPanel.tsx`) to monitor outbox event status (`PENDING`, `PROCESSING`, `PROCESSED`, `FAILED`), view payloads and error backtraces, and retry failed outbox events.
* **Access Request Email Integration**: Transactional enqueuing of email notification outbox events inside `review_access_request()` RPC.

### 2.2 Reused Infrastructure
* `public.outbox_events` table (created in Phase 1 database foundation).
* `public.background_jobs` table (created in Phase 1 database foundation).
* `public.audit_logs` and `public.resource_versions` triggers.
* Phase 6 Admin Web layout, sidebar navigation, and `lpuClient` API client wrappers.

### 2.3 New Infrastructure Required
* Migration `20260814000007_phase7_outbox_notifications.sql`:
  - RPC `claim_outbox_events(p_batch_size integer)`
  - RPC `complete_outbox_event(p_event_id uuid)`
  - RPC `fail_outbox_event(p_event_id uuid, p_error_message text)`
  - RPC `retry_outbox_event(p_event_id uuid)`
  - Updated `review_access_request()` RPC to enqueue email notification outbox events.
  - Hardened RLS policies for `outbox_events` (SELECT-only for Super Admin, zero direct client mutations).
* Edge Function / Background Worker `scripts/outbox_worker.ts` (or `supabase/functions/process-outbox/index.ts`) for outbox event dispatch.
* Client method `lpuClient.retryOutboxEvent(id)` and `lpuClient.getOutboxEvents(...)`.
* Admin Web UI component `apps/admin-web/src/components/superadmin/OutboxEventsPanel.tsx`.

---

## 3. Database & Security Model

### 3.1 RLS Policy Matrix for `outbox_events`

| Role | Operation | Policy Condition | Result |
|------|-----------|------------------|--------|
| Anonymous | ALL | None | **BLOCKED** |
| Organizer | ALL | None | **BLOCKED** |
| Super Admin | SELECT | `is_super_admin()` | **ALLOWED** |
| Super Admin | INSERT/UPDATE/DELETE | None | **BLOCKED** (Must use SECURITY DEFINER RPCs) |

### 3.2 Queue State Machine & Self-Healing
```text
  Pending Event (status = 'PENDING')
         │
         ▼ (claim_outbox_events with FOR UPDATE SKIP LOCKED)
  Processing State (status = 'PROCESSING', started_at = now())
         ├── Success → complete_outbox_event() → status = 'PROCESSED', processed_at = now()
         └── Failure → fail_outbox_event()
                          ├── attempt_count < 5  → status = 'PENDING', available_at = now() + (attempt_count^2 * 5s)
                          └── attempt_count >= 5 → status = 'FAILED', last_error recorded
```
* **Stale Lock Self-Healing**: `claim_outbox_events()` automatically reclaims any events stuck in `PROCESSING` state for longer than 5 minutes, ensuring queue recoverability in case of worker process crashes.

---

## 4. Adversarial Loophole Review

### Round 1 Audit Findings & Resolving Designs

| # | Finding | Severity | Resolution / Fix Design |
|---|---------|----------|-------------------------|
| 1 | **Direct Outbox Forgery**: Direct client inserts on `outbox_events` could allow forged cache clears or email spam. | **HIGH** | Enforce RLS on `outbox_events` to BLOCK direct PostgREST mutations. Restrict insertions to trusted database RPCs. |
| 2 | **Missing Access Request Email Notification**: Access request reviews updated status but sent no email notification. | **HIGH** | Update `review_access_request()` RPC to transactionally enqueue an `EMAIL_NOTIFICATION` outbox event. |
| 3 | **Stale Processing Lock Hangs**: Worker crashes leave events permanently stuck in `PROCESSING`. | **MEDIUM** | Add stale lock timeout (>5 mins) in `claim_outbox_events()` to auto-reclaim stuck events. |
| 4 | **Credential Exposure Risk**: Email provider API keys could leak if handled client-side. | **HIGH** | Email operations execute strictly server-side in workers/Edge Functions using server environment variables. |
| 5 | **Duplicate Email Dispatch**: Retries might resend identical email bodies multiple times. | **MEDIUM** | Implement idempotency checking in outbox consumers using `event_id` and atomic state updates. |

### Round 2 Independent Adversarial Audit Result
* **Audit of Fixes**: All 5 findings were systematically neutralized by the security-definer RPCs, RLS hardening, and server-side worker architecture.
* **New Findings**: **0**

---

## 5. Free-Tier Capacity Analysis

* **Queue Batch Size**: 50 items per processing run.
* **Worker Execution**: Interval-based polling or event-driven invocation, using minimal CPU/Memory on Supabase free tier.
* **Email Delivery**: Uses free-tier Resend / SMTP configuration (or local dev logging mode), easily handling ~10 new events and access requests per day.
* **Result**: 100% compatible with the full-free-tier capacity model (~10,000 students, 10 events/day).

---

## 6. Manual Verification Requirements

After implementation, the following must be manually verified:
1. `npx supabase db reset` applies cleanly and passes all database tests.
2. `npm run typecheck` passes with zero errors.
3. `npm run build:admin` & `npm run build:student` build successfully.
4. Super Admin can view outbox queue metrics and trigger manual retries on failed outbox events in `OutboxEventsPanel`.
5. Approving an access request in `AccessRequestsPanel` transactionally creates an `EMAIL_NOTIFICATION` outbox event.
