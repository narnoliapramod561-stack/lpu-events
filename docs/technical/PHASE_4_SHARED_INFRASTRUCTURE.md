# LPU Events — Phase 4 Shared Application Infrastructure & Website Integration Foundation

**File:** `docs/technical/PHASE_4_SHARED_INFRASTRUCTURE.md`  
**Status:** COMPLETE  
**Final Status:** `READY FOR PHASE 5`  
**Date:** 14 August 2026  

---

## 1. Architectural Overview

We established the shared application infrastructure linking the client websites to the Supabase PostgreSQL backend. All communications, structural type definitions, and API queries are unified inside the npm workspace package `@lpu-events/shared`, protecting the client websites from raw table names, manual REST query compilation, or type discrepancies.

```text
                    LPU EVENTS
                         │
              ┌──────────┴──────────┐
              │                     │
       Student Website        Admin Website
              │                     │
              └──────────┬──────────┘
                         │
                  Shared Package (@lpu-events/shared)
                         │
             ┌───────────┴───────────┐
             │                       │
     LpuEventsClient            Shared Types
             │                       │
             └───────────┬───────────┘
                         │
                  Supabase Backend
```

---

## 2. Shared Types Package (`packages/shared/src/types.ts`)

Exposes structural definitions matching custom enums and tables:
* **Enums (String Literal Unions)**: `PlatformAdminRole`, `OrganizationMemberRole`, `AccessRequestStatus`, `EventStatus`, `RegistrationMode`, `EventPricingType`, `MediaType`, `MediaStatus`, `AdvertisementStatus`, `CarouselItemType`.
* **Database Records**: `AdminUser`, `PlatformAdminRoleRecord`, `Organization`, `OrganizationMember`, `OrganizerAccessRequest`, `MediaAsset`, `Event`, `EventContentSection`, `Category`, `Subcategory`, `Advertisement`, `Sponsor`, `EventMemory`, `CarouselItem`.
* **API Payloads**: `PublishEventPayload`, `ContentSectionInput`, `APIError`, `APIResponse<T>`, `AdminProfile`.

---

## 3. Unified API Client Wrapper (`packages/shared/src/client.ts`)

The `LpuEventsClient` class encapsulates the `@supabase/supabase-js` instance:
* **Instantiation**: Initialized with coordinates (`supabaseUrl` and `supabaseAnonKey`), exposing `supabase` properties for auth subscription observers.

### 3.1 Public Read APIs (Student & Feed)
Implicitly appends caching hints (using request `.headers()`) to align with edge CDN caching configurations:
* `fetchCategories()`: Returns categories and active subcategories (`max-age=3600, stale-while-revalidate=1800`).
* `fetchEventFeed(filters)`: Caches feeds matching search parameters (`max-age=300, stale-while-revalidate=180`).
* `searchEvents(queryText, limitCount, offsetCount)`: RPC wrapper for trigram prefix-first matches (`max-age=120, stale-while-revalidate=60`).
* `fetchEventDetails(id)`: Returns full event details with content sections (`max-age=600, stale-while-revalidate=300`).
* `fetchHomepageCarousel()`, `fetchFeaturedEvents()`, `fetchActiveAdvertisements()`, `fetchEventMemories()`, `fetchSponsors()`: Hompepage queries returning structured layouts.

### 3.2 Protected Admin/Organizer APIs (No Cache Headers)
* `submitAccessRequest(orgName, remarks)` / `getAccessRequestStatus()`: Organizer access request lifecycle queries.
* `reviewAccessRequest(requestId, actionStatus, reason)`: Super Admin approval handler.
* `publishEvent(payload, sections)` / `editEvent(id, payload, sections)` / `cancelEvent(id, reason)`: Wraps transactional PostgreSQL RPC mutations.
* `requestMediaUpload(mediaType, mimeType, fileSize)` / `confirmMediaUpload(mediaId)`: Cloud storage ticket registration handshakes.

---

## 4. Website Entrypoints

Unified coordinates are initialized in both websites, ensuring consistent endpoint calls:
* **Admin Website Portal**: [`apps/admin-web/src/supabase.ts`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/apps/admin-web/src/supabase.ts)
* **Student Website Portal**: [`apps/student-web/src/supabase.ts`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/apps/student-web/src/supabase.ts)

Both portals export `lpuClient` (instance of `LpuEventsClient`) and `supabase` (the raw instance to preserve backward compatibility for reactive hook bindings like `onAuthStateChange`).

---

## 5. Verification & Compilation Results

* Local migration: `npx supabase db reset` -> **Exited with code 0** (Schema and RLS tests validated).
* Monorepo compilation checks: `npm run typecheck && npm run lint` -> **Exited with code 0** (Success).
* Production build tests: `npm run build:student && npm run build:admin` -> **Exited with code 0** (Success).
