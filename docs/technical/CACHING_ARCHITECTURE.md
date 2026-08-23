# LPU Events — Caching Architecture

**File:** `docs/technical/CACHING_ARCHITECTURE.md`  
**Status:** LOCKED — Caching Baseline  
**Version:** 1.1  
**Date:** 14 August 2026

---

# 1. Purpose

This document defines the caching architecture for LPU Events.

The caching system is designed to:

- Reduce database load.
- Improve Student Website response times.
- Reduce repeated computation.
- Improve scalability during event spikes.
- Keep public content fresh.
- Prevent stale content from surviving beyond acceptable limits.
- Avoid caching private or user-specific data.
- Support targeted invalidation rather than full-site cache clears.

Caching is an optimization layer.

**PostgreSQL remains the source of truth.**

If every cache disappears, the platform must continue functioning by reading from the source of truth.

---

# 2. Core Principle

The architecture follows:

```text
PostgreSQL
    ↓
Authoritative data
    ↓
Cache generation
    ↓
Cloudflare Edge Cache
    ↓
Student Browser
```

The cache never becomes authoritative.

The correct mental model is:

```text
Database = Truth
Cache    = Derived representation
```

---

# 3. Scope

This caching architecture primarily applies to the **Student Website**.

The Admin Website is mostly dynamic and authenticated.

Admin responses must not be placed into shared public CDN caches.

Private/admin caching may be introduced later only when:

* Authorization isolation is guaranteed.
* Cache keys are user/scope-specific.
* There is a measurable performance requirement.

Until then:

> **Do not cache private Admin Website data at shared edge level.**

---

# 4. Applications

The platform contains:

```text
Student Website
Admin Website
```

Caching behavior differs substantially.

## Student Website

Public, read-heavy, cache-friendly.

## Admin Website

Authenticated, mutation-heavy, authorization-sensitive.

Therefore:

```text
Student Website → aggressive public caching
Admin Website   → minimal/private caching
```

---

# 5. Cache Layers

The architecture has multiple cache layers:

```text
┌───────────────────────────┐
│ Browser Cache             │
└─────────────┬─────────────┘
              ↓
┌───────────────────────────┐
│ Cloudflare Edge Cache     │
└─────────────┬─────────────┘
              ↓
┌───────────────────────────┐
│ Application/API Cache     │
└─────────────┬─────────────┘
              ↓
┌───────────────────────────┐
│ PostgreSQL                │
│ Source of Truth           │
└───────────────────────────┘
```

Not every request must pass through every layer.

---

# 6. Cache Authority

Only PostgreSQL determines whether content exists and what its current state is.

Examples:

If an event is deleted:

```text
PostgreSQL → deleted
```

then caches must eventually remove it.

If an advertisement expires:

```text
PostgreSQL → expired
```

then the expired advertisement must not continue appearing merely because a cache entry exists.

---

# 7. What Should Be Cached

The following public resources are cacheable:

* Homepage sections.
* Published event lists.
* Published event detail pages.
* Categories.
* Subcategories.
* Public advertisements.
* Advertisement placement configuration.
* Featured events.
* Public carousel.
* Public sponsors.
* Public Event Memories.
* Search results for short periods.
* Resource-version metadata.
* Public static assets.

---

# 8. What Must NOT Be Publicly Cached

Never put the following into a shared public cache:

* Admin dashboard data.
* Organizer data.
* Organization membership.
* Access requests.
* Audit logs.
* Admin identity data.
* Private media metadata.
* Outbox records.
* Background-job data.
* Backup information.
* Internal configuration/secrets.
* User-specific state.
* Authentication responses.
* Authorization decisions.
* Any response containing private data.

---

# 9. Student Website Cache Strategy

The Student Website uses **dependency-based, tag-driven caching**.

Do not use:

```text
clear entire cache
```

for every mutation.

Instead:

```text
Mutation
   ↓
Determine affected dependencies
   ↓
Invalidate only affected cache tags
   ↓
Regenerate affected resources
```

---

# 10. Cache Domains

The primary cache domains are:

```text
homepage
featured
today
tomorrow
this_week
past_events
events
event_detail
categories
subcategories
advertisements
sponsors
carousel
memories
search
```

Each domain has its own cache dependency.

---

# 11. Homepage Section Caching

Homepage sections must be cached independently.

Example:

```text
Homepage
├── Hero Carousel
├── Advertisement
├── Happening Today
├── Categories
├── Featured
├── This Week
├── Sponsors
└── Events Hub
```

A change to sponsors must not force regeneration of the entire homepage.

---

# 12. Why Independent Sections Matter

Suppose a Super Admin changes a sponsor.

Bad architecture:

```text
Sponsor update
    ↓
Clear homepage
    ↓
Regenerate everything
```

Better architecture:

```text
Sponsor update
    ↓
Invalidate sponsors
```

This minimizes:

* Database queries.
* Cache regeneration.
* Edge traffic.
* Origin CPU.
* Latency.

---

# 13. Event Detail Caching

Each published event has its own cache representation.

Conceptually:

```text
event:{event_id}
```

Example:

