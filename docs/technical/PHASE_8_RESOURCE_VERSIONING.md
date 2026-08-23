# LPU Events — Phase 8 Resource Versioning & Cache Synchronization Report

**File:** `docs/technical/PHASE_8_RESOURCE_VERSIONING.md`  
**Status:** COMPLETE & LOCKED  
**Version:** 1.0  
**Date:** 14 August 2026

---

## 1. Architecture & Source of Truth

Phase 8 implements canonical **Resource Versioning Infrastructure and Cache Synchronization** for LPU Events:

- **Single Source of Truth**: The PostgreSQL table `public.resource_versions` is the sole authoritative store for resource version counters.
- **Canonical Resource Types (8 Enums)**:
  1. `events`
  2. `categories`
  3. `ads`
  4. `featured`
  5. `memories`
  6. `carousel`
  7. `sponsors`
  8. `settings`
- **Transactional Atomicity**: Resource version increments execute within the exact same database transaction as the underlying mutation via database triggers (`increment_resource_version()`). If a mutation rolls back, the version increment rolls back atomically.

---

## 2. Complete Mutation-to-Resource Mapping Matrix

| Mutation Action / RPC | Target DB Table | Canonical Resource | Trigger Name | Outbox Cache Invalidation Tag |
|---|---|---|---|---|
| `publish_event()`, `edit_event()`, `cancel_event()` | `public.events` | `events` | `trg_events_version_inc` | `['events', 'event:id', 'category:id']` |
| `manage_category()` | `public.categories` | `categories` | `trg_categories_version_inc` | `['categories']` |
| `manage_subcategory()` | `public.subcategories` | `categories` | `trg_subcategories_version_inc` | `['categories']` |
| `manage_advertisement()` | `public.advertisements` | `ads` | `trg_advertisements_version_inc` | `['ads', 'advertisement:id']` |
| `manage_carousel_item()` | `public.carousel_items` | `carousel` | `trg_carousel_items_version_inc` | `['carousel']` |
| `manage_sponsor()` | `public.sponsors` | `sponsors` | `trg_sponsors_version_inc` | `['sponsors']` |
| `manage_memory()` | `public.event_memories` | `memories` | `trg_event_memories_version_inc` | `['memories']` |
| `manage_global_setting()` | `public.global_settings` | `settings` | `trg_global_settings_version_inc` | `['settings']` |

---

## 3. Database RPC & Shared Client Implementation

### Database Migration (`20260814000008_phase8_resource_versioning.sql`)
- **Initial Seeds**: Seeds default rows (`version = 1`) for all 8 canonical resources upon database initialization.
- **RPC `get_resource_versions()`**:
  ```sql
  create or replace function public.get_resource_versions()
  returns table (
    resource public.resource_type,
    version bigint,
    updated_at timestamptz
  ) security definer
  set search_path = pg_catalog, public
  as $$
  begin
    return query
    select rv.resource, rv.version, rv.updated_at
    from public.resource_versions rv
    order by rv.resource asc;
  end;
  $$ language plpgsql;
  ```
- **RLS Policy**: Hardened `resource_versions_public_select` policy grants `SELECT` access to all users (`anon`, `authenticated`), while blocking direct client PostgREST `INSERT`/`UPDATE`/`DELETE` mutations.

### Shared Frontend & Gateway Contracts (`packages/shared/`)
- **TypeScript Contracts (`types.ts`)**:
  - `CanonicalResourceType`: `'events' | 'categories' | 'ads' | 'featured' | 'memories' | 'carousel' | 'sponsors' | 'settings'`
  - `ResourceVersionMap`: `Record<CanonicalResourceType, number>`
  - `ResourceVersionItem`: `{ resource: CanonicalResourceType; version: number; updated_at: string }`
- **Client Method (`client.ts`)**:
  - `lpuClient.getResourceVersions()` returns a strongly-typed `ResourceVersionMap` object.
- **Deterministic Cache Key Utility (`client.ts`)**:
  - `buildVersionedCacheKey(resource, version, suffix)` generates deterministic cache keys (e.g. `public:events:v1042:feed`).

---

## 4. Adversarial Audit Results

### Round 1 Audit
- **Check 1**: Verified that all 8 canonical public resources have associated database triggers.
- **Check 2**: Verified `buildVersionedCacheKey` parameter validation (`version >= 0`).
- **Check 3**: Verified `get_resource_versions()` returns complete version records without exposing write capability.
- **Check 4**: Verified RLS policy blocks direct PostgREST edits on `resource_versions`.

### Round 2 Independent Audit
- **Verification**: Complete audit of all database triggers and RPC paths.
- **New Findings**: **0 new findings**.

---

## 5. Verification Matrix

| Verification Step | Command | Status |
|-------------------|---------|--------|
| Supabase Database Reset | `npx supabase db reset` | ✅ PASS (Test 12 & all 11 prior tests passed) |
| Monorepo Typecheck | `npm run typecheck` | ✅ PASS (0 errors) |
| Student Web Build | `npm run build:student` | ✅ PASS (built in 1.29s) |
| Admin Web Build | `npm run build:admin` | ✅ PASS (built in 475ms) |

---

## 6. Manual Verification Instructions

1. Open Admin Web (`apps/admin-web/`).
2. Log in as Super Admin (`subhamkumar86032@gmail.com`).
3. Update a Category in **Categories** panel or an Advertisement in **Advertisements** panel.
4. Execute `lpuClient.getResourceVersions()` in browser dev tools console and verify that the corresponding version number has incremented.
5. Execute `buildVersionedCacheKey('categories', versions.categories)` and verify key format `public:categories:v<version>`.
