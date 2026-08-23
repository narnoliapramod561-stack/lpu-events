# LPU Events — Free-Tier Capacity Planning

**File:** `docs/technical/FREE_TIER_CAPACITY.md`  
**Status:** DRAFT — Requires Review  
**Version:** 1.0  
**Date:** 14 August 2026

---

# 1. Purpose

This document defines the capacity planning analysis for running LPU Events entirely on free-tier infrastructure.

The goal is to mathematically verify that the target workload is sustainable under free-tier quotas, and to define the policies, limits, and degradation strategies required to stay within those quotas.

**This document must be reviewed and approved before implementation begins.**

---

# 2. Target Workload

```text
Target students (MAU)         : 10,000
Peak concurrent users          : ~500 (estimate: 5% of MAU)
Daily active users             : ~3,000 (estimate: 30% of MAU)
New events per day             : ~10
New events per month           : ~300
Active events at any time      : ~50–100
Total events over 12 months    : ~3,600
Admin users (organizers)       : ~20–50
Admin daily active users       : ~5–10
```

---

# 3. Infrastructure Free-Tier Quotas

All values sourced from official pricing pages as of August 2026.

## 3.1 Supabase Free

| Resource | Monthly Quota |
|---|---|
| Monthly Active Users (Auth) | 50,000 MAU |
| Database Size | 500 MB |
| File Storage | 1 GB |
| Egress (uncached) | 5 GB |
| Egress (cached) | 5 GB |
| Edge Function Invocations | 500,000 |
| Realtime Messages | 2,000,000 |
| Realtime Concurrent Connections | 200 |
| API Requests | Unlimited |
| Active Projects | 2 |
| Inactivity Pause | After 1 week of inactivity |