```text
event:550e8400-e29b-41d4-a716-446655440000
```

An event update invalidates only that event's detail cache plus dependencies that actually contain that event.

---

# 14. Event List Dependencies

An event may appear in multiple cached collections.

Example:

```text
Event A
   ├── event_detail:A
   ├── today
   ├── this_week
   ├── category:technology
   ├── subcategory:ai
   └── search:artificial-intelligence
```

Therefore event mutations must invalidate all relevant dependencies.

---

# 15. Dependency Map

The system maintains a centralized dependency model.

Conceptually:

```text
event A
 ├── detail:A
 ├── today
 ├── this_week
 ├── category:X
 ├── subcategory:Y
 └── search indexes/results
```

The dependency map must be deterministic.

Do not rely on developers remembering every cache key manually.

---

# 16. Cache Tags

Resources should carry logical tags such as:

```text
events
event:{id}
category:{id}
subcategory:{id}
ads
advertisement:{id}
featured
carousel
sponsors
memories
homepage:today
homepage:tomorrow
homepage:this_week
```

Tags represent dependencies rather than physical storage keys.

---

# 17. Tag Invalidation

Example:

```text
Update Event A
        ↓
Invalidate:
  event:A
  events
  today / tomorrow / this_week if relevant
  category:X
  subcategory:Y
  affected search caches
```

The exact set is determined from event properties.

---

# 18. Field-Aware Invalidation

Not every event modification requires the same cache invalidation.

Examples:

### Change venue

Invalidate:

```text
event:{id}
```

and collections containing event metadata.

### Change category

Invalidate:

```text
event:{id}
old category
new category
relevant lists
```

### Change event date

Invalidate:

```text
event:{id}
old date bucket
new date bucket
today/tomorrow/this_week where applicable
```

This prevents unnecessary global invalidation.

---

# 19. Event Status Changes

A lifecycle change can affect many public representations.

Example:

```text
PUBLISHED → COMPLETED
```

may require invalidation of:

```text
event:{id}
today
tomorrow
this_week
past_events
category lists
search results
```

The dependency system determines the actual affected resources.

---

# 20. Event Deletion

When an event is deleted:

```text
Database deletion
      ↓
Transactional outbox
      ↓
Cache invalidation event
      ↓
Invalidate event-specific cache
      ↓
Invalidate dependent collections
```

A deleted event must not remain indefinitely in public caches.

---

# 21. Cache Deletion Race

A cache invalidation request may fail temporarily.

Therefore cache invalidation must be retryable.

The source of truth remains PostgreSQL.

The system should also use short enough TTLs to provide an upper bound on stale data.

---

# 22. Cache TTL Philosophy

TTL is a safety mechanism, not the primary freshness mechanism.

The preferred strategy is:

```text
Mutation
   ↓
Targeted invalidation
```

TTL provides a fallback:

```text
If invalidation fails
   ↓
Entry eventually expires
```

---

# 23. Suggested TTL Classes

Use different TTL classes.

### Very dynamic public data

```text
1–5 minutes
```

Examples:

* Search results.
* Today section.

### Moderately dynamic data

```text
5–15 minutes
```

Examples:

* This Week.
* Event lists.

### Relatively stable data

```text
15–60 minutes
```

Examples:

* Categories.
* Sponsors.
* Memories.

### Static assets

```text
Long-lived / immutable
```

Examples:

* Versioned JavaScript.
* Versioned CSS.
* Fingerprinted images.

Exact production TTLs must be validated using traffic and freshness requirements.

---

# 24. Stale-While-Revalidate

Public cacheable content should use stale-while-revalidate where appropriate.

Conceptually:

```text
Request
   ↓
Fresh cache?
   ├── YES → return immediately
   │
   └── STALE but usable
          ↓
       return stale
          +
       regenerate asynchronously
```

This prevents cache regeneration from becoming a user-facing latency spike.

---

# 25. Maximum Staleness

Stale-while-revalidate must have an explicit upper bound.

Do not allow:

```text
stale forever
```

A resource must eventually require a fresh origin representation.

---

# 26. Single-Flight Regeneration

A cache miss can cause a thundering herd.

Example:

```text
10,000 users
      ↓
cache expires
      ↓
10,000 origin requests
```

This is prohibited.

Use single-flight regeneration:

```text
First request
    ↓
acquires regeneration lock
    ↓
regenerates cache

Other requests
    ↓
wait / receive stale response
```

Only one regeneration should be active for a given cache key.

---

# 27. Cache Stampede Protection

Use:

* Stale-while-revalidate.
* Single-flight regeneration.
* Jittered expiration where appropriate.
* Bounded regeneration.
* Request coalescing.

Do not rely only on TTL.

---

# 28. Cache Key Design

Cache keys must be:

* Deterministic.
* Versionable.
* Namespace-isolated.
* Free from sensitive information.
* Independent of irrelevant query parameters.

Example:

```text
public:event:{id}:v:{resource_version}
```

---

# 29. Versioned Cache Keys

Resource versions may be incorporated into cache keys.

Example:

```text
events:v1042
```

When the underlying version changes:

```text
events:v1043
```

