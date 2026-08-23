# LPU Events — Phase 3.1 API/RPC Security Hardening & Adversarial Audit

**File:** `docs/technical/PHASE_3_1_API_RPC_HARDENING.md`  
**Status:** COMPLETE  
**Auditor Identity:** Antigravity  
**Final Status:** `READY FOR PHASE 4`  
**Date:** 14 August 2026  

---

## 1. Executive Summary

We conducted a comprehensive adversarial security audit and hardening of the LPU Events API / RPC business mutation layer. By executing targeted attacks and patching detected loopholes, we eliminated potential avenues of privilege escalation, IDOR, injection, and unauthorized data mutations.

---

## 2. Hardening Matrix & Audit Results

| Vulnerability Vector | Risk | Audited Mechanism | Hardening Fix / Safeguard | Status |
| :--- | :---: | :--- | :--- | :---: |
| **Direct PostgREST Mutations** | High | Clients bypassing RPC validation by directly calling `POST`, `PATCH`, `DELETE` on base tables. | Dropped `events_org_all` and `event_content_sections_org_all` policies. Replaced them with `SELECT` only RLS. Dropped direct `INSERT` policy on `media_assets`. All writes must now go through `security definer` RPCs. | **RESOLVED** |
| **Media Confirmation IDOR** | High | Organizer B confirming Organizer A's media upload ticket by guessing or scraping the UUID. | Added creator validation in `confirm_media_upload()` comparing the asset's `created_by` against the caller's admin profile UUID. | **RESOLVED** |
| **Malicious URL Injection** | Medium | Injecting `javascript:` protocols or malformed domains into registration CTAs. | Implemented domain and protocol regex matching (`^https?://[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+`) on `external_registration_url` in both publish and edit RPCs. | **RESOLVED** |
| **Duplicate Event Publishes** | Medium | Concurrent double-clicks or forged duplicate events bloating database. | Added constraint query check blocking publishing if an event with the same name, organization, and start time already exists. | **RESOLVED** |
| **Search Resource Exhaustion** | Low | Clients requesting page limits of thousands of rows causing server DoS. | Capped maximum page limits in `search_events()` using `least(limit_count, 50)`. | **RESOLVED** |
| **IDOR Event Updates/Deletes** | High | Organizer B editing or canceling Organizer A's event. | Checked. Event organization is locked at the database level matching the record, verifying caller membership. Direct writes are completely blocked. | **RESOLVED** |
| **Forged Audit Actors** | Medium | Spoofing actor information inside audits. | Checked. All audit trail actor IDs and roles are resolved strictly from database roles linked to `auth.uid()`, ignoring payload parameters. | **RESOLVED** |
| **Pricing & Team Capacities** | Low | Mismatched pricing/team formats. | Added checks returning `PRICING_INVARIANT_VIOLATION` if team formats lack pricing models. | **RESOLVED** |

---

## 3. Detailed Fix Implementations

### 3.1 Restricting Table Permissions to SELECT Only
By default, Supabase creates PostgREST REST endpoints for tables. Previously, organizers had `for all` permissions on `events` and `event_content_sections` tables to update event details. This permitted direct REST mutations. 
We drop these policies and replace them with select-only constraints:
* **Events**: Only allows organizers to read events within their organization via RLS select policy.
* **Content Sections**: Restricts select to sections matching events inside the organizer's active organization.
* **Media Assets**: Restricts direct insertion. All tickets are generated securely via the `request_media_upload` RPC.

### 3.2 Securing Media Confirmations
In `confirm_media_upload(p_media_id)`:
```sql
select status, created_by 
into v_media_status, v_created_by 
from public.media_assets 
where id = p_media_id 
for update;

if v_created_by <> v_admin_id and not public.is_super_admin() then
  return public.set_api_error(403, 'INSUFFICIENT_ORGANIZATION_PERMISSIONS', 'You do not have permission to modify this media asset.');
end if;
```
This blocks any organizer from confirming another user's uploads.

---

## 4. Test Verification Results

We aligned the automated test suite in [`supabase/migrations/20260814000099_database_tests.sql`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/supabase/migrations/20260814000099_database_tests.sql):
1. **Direct Mutation Checks**: Verified that direct SQL updates/inserts by organizers on `events` and `media_assets` return 0 rows or throw RLS policy exceptions.
2. **Malicious URL Blocks**: Verified that publishing an event with an invalid/javascript URL throws `INVALID_URL_FORMAT`.
3. **Duplicate Prevention**: Verified that duplicate event publishers throw `DUPLICATE_EVENT`.
4. **Media Confirm Hijack**: Verified that Organizer One attempting to confirm Organizer Two's upload fails with `403 Forbidden`.

* Reset status: `npx supabase db reset` -> **Exited with code 0** (All test validations passed).
* Production build: `npm run build` -> **Exited with code 0** (Success).