**Sources:** [Supabase Pricing](https://supabase.com/pricing)

### Critical Supabase Constraints

1. **Inactivity Pause.** Free projects pause after 1 week without activity. The project must receive regular requests to stay alive.
2. **Egress is the binding constraint.** 5 GB uncached + 5 GB cached = 10 GB total egress is the most dangerous limit for a public-facing application.
3. **Database size** of 500 MB is generous for this workload but must be monitored.

---

## 3.2 Cloudflare Pages Free

| Resource | Quota |
|---|---|
| Static Asset Requests | Unlimited |
| Static Asset Bandwidth | Unlimited |
| Pages Functions (Workers) Requests | 100,000 / day (shared with Workers) |
| Builds | 500 / month |
| Concurrent Builds | 1 |
| Custom Domains | Unlimited |

**Sources:** [Cloudflare Pages](https://pages.cloudflare.com), [Pages Functions Pricing](https://developers.cloudflare.com/pages/functions/pricing/)

### Critical Cloudflare Pages Constraints

1. **Static requests are free and unlimited.** This is the foundation of the free-tier strategy.
2. **Pages Functions count as Workers requests** — shared 100,000/day limit on the free plan.
3. **Do not use Pages Functions as the primary API gateway.** Reserve Workers budget for cache invalidation triggers and admin operations only.

---

## 3.3 Cloudflare R2 Free

| Resource | Monthly Quota |
|---|---|
| Storage | 10 GB-month |
| Class A Operations (writes) | 1,000,000 |
| Class B Operations (reads) | 10,000,000 |
| Internet Egress | Free (unlimited) |
| Delete Operations | Free |

**Sources:** [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)

### Critical R2 Constraints

1. **Egress is free.** This is why R2 is the correct choice for public media delivery.
2. **10 GB storage** is sufficient only with aggressive image size controls.
3. **Class B operations** (reads/GETs) at 10M/month is generous, but direct R2 reads should still be fronted by Cloudflare cache.

---

# 4. Budget Allocation

## 4.1 Supabase Database Size Budget (500 MB)

### Estimation

```text
Events table:
  ~3,600 events/year × ~2 KB per row = ~7.2 MB

Categories/Subcategories:
  ~50 categories × ~500 B = ~25 KB

Organizations:
  ~50 organizations × ~1 KB = ~50 KB

Advertisements:
  ~100 ads/year × ~1 KB = ~100 KB

Sponsors:
  ~20 sponsors × ~1 KB = ~20 KB

Carousel items:
  ~10 items × ~500 B = ~5 KB

Event Memories:
  ~200 memories/year × ~1 KB = ~200 KB

Audit logs:
  ~5,000 entries/year × ~500 B = ~2.5 MB

Resource versions:
  ~10 entries × ~100 B = ~1 KB

Outbox:
  Transient, cleaned after processing. ~50 KB active at any time.

PostgreSQL indexes and overhead:
  Estimate ~3× raw data size.

Total estimated raw data:  ~10 MB
With indexes and overhead: ~30 MB
```

### Verdict

```text
Budget:   500 MB
Estimate: ~30 MB (first year), growing ~10 MB/year
Margin:   >90%
Status:   ✅ SAFE
```

### Policy

- Monitor database size monthly via Supabase dashboard.
- Archive events older than 18 months to R2 if size exceeds 200 MB.
- Implement audit log rotation: retain 90 days, archive older entries.
- **Alert threshold:** 250 MB (50% of quota).

---

## 4.2 Supabase Egress Budget (10 GB total)

This is the **most critical constraint**.

### Scenario A: Unprotected (Bad Architecture)

```text
10,000 students
× 5 page views/month average
= 50,000 API requests/month

Each homepage API response: ~50 KB (events list, categories, featured, etc.)
Each event detail response:  ~10 KB

50,000 requests × ~40 KB average = ~2 GB/month (API JSON alone)

If images served via Supabase Storage:
  50,000 page views × 3 images × 200 KB = ~30 GB/month

Total: ~32 GB/month
Budget: 10 GB/month
Status: ❌ OVER BUDGET BY 3×
```

### Scenario B: Protected (Correct Architecture)

```text
Student Website → Cloudflare Edge Cache → Supabase (origin, rare)

Cache TTL: 5 minutes for homepage sections
Invalidation: targeted, after admin mutations

Origin requests per cache key:
  ~288 requests/day per cached endpoint (if TTL = 5 min)
  ~8,640/month per endpoint

Cached public endpoints: ~15 (homepage, today, categories, featured, etc.)
Origin API requests: ~15 × 8,640 = ~130,000/month (worst case, no invalidation optimization)

With smart invalidation (purge + regenerate only on mutation):
  10 events/day × ~5 affected cache keys × 30 days = ~1,500 origin requests/month
  + Admin traffic: ~1,000 requests/month
  + Time-based cache expiry for date-dependent content: ~5,000/month
  Total origin requests: ~7,500/month

Each origin response: ~50 KB average
7,500 × 50 KB = ~375 MB/month

Images: served via R2 (free egress), NOT Supabase.

Total Supabase egress: ~375 MB/month
Budget: 10 GB/month
Status: ✅ SAFE — using only ~3.75% of egress budget
```

### Policy

- **NEVER serve images through Supabase Storage to public users.**
- **ALL public API responses must be cacheable at Cloudflare edge.**
- Student Website must NEVER make direct, uncached Supabase requests for public data.
- Admin traffic (authenticated, low volume) goes directly to Supabase — this is acceptable.
- **Alert threshold:** 5 GB egress (50% of total budget).
- **Hard rule:** If egress reaches 7 GB in a billing period, disable non-essential API endpoints (search, memories) and increase cache TTLs.

---

## 4.3 Cloudflare R2 Storage Budget (10 GB-month)

### Estimation

```text
Event banners:
  300 events/year × 1 banner
  Target size after optimization: ≤ 200 KB each
  = 60 MB/year

Sponsor logos:
  20 sponsors × 50 KB = 1 MB

Advertisement banners:
  100 ads/year × 150 KB = 15 MB

Event Memory images:
  200 memories/year × 5 images × 150 KB = 150 MB

Carousel images:
  10 slides × 300 KB = 3 MB

Total year 1: ~229 MB
Total year 2: ~458 MB (cumulative, before archival)
```

### Verdict

```text
Budget:   10 GB
Estimate: ~230 MB/year, ~460 MB/2 years
Margin:   >95% in year 1
Status:   ✅ SAFE
```

### Image Size Policy (ENFORCED)

| Image Type | Max File Size | Max Dimensions | Format |
|---|---|---|---|
| Event Banner | 500 KB | 1200×630 px | WebP/JPEG |
| Sponsor Logo | 100 KB | 400×400 px | WebP/PNG |
| Advertisement Banner | 300 KB | 1200×400 px | WebP/JPEG |
| Event Memory Photo | 300 KB | 1200×800 px | WebP/JPEG |
| Carousel Image | 500 KB | 1920×800 px | WebP/JPEG |

**Enforcement:**

```text
Admin upload
    ↓
Client-side validation (file size + dimensions)
    ↓
Server-side validation (reject oversized)
    ↓
Resize/compress to target dimensions
    ↓
Convert to WebP where supported
    ↓
Store in R2
```

- Original uploads exceeding the max file size MUST be rejected.
- Admin UI must show real-time file size feedback during upload.
- **Alert threshold:** 5 GB storage (50% of quota).
- **Archival policy:** Event memories older than 12 months should be reviewed for deletion or moved to Infrequent Access.

---

## 4.4 R2 Operations Budget

### Class A (Writes): 1,000,000/month

```text
Uploads: ~50/day = ~1,500/month
Deletes: Free
Estimate: ~1,500/month
Budget:   1,000,000/month
Status:   ✅ SAFE (using 0.15%)
```

### Class B (Reads): 10,000,000/month

```text
With Cloudflare caching in front of R2:
  Cache hit rate target: >95%
  Total student image requests: 50,000 page views × 3 images = 150,000
  Cache misses (5%): ~7,500 R2 reads/month

Admin reads: ~500/month

Total: ~8,000/month
Budget: 10,000,000/month
Status: ✅ SAFE (using 0.08%)
```

---

## 4.5 Cloudflare Pages Functions Budget (100,000/day)

### Strategy: Minimize Functions Usage

The Student Website is a static SPA. It should NOT use Pages Functions for API proxying.

```text
Functions usage:
  Cache invalidation triggers (admin-initiated): ~50/day
  Admin API proxy (if needed): ~200/day
  Health check / keep-alive: ~10/day

Total: ~260/day
Budget: 100,000/day
Status: ✅ SAFE (using 0.26%)
```

### Policy

- Student Website: Pure static SPA. No Functions.
- Admin Website: May use minimal Functions for cache purge triggers.
- **Do NOT route student traffic through Pages Functions.**

---

## 4.6 Supabase Edge Functions Budget (500,000/month)

### Strategy: Use Sparingly

```text
Outbox processor invocations: ~50/day × 30 = ~1,500/month
Cache invalidation webhooks: ~50/day × 30 = ~1,500/month
Media processing triggers: ~50/day × 30 = ~1,500/month

Total: ~4,500/month
Budget: 500,000/month
Status: ✅ SAFE (using 0.9%)
```

### Policy

- Use Edge Functions only for server-side orchestration that cannot be done via RPC/RLS.
- Do NOT use Edge Functions as a general-purpose API layer for public traffic.

---

## 4.7 Supabase Realtime Budget

### Strategy: Remove from Student Website

```text
Realtime Messages:    2,000,000/month
Concurrent Connections: 200

Student Website: 0 messages, 0 connections (Realtime disabled)
Admin Website:   Optional, limited to admin dashboard live updates

Admin estimate:
  10 active admins × 100 messages/day × 30 = 30,000/month
  Concurrent: ≤10

Budget utilization: ~1.5%
Status: ✅ SAFE
```

### Policy

- **Realtime is NOT used on the Student Website.**
- Admin Website may optionally use Realtime for dashboard live indicators.
- If Realtime is enabled for Admin, enforce connection limits.

---

## 4.8 Supabase Auth Budget (50,000 MAU)

### Usage

```text
Students: 0 MAU (Student Website is anonymous/public)
Admins:   ~50 MAU

Total: ~50 MAU
Budget: 50,000 MAU
Status: ✅ SAFE (using 0.1%)
```

---

# 5. Inactivity Pause Prevention

Supabase Free projects pause after **1 week of inactivity**.

### Strategy

```text
Option A: Cloudflare cron trigger (if using Workers)
  - Schedule a lightweight health-check request every 6 days
  - Calls a simple Supabase endpoint (e.g., SELECT 1)

Option B: GitHub Actions cron
  - Weekly cron job pings the Supabase API
  - Free within GitHub Actions limits

Option C: Natural traffic
  - With 10,000 students, daily traffic is virtually guaranteed
  - Cache misses will naturally hit Supabase origin
```

### Policy

- Implement Option B (GitHub Actions cron) as the safety net.
- Natural traffic (Option C) should be sufficient in practice.
- Monitor for inactivity warnings in Supabase dashboard.

---

# 6. Cache Architecture Rules (Free-Tier Specific)

## 6.1 Student Website Data Flow

```text
Student Browser
      ↓
Cloudflare Pages (static SPA assets — free, unlimited)
      ↓
SPA loads, requests public data APIs
      ↓
Cloudflare Edge Cache (CDN — free, unlimited for cached responses)
      ↓
CACHE HIT → return immediately (zero Supabase cost)
CACHE MISS → fetch from Supabase origin → cache → return
```

## 6.2 Cache TTL Strategy

| Resource | Cache TTL | Invalidation |
|---|---|---|
| Homepage Carousel | 10 min | On mutation |
| Happening Today | 5 min | On mutation + midnight rollover |
| Featured Events | 10 min | On mutation |
| Categories | 1 hour | On mutation |
| Event Listings | 5 min | On mutation |
| Event Detail | 10 min | On mutation |
| Advertisements | 10 min | On mutation |
| Sponsors | 1 hour | On mutation |
| Event Memories | 30 min | On mutation |
| Search Results | 2 min | TTL-only (no targeted invalidation) |
| Static Assets (JS/CSS) | 1 year | Content hash in filename |
| Media (images) | 1 year | Immutable filename |

## 6.3 No Client-Side Polling

```text
❌ BAD: 10,000 browsers polling /api/events_version every 30 seconds
   = 10,000 × 2/min × 60 min × 24 hr = 28,800,000 requests/day

✅ GOOD: Cloudflare edge serves cached response
   Origin sees: ~1 request per TTL expiry per edge location
```

### Rule

> **The Student Website MUST NOT implement client-side polling for data freshness.**

Instead, use:

1. **Cloudflare edge TTL expiry** — natural revalidation.
2. **Admin-triggered cache invalidation** — targeted purge after mutations.
3. **Stale-while-revalidate** — serve stale content while fetching fresh in background.

---

# 7. Version-Based Synchronization (Revised for Free Tier)

The existing resource version system is retained in the database as an internal mechanism.

However, the Student Website **does not poll version endpoints**.

### Revised Flow

```text
Admin publishes event
    ↓
Database transaction (includes resource_version increment)
    ↓
Outbox entry created (same transaction)
    ↓
Outbox processor (Edge Function or cron) fires
    ↓
Cloudflare cache purge for affected cache keys
    ↓
Next student request gets fresh data from origin
    ↓
Cloudflare re-caches the fresh response
```

Resource versions are used for:

- Admin dashboard staleness detection (admin-only).
- Internal cache key versioning (server-side).
- Conditional response headers (ETag/If-None-Match).

Resource versions are **NOT used for**:

- Client-side polling from student browsers.

---

# 8. Media Delivery Architecture (Free-Tier Specific)

```text
❌ BAD:
  Student → Supabase Storage → Image
  (costs Supabase egress)

✅ GOOD:
  Student → Cloudflare CDN → R2 → Image
  (R2 egress is free, Cloudflare CDN is free)
```

### Implementation

1. Media is stored in Cloudflare R2.
2. R2 bucket is configured as a public bucket behind a custom domain or Cloudflare-managed URL.
3. Cloudflare automatically caches R2 objects at the edge.
4. Students never touch R2 directly in most cases — they get Cloudflare-cached copies.

### Supabase Storage Role

Supabase Storage (1 GB free) is **not used** for public media delivery.

It may be used for:

- Temporary admin upload staging (if needed).
- Internal-only files (admin exports, etc.).

All public-facing media goes through R2.

---

# 9. What Happens Near Quota

## 9.1 Monitoring Thresholds

| Resource | Green | Yellow | Red | Critical |
|---|---|---|---|---|
| Supabase DB Size | < 125 MB | 125–250 MB | 250–400 MB | > 400 MB |
| Supabase Egress | < 2.5 GB | 2.5–5 GB | 5–7.5 GB | > 7.5 GB |
| R2 Storage | < 2.5 GB | 2.5–5 GB | 5–8 GB | > 8 GB |
| R2 Class B Ops | < 2.5M | 2.5–5M | 5–8M | > 8M |
| Workers/Functions | < 25K/day | 25–50K/day | 50–80K/day | > 80K/day |

## 9.2 Degradation Strategy

When approaching quota limits:

### Yellow (50% used)

- Increase cache TTLs by 2×.
- Review and remove unnecessary API calls.
- Audit image sizes for oversized uploads.

### Red (75% used)

- Increase cache TTLs to maximum acceptable values.
- Disable search result caching refresh (serve stale).
- Reduce Event Memories image count limits.
- Disable non-essential background jobs.

### Critical (90% used)

- Switch Student Website to fully static fallback mode.
- Serve pre-generated static JSON snapshots instead of live API.
- Disable all non-essential features (memories, search suggestions).
- Admin creates manual static export of critical data.

---

# 10. Features Disabled First (Priority Order)

If quota pressure requires feature reduction:

```text
1. Search suggestions / autocomplete  (high request volume, low criticality)
2. Event Memories gallery             (high storage, medium criticality)
3. Advertisement rotation             (medium request volume, low criticality)
4. Realtime admin updates             (Realtime messages, low criticality)
5. Past Events browsing               (medium request volume, low criticality)
6. Sponsor section                    (low criticality)
```

**Never disable:**

```text
- Homepage event listing
- Event detail pages
- Category browsing
- External registration links
```

These are the core product functions.

---

# 11. Rate Limiting (Free-Tier Protection)

### Supabase API

- Rely on Supabase's built-in rate limiting for the free tier.
- All public requests go through Cloudflare cache first.

### Cloudflare

- Use Cloudflare's free-tier security rules:
  - Bot protection.
  - Basic rate limiting (free tier allows limited rules).
  - IP-based throttling for abusive patterns.

### Application-Level

- Student Website: No user-initiated API calls should bypass the cache layer.
- Admin Website: Rate limit login attempts (Supabase Auth built-in).

---

# 12. Sustainability Verdict

| Dimension | Budget | Estimated Usage | Utilization | Verdict |
|---|---|---|---|---|
| Supabase DB Size | 500 MB | ~30 MB (year 1) | 6% | ✅ Sustainable |
| Supabase Egress | 10 GB | ~375 MB/month | 3.75% | ✅ Sustainable |
| Supabase Auth MAU | 50,000 | ~50 | 0.1% | ✅ Sustainable |
| Supabase Edge Functions | 500,000 | ~4,500 | 0.9% | ✅ Sustainable |
| R2 Storage | 10 GB | ~230 MB (year 1) | 2.3% | ✅ Sustainable |
| R2 Class A Ops | 1,000,000 | ~1,500 | 0.15% | ✅ Sustainable |
| R2 Class B Ops | 10,000,000 | ~8,000 | 0.08% | ✅ Sustainable |
| CF Pages Functions | 100,000/day | ~260/day | 0.26% | ✅ Sustainable |
| CF Static Requests | Unlimited | N/A | 0% | ✅ Unlimited |

### Overall Verdict

> **The workload of 10,000 students + 10 events/day is sustainable on free-tier infrastructure**, provided the following architectural rules are strictly enforced:
>
> 1. Student Website is a static SPA served via Cloudflare Pages.
> 2. All public data is served through Cloudflare edge cache, NOT direct Supabase calls.
> 3. All public images are served through Cloudflare R2, NOT Supabase Storage.
> 4. No client-side polling from student browsers.
> 5. Cache invalidation is admin-mutation-triggered, not continuous.
> 6. Image uploads are size-validated and compressed before storage.
> 7. Realtime is disabled on the Student Website.

---

# 13. Architectural Rules Summary (Locked for Free Tier)

## Rule 1: Student Website = Static SPA + Edge Cache

```text
Student → Cloudflare Pages (static) → Cloudflare CDN (cached API) → Supabase (rare origin)
```

## Rule 2: Images via R2, Never Supabase Storage

```text
Admin → Upload → Validate/Compress → R2 → Cloudflare Cache → Students
```

## Rule 3: No Client-Side Polling

```text
Data freshness is managed by server-side cache invalidation, not client polling.
```

## Rule 4: No Realtime on Student Website

```text
Students get fresh data via cache expiry/invalidation, not WebSocket subscriptions.
```

## Rule 5: Minimal Workers/Functions Usage

```text
Static requests = free, unlimited.
Functions requests = counted against 100K/day.
Keep student traffic as static requests.
```

## Rule 6: Admin Traffic is Acceptable Direct-to-Supabase

```text
Admin user count is tiny (~10 DAU).
Admin traffic volume is negligible compared to student traffic.
Admin can call Supabase directly without cache layer concerns.
```

## Rule 7: Enforce Image Size Limits

```text
No image exceeding 500 KB for banners, 300 KB for other types.
Client + server validation.
WebP preferred.
```

---

# 14. Existing Document Impact

The following existing documents need revisions based on this capacity analysis:

### SYSTEM_ARCHITECTURE.md

- Update Section 4 (High-Level Architecture) diagram to reflect the Cloudflare edge cache layer between Student Website and Supabase.
- Update Section 114 (Realtime) to explicitly state Realtime is disabled for Student Website.
- Update Section 115 (Version-Based Sync) to clarify versions are server-side only, not client-polled.
- Clarify that Supabase Storage is not used for public media delivery.

### CACHING_ARCHITECTURE.md

- Update Section 32 (Synchronization Flow) to remove client-initiated version polling.
- Add explicit free-tier cache TTL values from this document.
- Add stale-while-revalidate strategy documentation.
- Add section on Cloudflare-specific cache purge integration.

### TECH_STACK.md

- Clarify that Cloudflare R2 is the **only** public media delivery mechanism.
- Note that Supabase Storage is reserved for internal/admin use only.
- Document Cloudflare Pages Functions usage constraints.

### API_CONTRACTS.md

- Ensure all public API responses include Cache-Control headers.
- Document ETag/If-None-Match support for conditional requests.
- Remove any version-polling endpoints from public API surface.

---

# 15. Pre-Implementation Checklist

Before beginning implementation, confirm:

- [ ] This document has been reviewed and approved by the project owner.
- [ ] Free-tier accounts have been created: Supabase, Cloudflare.
- [ ] R2 bucket has been created and configured as public.
- [ ] Cloudflare Pages projects created for student-web and admin-web.
- [ ] Image size validation requirements are understood by all contributors.
- [ ] Existing architecture documents have been updated per Section 14.
- [ ] Inactivity prevention mechanism is planned (GitHub Actions cron).
- [ ] Monitoring approach is defined (Supabase dashboard + Cloudflare analytics).
- [ ] Degradation strategy is understood and accepted.
- [ ] No premium/paid services are required for the initial deployment.

---

# 16. Revision Policy

This document should be re-evaluated:

- When Supabase or Cloudflare changes free-tier quotas.
- When user count exceeds 15,000 MAU.
- When event volume exceeds 30 events/day.
- When any resource reaches the Yellow threshold.
- Before any architectural change that introduces new external service calls.