The new representation naturally becomes distinct.

Old entries can expire asynchronously.

---

# 30. Versioning and Invalidation

Resource versions and explicit invalidation serve different purposes.

### Version

Detects that data changed.

### Invalidation

Removes or marks stale cached data.

### TTL

Provides eventual expiration.

All three can coexist.

---

# 31. Resource Versions

The database maintains resource versions such as:

```text
events_version
categories_version
ads_version
sponsors_version
carousel_version
memories_version
featured_version
settings_version
```

These are updated transactionally when relevant data changes.

---

# 32. Synchronization Flow (Revised for Free Tier)

The Student Website does **not** poll version endpoints.

Instead, data freshness is managed through server-driven cache invalidation:

```text
Admin mutation commits
    ↓
Database transaction (data change + version increment + outbox entry)
    ↓
Outbox processor fires
    ↓
Cloudflare cache purge for affected cache tags/keys
    ↓
Next student request triggers cache miss
    ↓
Cloudflare fetches fresh data from Supabase origin
    ↓
Fresh response cached at edge
    ↓
Subsequent students served from cache
```

Between mutations, cache TTL expiry provides eventual freshness.

This eliminates the need for 10,000 browsers to continuously poll version endpoints.

Refer to `FREE_TIER_CAPACITY.md` Section 6.3 for the rationale.

---

# 33. Resource Version Security

Clients can read public resource versions.

Clients cannot:

* Increment versions.
* Decrease versions.
* Set arbitrary versions.
* Trigger version changes.

Only trusted mutations may update them.

---

# 34. Homepage Date Buckets

Homepage sections such as:

```text
Happening Today
Tomorrow
This Week
Past Events
```

are date-sensitive.

Their cache must account for date rollover.

---

# 35. Date Rollover

At midnight Asia/Kolkata:

```text
Today → Tomorrow
Tomorrow → This Week
```

The relevant caches must be invalidated or regenerated.

Do not wait for normal TTL alone if this causes visible incorrect content.

---

# 36. Scheduled Date Invalidation

A scheduled job should perform date-rollover invalidation.

It should:

1. Determine current business date.
2. Invalidate affected date-dependent cache tags.
3. Regenerate high-traffic homepage sections.
4. Update synchronization metadata if required.

---

# 37. Timezone Rule

Business-date calculations use:

```text
Asia/Kolkata
```

not the browser's timezone.

A student browsing from another country must still see LPU's event-day classifications correctly.

---

# 38. Event Completion and Cache

An event becomes `COMPLETED` through trusted backend/scheduled processing.

After completion:

```text
event cache
+
date buckets
+
relevant lists
```

must be invalidated.

---

# 39. Advertisement Caching

Advertisements are cached separately from event content.

Example:

```text
ads:homepage_top
ads:homepage_feed
ads:event_top
ads:event_bottom
```

---

# 40. Advertisement Expiration

An advertisement must not remain visible after its configured `end_at`.

The cache layer must enforce:

```text
now < end_at
```

when generating the public representation.

TTL must not be longer than the acceptable advertisement freshness window.

---

# 41. Advertisement Rotation

Multiple active advertisements in the same position may rotate.

The cache design must not accidentally freeze one advertisement indefinitely.

Use one of:

* Short rotation cache.
* Server-side randomized selection.
* Controlled rotation representation.

The rotation strategy must remain consistent with the product requirements.

---

# 42. Homepage Feed Advertisement Placement

The configured feed interval is cached separately.

Example:

```text
event_interval = 5
```

If changed:

```text
invalidate:
homepage_feed
advertisement configuration
```

Do not invalidate unrelated event details.

---

# 43. Advertisement Analytics

Advertisement analytics are not part of the public content cache.

Impressions/clicks should be recorded through the analytics system.

Aggregated administrative metrics must never leak into public cache responses.

---

# 44. Category Caching

Categories and subcategories are highly cacheable.

Cache independently:

```text
categories
subcategories
```

A subcategory change does not necessarily require invalidating unrelated event detail pages.

---

# 45. Category Dependency

When a category changes:

```text
categories
category-specific event lists
affected search results
```

may need invalidation.

When only the category display order changes:

```text
category list
```

may be sufficient.

---

# 46. Sponsor Caching

Sponsors are public content.

Cache separately:

```text
sponsors
```

A sponsor update should not invalidate events.

---

# 47. Carousel Caching

Carousel presentation is independent from advertisement analytics.

Cache:

```text
carousel
```

Changing carousel ordering should not automatically invalidate advertisement metrics.

---

# 48. Featured Events

Featured event configuration has its own cache.

Example:

```text
featured
```

Changing Featured configuration invalidates Featured representations.

It does not require clearing every event cache.

---

# 49. Event Memories

Public Event Memories use independent caching.

Example:

```text
memories
memory:{id}
```

A new memory does not require invalidating current event details unless the UI explicitly embeds memories there.

---

# 50. Search Caching

Search results may be cached for short periods.

Example:

```text
search:{normalized_query}:{filters}:{page}
```

Search caches should have shorter TTLs than origin content.

---

# 51. Search Normalization

Normalize:

