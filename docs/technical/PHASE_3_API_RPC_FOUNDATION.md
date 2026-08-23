# LPU Events — Phase 3 API/RPC Business Logic Foundation

**File:** `docs/technical/PHASE_3_API_RPC_FOUNDATION.md`  
**Status:** COMPLETE  
**Final Status:** `READY FOR PHASE 4`  
**Date:** 14 August 2026  

---

## 1. Implemented API/RPC Operations

We implemented the complete set of transactional Remote Procedure Calls (RPCs) required to mediate secure access between client applications and database tables:
1. **`set_api_error(p_status, p_code, p_message, p_details)`**: Sets the GUC `response.status` to customize PostgREST HTTP status code overrides and formats standard JSON error envelopes.
2. **`search_events(query_text, limit_count, offset_count)`**: Case-insensitive prefix-first query matching. Exact matches are ranked 1, starting prefixes ranked 2, general contains ranked 3.
3. **`review_access_request(request_id, action_status, reason)`**: Super-Admin-only transactional workflow mapping memberships.
4. **`publish_event(p_event_payload, p_content_sections)`**: Validates invariants, generates stable event UUID, inserts records, writes audit logs, increments versions, and inserts cache invalidation outbox events.
5. **`edit_event(p_event_id, p_event_payload, p_content_sections)`**: Replaces content sections and updates events under owner authorization.
6. **`cancel_event(p_event_id, p_reason)`**: Hard-deletes event and sections, logs cancellation, and inserts invalidation outbox records.
7. **`request_media_upload(p_media_type, p_mime_type, p_file_size_bytes, p_width, p_height)`**: Creates `UPLOADING` ticket and generates mock secure R2 PUT upload credentials.
8. **`confirm_media_upload(p_media_id)`**: Sets status to `READY` and updates validation times.

---

## 2. Authentication & Authorization Rules

* **Unauthenticated Access**: Restricted strictly to read-only queries (discovery hub feed, category taxonomy, active ads, Carousel, sponsors) and the `search_events()` function.
* **Organizer Authorization**: Event mutations require active membership in the organization owning the event (`public.organization_members`).
* **Super Admin Override**: Super Admins bypass organization membership checks globally and are the only roles authorized to execute `review_access_request()`.

---

## 3. Business Invariant Validations (Server-Side)

All business rules are validated inside RPC procedures before write execution:
* **Taxonomy Match**: `subcategory_id` must belong to `category_id`.
* **Date Bounds**: `end_at > start_at` and `registration_closes_at > registration_opens_at`.
* **Registration Mode**: `external_registration_url` is required if and only if mode is `EXTERNAL`.
* **Pricing Invariants**: PAID events require a positive `price_amount`; FREE events cannot have a positive amount.
* **Media Check**: The `banner_media_id` must exist and be in a `READY` state.

---

## 4. Transaction Boundaries & Asynchronous Flow

Every mutation executes in a single atomic transaction:
```text
BEGIN TRANSACTION
  1. Authenticate caller & verify organization membership.
  2. Validate invariants (returns error payload if invalid).
  3. Lock parent row (for update/delete).
  4. Perform CRUD mutations (events, content sections).
  5. Write row to public.audit_logs.
  6. Write row to public.outbox_events.
  7. increment_resource_version() trigger executes automatically.
COMMIT TRANSACTION
```
If any database constraint or check function fails, the entire transaction is rolled back, preventing orphaned records.

---

## 5. Audit & Outbox Cache Invalidation

* **Audit Logs**: Populated with transaction details (actor ID, actor role, before/after snapshots). Direct writes are blocked by RLS policies; inserts happen securely via definer functions.
* **Outbox Cache Purges**: Inserts `CACHE_INVALIDATION` events with dependency tags: `['events', 'event:<id>', 'category:<cat_id>', 'subcategory:<subcat_id>']`.

---

## 6. Security Audit & Fixes

### 6.1 Media Upload Hardening Bypass
* **Vulnerability**: The inherited database trigger `process_media_asset_changes` blocked all updates to `media_assets` for non-Super Admins, making it impossible for Organizers to confirm their own uploads.
* **Fix**: Hardened the trigger in [`20260814000002_database_hardening.sql`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/supabase/migrations/20260814000002_database_hardening.sql) to permit Organizers to transition status from `UPLOADING` to `READY` on their own assets, while verifying that all other fields (bucket, key, size, etc.) remain unchanged to block injection tampering.

### 6.2 Null Venue Constraint
* **Finding**: The automated test suite crashed due to missing `venue_name` parameters in JSON test payloads.
* **Fix**: Added `venue_name` parameters to all mock JSON payloads in the unit tests suite.

### 6.3 Test Assertions RLS Swapping
* **Finding**: Test validations for `audit_logs` and `outbox_events` returned 0 records when queried under the Organizer role due to correct RLS restriction blocks.
* **Fix**: Updated [`20260814000099_database_tests.sql`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/supabase/migrations/20260814000099_database_tests.sql) to temporarily switch execution role to `postgres` when asserting audit logs and outbox rows, restoring permissions back to Organizer afterward.

---

## 7. Verification Results
* Database reset: `npx supabase db reset` -> **Exited with code 0** (Success).
* TypeScript type checks: `npm run typecheck` -> **Exited with code 0** (Success).
* Production builds: `npm run build:student && npm run build:admin` -> **Exited with code 0** (Success).