* Case.
* Whitespace.
* Equivalent safe formatting.

Do not allow arbitrary unbounded query strings to create unlimited cache keys.

---

# 52. Search Cache Limits

Enforce:

* Maximum query length.
* Maximum number of filters.
* Maximum page size.
* Maximum pagination depth.

Reject pathological requests.

---

# 53. Search Cache Poisoning

Cache keys must include all parameters that affect results.

Example:

If category is a filter:

```text
search:football:category:sports
```

must not collide with:

```text
search:football:category:technology
```

Never omit a query parameter that changes the response.

---

# 54. Browser Caching

Browser caching is appropriate for:

* Static JS.
* CSS.
* Fonts.
* Fingerprinted assets.
* Public media.

Dynamic API responses should use controlled cache headers.

---

# 55. Immutable Static Assets

Production build assets should be fingerprinted.

Example:

```text
app.8fd72c.js
```

These can have long cache lifetimes.

Because the filename changes when content changes.

---

# 56. HTML Caching

If the Student Website uses cacheable HTML:

* It must contain only public data.
* It must have controlled TTL.
* It must be invalidated on relevant changes.

If the frontend is primarily a client-rendered application, API/data caching becomes the primary mechanism.

---

# 57. Admin Browser Cache

Sensitive Admin responses should use:

```text
Cache-Control: private, no-store
```

where appropriate.

Do not allow browser history/cache to retain sensitive administrative responses unnecessarily.

---

# 58. Authentication Cache

Authentication endpoints and session responses must not be placed in public caches.

Use appropriate no-store/private semantics.

---

# 59. Cloudflare Edge Cache

Cloudflare Edge Cache is the primary shared cache for public read-heavy Student Website data.

The edge cache must never become a second source of truth.

---

# 60. Origin Protection

The origin should be protected from direct public abuse where possible.

Cloudflare should sit in front of public traffic.

Controls include:

* WAF.
* DDoS protection.
* Rate limiting.
* Bot protection.
* Security headers.
* Turnstile for selected flows.

---

# 61. Cache Bypass Conditions

Requests should bypass shared cache when:

* Authentication is present and response is private.
* Response contains private data.
* Request is an Admin operation.
* Request performs mutation.
* Cache safety cannot be established.

---

# 62. Mutation Requests

Do not cache:

```text
POST
PUT
PATCH
DELETE
```

responses as public content.

Mutations execute against the authoritative backend.

After successful mutation:

```text
Database commit
    ↓
Outbox
    ↓
Cache invalidation
```

---

# 63. Transactional Invalidation

Cache invalidation must happen after the database transaction commits.

Do not invalidate public caches for a mutation that later rolls back.

Correct:

```text
BEGIN
  mutate database
  create outbox
COMMIT
  ↓
process invalidation
```

Incorrect:

```text
invalidate cache
mutate database
rollback
```

---

# 64. Outbox-Based Invalidation

Cache invalidation should use the transactional outbox.

Example:

```text
Event update
   ↓
events updated
   ↓
resource_versions updated
   ↓
outbox_events inserted
   ↓
COMMIT
   ↓
cache worker
   ↓
invalidate tags
```

This prevents cache invalidation from being lost when the application crashes after the database commit.

---

# 65. Invalidation Retry

If Cloudflare invalidation fails:

```text
outbox event
   ↓
retry
```

with:

* Attempt limits.
* Exponential backoff.
* Monitoring.
* Dead-letter/failed state.

---

# 66. Cache Invalidation Failure

Cache failure must not corrupt PostgreSQL.

If cache invalidation fails:

```text
Database remains correct.
```

The system should continue operating.

The failed invalidation must be visible operationally.

---

# 67. Cache Regeneration Failure

If regeneration fails:

```text
serve stale if within stale window
```

where safe.

Otherwise:

```text
fetch fresh data from origin
```

The website must not show a fabricated empty response merely because cache regeneration failed.

---

# 68. Fail-Open vs Fail-Closed

For public content:

```text
Cache failure → origin
```

For private/authorization-sensitive content:

```text
Authorization failure → deny
```

Never use stale cached authorization decisions to grant access.

---

# 69. Cache Security Boundary

Caching must never decide:

```text
Is this organizer allowed to edit this event?
```

Authorization is never cached as an authority.

Cache stores data representations, not security decisions.

---

# 70. Cache Poisoning Protection

Protect against:

* Host-header poisoning.
* Query-parameter confusion.
* Untrusted cache keys.
* Response variation mismatches.
* User-specific data entering public cache.
* Malicious content injection.

Only explicitly defined cacheable request shapes should be cached.

---

# 71. Vary Strategy

Do not blindly vary cache by every HTTP header.

This can destroy cache efficiency.

Only vary on headers that genuinely affect the representation.

Public content should ideally have a stable representation independent of user identity.

---

# 72. Authorization Header

A request carrying an authorization token should generally bypass public shared caching unless the endpoint is explicitly designed as public and authenticated state is irrelevant.

This prevents accidental private-response caching.

---

# 73. Cache-Control

Cache headers must be explicitly defined.

Do not rely on browser/CDN guesses.

Public content should use appropriate:

```text
public
max-age
s-maxage
stale-while-revalidate
stale-if-error
```

values.

Private responses should use:

```text
private
no-store
```

where appropriate.

---

# 74. Cache Key Security

Never include:

* Access tokens.
* Refresh tokens.
* Session identifiers.
* Secrets.

in cache keys.

Cache keys should contain only safe representation parameters.

---

# 75. Cache Invalidation Tags

The system should maintain a centralized dependency map.

Conceptually:

```text
DEPENDENCIES

event
 ├── event_detail
 ├── today
 ├── tomorrow
 ├── this_week
 ├── past_events
 ├── category
 ├── subcategory
 └── search

advertisement
 ├── homepage_top
 ├── homepage_feed
 ├── event_top
 └── event_bottom

category
 ├── categories
 ├── category_events
 └── search

sponsor
 └── sponsors
```

---

# 76. Dependency Map Ownership

Cache dependency rules must live in one centralized implementation.

Do not scatter invalidation logic throughout unrelated API handlers.

This prevents:

```text
Handler A invalidates 3 keys
Handler B invalidates 5 keys
Handler C forgets one key
```

---

# 77. Cache Warm-Up

High-traffic public resources may be proactively regenerated after invalidation.

Examples:

* Homepage.
* Happening Today.
* Featured.
* Popular event detail pages.

Warm-up should be asynchronous.

A mutation must not wait for cache warming before returning success.

---

# 78. Cache Warm-Up Failure

Warm-up failure does not invalidate the database mutation.

The cache worker retries.

The next request can regenerate the cache.

---

# 79. Cache Warm-Up Abuse

A browser must not be able to request arbitrary cache warming.

Only trusted workers may trigger proactive regeneration.

---

# 80. Cache Capacity

Cache size must be monitored.

Do not assume unlimited edge cache storage.

High-cardinality resources such as search queries must have short TTLs and controlled key generation.

---

# 81. High-Cardinality Cache Protection

Avoid caching every arbitrary search query forever.

Use:

* Short TTL.
* Query normalization.
* Maximum query length.
* Bounded pagination.
* Eviction.

---

# 82. Event Detail Cache Cardinality

Event detail caching has bounded cardinality because it maps to actual events.

When events are deleted, their caches should be invalidated.

Old entries can expire naturally after invalidation.

---

# 83. Cache Purging

Full-site cache purges should be exceptional.

Allowed situations:

* Emergency security incident.
* Cache corruption.
* Major deployment requiring global invalidation.
* Infrastructure migration.

Normal content changes must use targeted invalidation.

---

# 84. Full Cache Purge Risk

A full purge can cause:

```text
Millions of cache misses
       ↓
Origin overload
       ↓
Database pressure
```

Therefore full purges must be rate-controlled and followed by controlled warm-up.

---

# 85. Deployment Cache Strategy

Deployments should not require clearing all public content.

Fingerprint static assets.

Application/data cache keys should be versioned when representation changes incompatibly.

---

# 86. Schema Change and Cache Compatibility

If an API response changes shape:

```text
old cache representation
```

must not be interpreted as the new representation.

Use:

* Cache namespace versioning.
* Representation versioning.
* Controlled invalidation.

Example:

```text
event:v1:{id}
event:v2:{id}
```

---

# 87. API Contract and Cache Contract

Every public cacheable API endpoint must define:

* Cacheability.
* TTL.
* Cache key.
* Dependencies.
* Invalidation triggers.
* Stale behavior.
* Security classification.

This prevents accidental caching of new endpoints.

---

# 88. Cache Observability

Monitor:

* Hit ratio.
* Miss ratio.
* Origin request rate.
* Regeneration count.
* Regeneration failures.
* Invalidation failures.
* Stale responses.
* Cache purge volume.
* Cache latency.
* Origin latency.

---

# 89. Cache Alerts

Alert on:

### Critical

* Large public cache returning incorrect/private data.
* Persistent invalidation failure after security-sensitive deletion.

### High

* Major cache miss spike.
* Origin overload caused by cache failure.
* Regeneration storm.

### Medium

* Increased stale responses.
* Increased cache errors.
* Poor hit ratio.

---

# 90. Cache Debugging

Every cacheable response should be diagnosable through internal observability.

Useful metadata:

```text
cache_status
cache_key/version
resource_version
generated_at
```

Do not expose internal sensitive cache metadata unnecessarily to public clients.

---

# 91. Cache Consistency Model

The Student Website uses:

**Eventually consistent public caching with bounded staleness.**

The authoritative state is:

```text
PostgreSQL
```

The normal flow is:

```text
Mutation
   ↓
PostgreSQL commit
   ↓
Outbox
   ↓
Cache invalidation
   ↓
Fresh representation
```

---

# 92. Acceptable Staleness

Public content may temporarily remain stale if:

* Cache invalidation is delayed.
* Edge propagation is delayed.
* A regeneration is in progress.

However, stale content must remain within the defined TTL/stale window.

Security-sensitive state must never rely on stale public cache.

---

# 93. Deletion Consistency

Deletion is treated more strictly than ordinary content updates.

After an event or advertisement is deleted/disabled:

* Targeted cache invalidation must occur.
* Invalidation failures must be retried.
* Public responses must verify current eligibility when necessary.
* The maximum stale period must be bounded.

---

# 94. Advertisement Safety

Expired advertisements must never be selected during fresh cache generation.

The selection query must enforce active time/status conditions.

Caching an expired advertisement does not override database eligibility.

---

# 95. Homepage Safety

Homepage sections must always filter by current public eligibility.

For example:

```text
event.status = PUBLISHED
```

must be enforced at origin generation.

The cache merely stores the result.

---

# 96. Search Safety

Search results must always query public events only.

A cached search result must never include:

* Deleted events.
* Non-public events.
* Private administrative data.

---

# 97. Cache and Resource Versions

Resource version updates provide a lightweight synchronization mechanism.

These versions are used **server-side** for cache key management and conditional responses.

Example:

```text
Cloudflare edge cache key:
  events:v101

After event mutation:
  events:v102

Cached v101 response expires or is purged.
Next request generates v102 response.
```

Resource versions power:

* Server-side cache key versioning.
* ETag / If-None-Match conditional responses.
* Outbox-based invalidation targeting.

Resource versions do **not** power:

* Client-side polling (disabled for free tier).
* Browser-initiated version checks.

---

# 98. Incremental Synchronization

Incremental synchronization via client polling is **not used** on the Student Website.

Instead, the Student Website receives complete cached responses from Cloudflare edge.

When a cache miss occurs, the origin returns the full current state.

This is simpler and more efficient for the free-tier architecture:

* No complex delta/diff logic.
* No version-tracking state in the browser.
* Cloudflare edge handles all caching automatically.

Admin interfaces may optionally use version-based conditional requests to reduce bandwidth.

---

# 99. Cache and Incremental Updates

Incremental synchronization must not become a second source of truth.

The server/database remains authoritative.

If synchronization state becomes inconsistent:

```text
discard local derived state
fetch authoritative snapshot
```

---

# 100. Browser Offline Behavior

The Student Website may optionally use browser cache/service-worker mechanisms for resilience.

However:

* Offline data must be clearly treated as stale/derived.
* No administrative operations depend on offline state.
* The application must refresh from the server when connectivity returns.

---

# 101. Service Worker Policy

Do not introduce a service worker merely for caching.

If introduced, it must have:

* Explicit cache versioning.
* Controlled invalidation.
* Safe update behavior.
* No caching of private Admin data.
* No stale authentication responses.

---

# 102. Admin Website Caching

The Admin Website should rely primarily on:

* Normal browser state.
* Request-level caching where safe.
* Local UI state.
* Database/API responses.

Shared Cloudflare caching of Admin responses is prohibited unless a future security review explicitly approves it.

---

# 103. Admin Mutation Flow

Admin mutation:

```text
Admin
  ↓
Authenticated API
  ↓
Authorization
  ↓
PostgreSQL transaction
  ↓
Outbox
  ↓
COMMIT
  ↓
Targeted public cache invalidation
```

The Admin Website should refresh its own affected data after successful mutation.

---

# 104. No Client-Controlled Cache Invalidation

The browser may request a mutation.

The browser cannot declare:

```text
invalidate_tags = *
```

or similar.

The server derives invalidation dependencies.

---

# 105. Cache Dependency Calculation

Dependency calculation should be based on:

* Entity type.
* Entity ID.
* Previous state.
* New state.
* Fields changed.
* Date buckets.
* Taxonomy.
* Publication status.
* Content placement.

---

# 106. Before/After Dependency Tracking

For updates, both old and new state may be required.

Example:

```text
Old category = Sports
New category = Technology
```

Invalidate both:

```text
category:Sports
category:Technology
```

Otherwise the event can remain stale in the old category cache.

---

# 107. Date Change Dependency Tracking

Example:

```text
Old date = August 20
New date = August 25
```

Invalidate:

```text
old date-derived buckets
new date-derived buckets
event detail
```

The system must not assume only the new state matters.

---

# 108. Advertisement Position Change

If an advertisement moves from:

```text
homepage_top
```

to:

```text
event_top
```

invalidate both old and new placements.

---

# 109. Carousel Change

Changing:

* order.
* active status.
* linked event.
* linked media.

invalidates the relevant carousel representation.

It does not invalidate all advertisements.

---

# 110. Dependency Batch Invalidation

Multiple changes in one administrative transaction should produce one consolidated invalidation operation where practical.

Example:

```text
10 event edits
    ↓
one invalidation batch
```

rather than:

```text
10 edits
    ↓
10 separate global purge operations
```

---

# 111. Invalidation Idempotency

Running the same invalidation twice must be safe.

Example:

```text
invalidate event:A
invalidate event:A
```

must not cause corruption.

---

# 112. Invalidation Ordering

Database commit must occur before public cache invalidation.

Never:

```text
cache invalidated
database rollback
```

because this causes unnecessary regeneration and inconsistent behavior.

---

# 113. Cache Failure During Database Failure

If database transaction fails:

```text
No committed mutation
No invalidation should be considered authoritative
```

Outbox entries created inside the transaction roll back with it.

---

# 114. Cache Failure During Successful Database Mutation

If database commit succeeds but cache invalidation fails:

```text
Database = correct
Cache = temporarily stale
```

The outbox guarantees retry.

TTL provides eventual recovery.

---

# 115. Cache Regeneration Data Source

Cache generation must read from authoritative PostgreSQL/public APIs.

Never regenerate a cache entry from another stale cache unless explicitly designed and validated.

Avoid cache-on-cache dependency chains.

---

# 116. Cache Layer Dependency Rule

Prefer:

```text
PostgreSQL → Cache
```

rather than:

```text
Cache A → Cache B → Cache C
```

Deep cache chains make consistency difficult to reason about.

---

# 117. Public Cache Authorization

Public cached responses must contain only data that is public independent of the requesting user.

If a response differs based on identity:

```text
DO NOT USE SHARED PUBLIC CACHE
```

---

# 118. Privacy Rule

No cache architecture decision may override privacy/security requirements.

If there is a conflict:

```text
Security > Correctness > Performance
```

---

# 119. Performance Rule

Caching is not a substitute for proper database design.

The system must still have:

* Correct indexes.
* Efficient queries.
* Pagination.
* Appropriate constraints.
* Proper API boundaries.

---

# 120. Cache Review — Loophole Pass 1

The first review identified:

## Loophole A — Full-site invalidation

**Problem:** Every update clears everything.

**Fix:** Dependency/tag-driven invalidation.

---

## Loophole B — TTL-only freshness

**Problem:** Deleted/changed data remains stale until TTL expires.

**Fix:** Transactional outbox + targeted invalidation.

---

## Loophole C — Cache stampede

**Problem:** Thousands of misses regenerate simultaneously.

**Fix:** Single-flight regeneration + SWR.

---

## Loophole D — Date rollover

**Problem:** "Today" remains yesterday.

**Fix:** Asia/Kolkata date-rollover invalidation.

---

## Loophole E — Advertisement expiry

**Problem:** Expired ads remain cached.

**Fix:** Eligibility checked at generation + bounded TTL + invalidation.

---

## Loophole F — Private data enters public cache

**Problem:** CDN accidentally serves private response.

**Fix:** Explicit public/private classification + auth bypass.

---

# 121. Cache Review — Loophole Pass 2

Second review:

## Loophole G — Old dependency remains cached

Event changes category.

**Fix:** Invalidate both old and new dependencies.

---

## Loophole H — Old date bucket remains cached

Event date changes.

**Fix:** Invalidate old and new date-derived collections.

---

## Loophole I — Client controls invalidation

**Fix:** Server calculates dependency graph.

---

## Loophole J — Invalidation lost after crash

Database commits but application crashes before CDN purge.

**Fix:** Transactional outbox.

---

## Loophole K — Stale cache used to authorize access

**Fix:** Cache never participates in authorization.

---

## Loophole L — Search cache collision

Different filters generate same key.

**Fix:** Every result-affecting parameter is represented in normalized cache key.

---

# 122. Cache Review — Loophole Pass 3

Third review:

## Loophole M — Version changes without data commit

**Fix:** Resource version update occurs inside the same database transaction.

---

## Loophole N — Cache warmed before database commit

**Fix:** Warm-up only after successful commit/outbox processing.

---

## Loophole O — Stale cleanup deletes newly referenced media

**Fix:** Recheck live references immediately before deletion.

---

## Loophole P — Cache namespace survives API schema change

**Fix:** Representation versioning.

---

## Loophole Q — Full purge overloads origin

**Fix:** Full purge is exceptional and followed by controlled warm-up.

---

# 123. Cache Review — Final Pass

The final review focuses on catastrophic consistency failures.

## Scenario 1

```text
Event deleted
↓
Cloudflare purge fails
```

Result:

* Database remains authoritative.
* Outbox retries.
* TTL provides upper-bound recovery.
* Public generation excludes deleted event.

---

## Scenario 2

```text
Event moves from Sports → Technology
```

Result:

* Old Sports dependency invalidated.
* New Technology dependency invalidated.
* Event detail invalidated.
* Relevant search caches invalidated.

---

## Scenario 3

```text
10,000 requests arrive after cache expiry
```

Result:

* Single-flight regeneration.
* Other requests receive stale data where allowed.
* Origin is protected.

---

## Scenario 4

```text
Admin response accidentally contains user-specific data
```

Result:

* Admin endpoints are not public-cacheable.
* Authorization-sensitive responses use private/no-store semantics.

---

## Scenario 5

```text
Resource version says 104
cache contains version 103
```

Result:

* Version mismatch detected.
* Fresh resource generated/downloaded.

---

## Scenario 6

```text
Cache worker crashes after processing database mutation
```

Result:

* Outbox remains retryable.
* Cache eventually converges.

---

# 124. Free-Tier Cache TTL Table

The following TTL values are designed for the free-tier deployment.

They balance freshness against Supabase origin request volume.

| Cache Domain | Edge TTL | SWR Window | Invalidation | Notes |
|---|---|---|---|---|
| Homepage Carousel | 10 min | 5 min | On mutation | High visibility section |
| Happening Today | 5 min | 3 min | On mutation + midnight rollover | Date-sensitive |
| Tomorrow | 10 min | 5 min | On mutation + midnight rollover | Date-sensitive |
| This Week | 10 min | 5 min | On mutation | Date-sensitive |
| Featured Events | 10 min | 5 min | On mutation | Curated content |
| Categories | 1 hour | 30 min | On mutation | Changes rarely |
| Subcategories | 1 hour | 30 min | On mutation | Changes rarely |
| Event Listings | 5 min | 3 min | On mutation | Most dynamic |
| Event Detail | 10 min | 5 min | On mutation | Per-event key |
| Advertisements | 10 min | 5 min | On mutation + expiry | Time-bounded |
| Sponsors | 1 hour | 30 min | On mutation | Changes rarely |
| Event Memories | 30 min | 15 min | On mutation | Lower urgency |
| Search Results | 2 min | 1 min | TTL only | High variability |
| Static Assets | 1 year | N/A | Content hash | Immutable |
| Media/Images | 1 year | N/A | Immutable filename | Served via R2 |

### Stale-While-Revalidate (SWR)

All cacheable public responses should use the `stale-while-revalidate` Cache-Control directive.

Example:

```text
Cache-Control: public, max-age=300, stale-while-revalidate=180
```

This means:

* Serve cached response for 5 minutes.
* After 5 minutes, serve stale while revalidating in background for up to 3 more minutes.
* After 8 minutes total, the cache entry is fully stale and a synchronous revalidation occurs.

SWR ensures students almost never experience a cold-cache latency penalty.

### Cloudflare Cache Purge Integration

After admin mutations, the outbox processor triggers targeted Cloudflare cache purges:

```text
Outbox processor
    ↓
Determine affected cache tags/keys
    ↓
Cloudflare API: purge by tag or URL
    ↓
Affected cached responses removed from edge
    ↓
Next student request triggers fresh origin fetch
```

Cloudflare Free provides:

* Purge everything (limited use).
* Purge by URL (available on Free).

Purge-by-tag requires Cloudflare Enterprise. On Free, use purge-by-URL with known cache key patterns.

Refer to `FREE_TIER_CAPACITY.md` for the full free-tier budget analysis.

---

# 124. Cache Definition of Done

Caching is considered implemented only when:

* [ ] Public cache domains are explicitly defined.
* [ ] Private Admin data is excluded from shared caching.
* [ ] Cache keys are deterministic.
* [ ] Dependency tags exist.
* [ ] Dependency mapping is centralized.
* [ ] Resource versions exist.
* [ ] Resource versions update transactionally.
* [ ] Outbox-driven invalidation exists.
* [ ] Invalidation is retryable.
* [ ] Invalidation is idempotent.
* [ ] Single-flight regeneration exists.
* [ ] SWR is configured appropriately.
* [ ] Date rollover is handled in Asia/Kolkata.
* [ ] Event deletion invalidates dependencies.
* [ ] Event date changes invalidate old/new buckets.
* [ ] Category changes invalidate old/new dependencies.
* [ ] Advertisement expiry is protected.
* [ ] Search caching is bounded.
* [ ] Full cache purges are exceptional.
* [ ] Cache poisoning protections exist.
* [ ] Cache metrics exist.
* [ ] Cache failures are observable.
* [ ] Cache cannot grant authorization.
* [ ] Admin responses are not publicly cached.
* [ ] Static assets use immutable versioning.
* [ ] API representation changes support cache versioning.
* [ ] Cache failure does not compromise database correctness.

---

# 125. Final Architecture

The final caching architecture is:

```text
                         PostgreSQL
                     Source of Truth
                            │
                            │
                 Transaction + Outbox
                            │
                            ▼
                 Dependency Calculator
                            │
                            ▼
                   Targeted Invalidation
                            │
              ┌─────────────┴─────────────┐
              │                           │
        Cache Regeneration       Cloudflare Cache Purge
              │                           │
              ▼                           ▼
       Cloudflare Edge               Resource Version
              │                    (Server-Side Only)
              ▼
        Student Website
```

The cache strategy is:

```text
Cache independently
        +
Tag dependencies
        +
Version resources
        +
Invalidate after commit
        +
Retry through outbox
        +
SWR
        +
Single-flight
        +
Short TTL safety net
```

---

# 126. Final Rule

The platform must never sacrifice correctness of authoritative data for cache performance.

If caching becomes difficult to reason about:

```text
Remove cache complexity.
Keep PostgreSQL correctness.
```

Performance optimization comes after correctness.

---

# 127. Status

**CACHING_ARCHITECTURE.md is the canonical caching baseline for LPU Events.**

Any future caching implementation must conform to this document.

A new cacheable resource must define:

1. Cache key.
2. TTL.
3. Public/private classification.
4. Dependencies.
5. Invalidation triggers.
6. Stale behavior.
7. Regeneration behavior.
8. Failure behavior.
9. Security implications.

No new shared cache should be introduced without those definitions.
