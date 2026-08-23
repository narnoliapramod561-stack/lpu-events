# LPU Events — System Architecture & Technical Requirements

**File:** `docs/technical/SYSTEM_ARCHITECTURE.md`
**Status:** LOCKED — Architecture Baseline
**Version:** 1.2
**Date:** 14 August 2026

---

# 1. Purpose

This document defines the complete technical architecture of the LPU Events platform.

It converts the approved product requirements and locked technology stack into an implementable technical design.

This document defines:

* Application boundaries.
* Authentication.
* Authorization.
* Event lifecycle.
* Event data ownership.
* External registration.
* Search and discovery.
* Homepage architecture.
* Caching.
* Media storage.
* Background processing.
* Analytics.
* Security.
* Auditability.
* Backups.
* Archival.
* Deployment.
* Development/staging/production environments.
* Failure handling.
* Cross-application data flow.

This document must be used together with:

* `TECH_STACK.md`
* `STUDENT_PRD.md`
* `ADMIN_PRD.md`

The database schema and API contracts will be derived from this architecture and documented separately.

---

# 2. Core Product Architecture

LPU Events is an **event discovery platform**.

Its job is to:

1. Store approved event information.
2. Publish event information to students.
3. Help students discover events.
4. Provide search and filtering.
5. Provide event details.
6. Redirect students to external registration platforms when required.
7. Provide platform-managed promotional content such as advertisements, Featured Events, Event Memories, and the Homepage Carousel.

LPU Events does **not** own the registration lifecycle.

---

# 3. Explicit Architectural Boundaries

The following systems are intentionally outside LPU Events:

* Internal event registration.
* Ticket booking.
* Ticket inventory.
* Seat reservations.
* Payment processing.
* UPI payment processing.
* Razorpay.
* Ticket generation.
* QR-code ticket generation.
* Ticket verification.
* Refund processing.
* Booking cancellation.
* Payment reconciliation.

When an event requires registration, the organizer supplies an external registration URL.

The external platform handles the actual registration process.

---

# 4. High-Level Architecture

```text id="x9v1az"
                              Internet
                                 │
                    ┌────────────┴────────────┐
                    │        Cloudflare       │
                    │   CDN / WAF / Security  │
                    └────────────┬────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
       ┌────────▼────────┐               ┌────────▼────────┐
       │   Student Web   │               │    Admin Web    │
       │  React + Vite   │               │  React + Vite   │
       │ Cloudflare Pages│               │ Cloudflare Pages│
       └────────┬────────┘               └────────┬────────┘
                │                                  │
                ▼                                  │
       ┌─────────────────┐                         │
       │ Cloudflare Edge │                         │
       │    Cache/CDN    │                         │
       └────────┬────────┘                         │
                │                                  │
          CACHE HIT → Student                      │
          CACHE MISS ↓                             │
                └──────────────────┬───────────────┘
                                   │
                           ┌───────▼────────┐
                           │    Supabase    │
                           │                │
                           │ PostgreSQL     │
                           │ Auth           │
                           │ RLS            │
                           │ RPCs           │
                           │ Edge Functions │
                           └───────┬────────┘
                                   │
                       ┌───────────┴───────────┐
                       │                       │
               ┌───────▼────────┐      ┌──────▼──────┐
               │ Cloudflare R2  │      │   PostHog   │
               │ Media/Archive  │      │  Analytics  │
               └───────┬────────┘      └─────────────┘
                       │
               Cloudflare Cache
                       │
                       ▼
                   Students
```

**Key architectural constraint (free-tier):**

Student traffic flows through Cloudflare edge cache before reaching Supabase.

Admin traffic may call Supabase directly (tiny user count, authenticated).

Public media is served via R2 → Cloudflare Cache → Students (R2 egress is free).

Refer to `FREE_TIER_CAPACITY.md` for the mathematical sustainability analysis.

---

# 5. Application Structure

The repository contains two independent applications:

```text id="0a4f3e"
apps/
├── student-web/
└── admin-web/
```

They are:

* Independently runnable.
* Independently buildable.
* Independently deployable.
* Maintained within one monorepo.

A monorepo does not mean a single deployment.

---

# 6. Student Website

## 6.1 Purpose

The Student Website is a public event-discovery application.

It provides:

* Homepage.
* Events Hub.
* Search.
* Filters.
* Event Details.
* Happening Today.
* Past Events.
* Featured content.
* Event Memories.
* Advertisements.
* External registration navigation.

## 6.2 Access Model

The Student Website is:

* Public.
* Anonymous.
* Read-oriented.

Students do not need an LPU Events account to browse events or follow external registration links.

---

# 7. Student Authentication Boundary

There is **no Student Website authentication system**.

The Student Website does not provide:

* Student login.
* Student signup.
* Student account creation.
* Student-specific authorization.
* Student booking history.
* Student tickets.

Supabase Auth is used by the Admin Website, not the public Student Website.

---

# 8. Student Profile Boundary

The earlier concept of a personal authenticated student profile is not part of the final architecture.

The Student Website may have a profile-looking UI element only if it represents a non-authenticated site/menu control.

It must not imply that LPU Events owns:

* Student accounts.
* Student personal profiles.
* Personal bookings.
* Personal tickets.

---

# 9. Student Notifications Boundary

Personalized notifications are not part of the current architecture because students are anonymous.

The platform may provide public or general announcements.

Examples:

* Important event updates.
* Platform announcements.
* Event cancellation announcements.

There is no authenticated notification inbox for individual students.

---

# 10. Admin Website

The Admin Website is a protected management application.

It provides:

* Organizer access requests.
* Event creation.
* Event editing.
* Event publishing.
* Event cancellation.
* Event analytics.
* Featured Events.
* Advertisements.
* Event Memories.
* Homepage Carousel.
* Global Settings.
* Organizer management.
* Super Admin controls.
* Audit visibility.
* Operational status where applicable.

---

# 11. Admin Authentication

Authentication is handled by:

**Supabase Auth**

The only supported authentication method is:

**Email OTP**

The following are explicitly not supported:

* Google Sign-In.
* Password login.
* Mobile OTP.

Supabase Auth establishes the authenticated identity.

Authentication alone does not grant administrative permissions.

---

# 12. Admin Authorization

Authorization is determined separately from authentication.

The authorization model is:

```text id="qsmj83"
Supabase Auth identity
        ↓
Admin authorization record
        ↓
Role
        ↓
Permission scope
```

Supported roles:

* Organizer.
* Super Admin.

An authenticated user without an approved administrative record must not receive administrative access.

---

# 13. Super Admin

Super Admin is a platform-level administrative role.

Super Admin can:

* Manage all events.
* Manage organizers.
* Review access requests.
* Manage Featured Events.
* Manage Advertisements.
* Manage Event Memories.
* Manage Homepage Carousel.
* Manage Global Settings.
* View platform-wide analytics.
* Perform high-impact administrative operations.
* Access operational/system health information where implemented.

---

# 14. Organizer Access Request

A first-time organizer:

```text id="8c5wja"
Email OTP Login
      ↓
No approved admin record
      ↓
Access Request
      ↓
Super Admin Review
      ↓
Approved
      ↓
Organizer Access
```

The request contains:

* Club/Department Name.
* Optional Remarks.

Only one active request can exist for an organizer at a time.

A rejected request can be edited and resubmitted.

Super Admin does not use this process.

---

# 15. Authorization Isolation

Organizers are isolated from each other.

An Organizer:

* Can manage only authorized events.
* Cannot modify another organizer's event.
* Cannot approve events.
* Cannot manage advertisements.
* Cannot manage Featured Events.
* Cannot manage Event Memories unless explicitly authorized later.
* Cannot modify Global Settings.
* Cannot manage other organizers.
* Cannot access Super Admin functions.

Super Admin has platform-wide scope.

---

# 16. Event Source of Truth

There is exactly one operational source of truth for all events:

```text id="q2m5wu"
events
```

There must not be separate operational tables such as:

* `draft_events`
* `pending_events`
* `published_events`

Event lifecycle state is stored on the `events` record.

The event ID remains constant throughout its lifecycle.

---

# 17. Event Publication Model

Events are created in the `events` table **when the organizer publishes the event**.

There is no persistent draft-event record.

The backend decides the initial lifecycle state at publication time.

Under the current architecture, a normal publish creates:

```text id="9g8gnx"
PUBLISHED
```

There is no standard organizer approval queue.

---

# 18. No Approval Workflow

The current product architecture intentionally does not contain:

* `PENDING_APPROVAL` operational events.
* Approval queues.
* Draft-to-approval publishing.
* Mandatory Super Admin approval before every normal event is published.

Super Admin retains administrative authority to modify or remove public content.

This keeps publishing simple and avoids unnecessary operational bottlenecks.

---

# 19. Persistent Draft Behavior

Opening or filling an event form does not create a database event.

A persistent event record is created when the organizer publishes the event.

This avoids large quantities of abandoned draft records.

Temporary frontend form state may exist locally in the browser.

---

# 20. Event Lifecycle

The canonical lifecycle is:

```text id="6evquz"
PUBLISHED
    │
    │ end_at reached
    ▼
COMPLETED
```

An event can also be cancelled.

Cancellation removes the event from operational public discovery.

```text id="j93e2d"
PUBLISHED
    │
    │ cancel
    ▼
DELETE
```

There is no normal public `CANCELLED` event page.

---

# 21. Event Completion

An event is considered completed when its configured:

```text id="x0h7fr"
end_at
```

has passed.

The event does not become completed merely because its start time has passed.

All date/time comparisons use the business timezone:

**Asia/Kolkata**

---

# 22. Timestamp Storage

PostgreSQL timestamps must be timezone-aware.

The system should store and process timestamps in UTC-aware representations.

Presentation and business date calculations use:

**Asia/Kolkata**

This prevents inconsistencies between:

* Database.
* Browser.
* Cloudflare.
* Scheduled jobs.
* Search filters.

---

# 23. Event Completion Job

A scheduled maintenance job runs approximately every:

**10 minutes**

It identifies events whose `end_at` has passed and transitions them to:

```text
COMPLETED
```

The job must:

* Use indexed date queries.
* Process records in batches.
* Be idempotent.
* Trigger cache invalidation.
* Trigger relevant cache warming.

---

# 24. Event Cancellation

Cancellation is a high-impact administrative action.

When an event is cancelled:

1. Authorization is verified.
2. The cancellation reason is validated.
3. An audit record is prepared.
4. Relevant asynchronous cleanup/outbox work is prepared.
5. The event is deleted transactionally.
6. Public caches are invalidated through the outbox.
7. Media cleanup runs asynchronously.
8. The event disappears from public discovery immediately.

---

# 25. Cancellation Audit

Deleting the event must not delete evidence that the cancellation occurred.

The audit record is independent of the event record.

It records at least:

* Event ID.
* Actor ID.
* Actor role.
* Action.
* Timestamp.
* Cancellation reason.

The audit record remains after event deletion.

---

# 26. Historical Event Retention

Completed events are kept in the operational database according to a configurable retention period.

Recommended default:

**365 days after `end_at`**

After the retention period:

1. Historical data is archived if required.
2. Archive integrity is verified.
3. Operational records are removed.
4. Unneeded media is cleaned.

This retention model does not depend on tickets or bookings.

---

# 27. Registration Architecture

The event registration model supports only:

```text id="cwecbr"
NONE
EXTERNAL
```

There is no internal registration mode.

---

# 28. NONE Registration

The event does not require registration.

The Student Website provides event information only.

No registration data is collected by LPU Events.

---

# 29. EXTERNAL Registration

An EXTERNAL event contains an organizer-configured external registration URL.

Student flow:

```text id="jyj72x"
Event Details
     ↓
Register Now
     ↓
External Website
```

LPU Events does not process the registration.

---

# 30. External Platform Responsibility

The external platform is authoritative for:

* Registration.
* Payment.
* Ticketing.
* Seat allocation.
* Confirmation.
* Cancellation.
* Refunds.
* Registration records.

LPU Events is not authoritative for any of those activities.

---

# 31. External Registration Information

The event may contain informational fields such as:

* Registration Opens.
* Registration Closes.
* Price (Free/Paid).

These values are informational only.

If LPU Events says registration is open, that does not prove the external registration platform is actually accepting registrations.

The external platform remains authoritative.

---

# 32. External URL Requirements

When registration mode is `EXTERNAL`:

* A registration URL is required.
* The URL must be syntactically valid.
* Production URLs must use HTTPS.
* Dangerous schemes are rejected.
* Validation occurs server-side.
* The stored URL must be safely rendered.

The Admin Website must clearly show the external destination before publication.

---

# 33. No URL Ownership Assumption

LPU Events does not own or control the external registration platform.

The organizer is responsible for providing the correct external registration URL.

The platform does not claim successful external registration merely because the student clicked the button.

---

# 34. No Ticketing Architecture

The following do not exist in the current system:

* `tickets`
* `bookings`
* `reservations`
* `ticket_inventory`
* `payments`
* `refunds`
* `ticket_qr_tokens`
* `ticket_verification`
* `payment_webhooks`

If any future requirement needs these concepts, it constitutes an architectural change and requires explicit approval.

---

# 35. Event Data Responsibilities

The event model must support at least:

* Event ID.
* Organizer ID.
* Event name.
* Banner/media.
* Category.
* Subcategory.
* Start date/time.
* End date/time.
* Venue.
* Description/content.
* Dynamic About sections.
* Registration mode.
* External registration URL.
* Registration opening date/time where applicable.
* Registration closing date/time where applicable.
* Free/Paid classification.
* Lifecycle status.
* Created timestamp.
* Updated timestamp.

The exact PostgreSQL schema is defined separately.

---

# 36. Free / Paid Classification

Events may be classified as:

* Free.
* Paid.

This is an informational discovery attribute.

A Paid event means the organizer's external registration system may require payment.

It does **not** mean LPU Events processes payment.

---

# 37. Venue Model

The initial venue model stores the venue information required for event discovery.

The architecture does not require:

* Map integration.
* Navigation API.
* Geolocation services.

Additional location functionality can be introduced later as a deliberate product decision.

---

# 38. Taxonomy

The authoritative category/subcategory taxonomy is maintained in the project taxonomy definition.

The same taxonomy must be used by:

* Student Website.
* Admin Website.
* Search.
* Filters.
* Event cards.
* Event details.

The database should store stable taxonomy keys.

Category/subcategory combinations must be validated.

---

# 39. Search

Global search is primarily event-name search.

Search requirements:

* Minimum 2 characters.
* 300 ms input debounce.
* Prefix matches ranked first.
* Contains matches ranked after prefix matches.
* Active filters remain applied.

Search must not require a dedicated external search service.

---

# 40. Search Ranking

Recommended deterministic ordering:

```text id="eky2im"
1. Prefix match
2. Contains match
3. Upcoming event start time
4. Stable event ID
```

This prevents visually unstable search results when records have similar relevance.

---

# 41. PostgreSQL Search

PostgreSQL remains responsible for search.

The implementation may use:

* Case-normalized indexing.
* PostgreSQL trigram functionality.
* Appropriate B-tree indexes.

A dedicated search product such as Elasticsearch, OpenSearch, Algolia, or Meilisearch is not required.

---

# 42. Events Hub

The Events Hub contains all eligible public events.

Default initial loading:

**10 events**

Show More increment:

**5 events**

These values are configurable through Global Settings.

---

# 43. Events Hub Ordering

Upcoming events are primarily ordered chronologically according to event start time.

Completed events are excluded from the upcoming collection.

Past events use a separate historical listing.

---

# 44. Timeline Filters

Supported timeline filters include:

* Today.
* Tomorrow.
* This Week.
* By Date.

All date boundaries use:

**Asia/Kolkata**

---

# 45. Event Type Filters

Supported event-type filters include:

* All.
* Free.
* Paid.
* Trending.

Trending is a curated classification, not an automatic ranking.

---

# 46. Trending

Trending events are manually selected by the single Super Admin.

Trending is not calculated from:

* Views.
* Registration clicks.
* External bookings.
* External payments.

When Trending is selected:

* Timeline filter resets to All.
* Category resets to All.
* Subcategory resets to All.

When Trending is exited:

* Previous Timeline selection is restored.
* Previous Category selection is restored.
* Previous Subcategory selection is restored.

This is client-side filter state.

---

# 47. Event View Analytics

A view is recorded when the Event Details page is actually opened.

Opening a card in an event list does not count as a view.

Because the Student Website is anonymous, view deduplication uses a pseudonymous visitor mechanism rather than a student account.

A visitor should count at most once for the same event during the configured counting window.

This is an analytics safeguard, not a security control.

---

# 48. Homepage Architecture

The homepage is composed of independently managed/read-optimized sections:

* Header.
* Hero Carousel.
* Advertisement Bar.
* Happening Today.
* Filter Bar.
* Events Hub.
* Additional discovery modules as approved.

Each section must have explicit dependencies.

---

# 49. Homepage Carousel

The Homepage Carousel can contain:

* Featured Events.
* Advertisements.
* Event Memories.

Carousel configuration is an administrative concern.

The Student Website only consumes the resulting carousel configuration/content.

---

# 50. Featured Events

Featured Events are manually curated by Super Admin.

Featured Events are not calculated automatically from engagement metrics.

Featured state is a separate relation from the event lifecycle.

An event can be:

* Published but not Featured.
* Published and Featured.
* Completed and still represented through approved historical/curated content.

The exact public-display rules are defined by the homepage/content logic.

---

# 51. Event Memories

Event Memories are independent historical content.

A memory may include:

* Title/event reference.
* Cover image.
* Description.
* Album/media.

Event Memories do not need to disappear merely because the original event is later archived.

This prevents historical content loss caused by normal event retention.

---

# 52. Advertisement Architecture

Advertisements are independent entities.

Supported placements:

* `homepage_top`
* `homepage_feed`
* `event_top`
* `event_bottom`

Advertisement information includes:

* Name.
* Image/banner.
* Redirect URL.
* Positions.
* Start date.
* End date.
* Status.
* Click analytics.
* Impression analytics.

---

# 53. Advertisement Feed Placement

For `homepage_feed`, Super Admin configures how often an advertisement appears.

Example:

```text id="w2i4rb"
Event 1
Event 2
Event 3
Event 4
Event 5
Advertisement
Event 6
Event 7
...
```

The placement rule is deterministic.

It must not randomly move between event requests.

---

# 54. Advertisement Rotation

Multiple active advertisements may exist within the same position.

They can rotate according to the configured advertisement-selection logic.

The Student Website must never display:

* Expired ads.
* Disabled ads.
* Ads outside their configured schedule.

---

# 55. Advertisement Analytics

Advertisement analytics are separate from presentation configuration.

Track:

* Impressions.
* Clicks.

CTR can be derived:

```text id="pob6xu"
CTR = Clicks / Impressions
```

The analytics system must not block advertisement rendering.

---

# 56. Caching Architecture

The caching model is:

**Dependency-based + tag-driven + proactive warm-up**

Caching is designed for public, read-heavy content.

Caching does not replace PostgreSQL as the source of truth.

---

# 57. Cache Dependency Model

Each cache entry should have explicit dependencies.

Examples:

```text id="vbr7g6"
event:123
category:technical
homepage
today
tomorrow
this-week
featured
advertisement:42
memory:18
carousel
```

When data changes, only affected dependencies are invalidated.

---

# 58. Event Detail Cache

Event details can be cached using:

```text id="a9b1x4"
event:{event_id}
```

Changing Event 123 must not invalidate all event detail pages.

---

# 59. Homepage Cache

Homepage content can be maintained as precomputed read models.

The Student Website should not perform a large collection of independent queries on every homepage load.

Instead:

```text id="nhm37c"
PostgreSQL
    ↓
Precomputed homepage payload
    ↓
Cache
    ↓
Student Website
```

---

# 60. Cache Invalidation

Cache invalidation is driven by committed database changes.

Flow:

```text id="w6eky8"
Business transaction
       ↓
Outbox event
       ↓
Dependency calculation
       ↓
Targeted invalidation
       ↓
Proactive regeneration
```

This prevents developers from manually remembering to invalidate caches after every change.

---

# 61. Cache Warm-Up

High-value cache entries should be regenerated after invalidation.

Examples:

* Homepage.
* Today's events.
* Tomorrow's events.
* This Week.
* Featured content.
* Popular category pages.

The first student request should not be responsible for rebuilding all expensive content.

---

# 62. Cache Race Prevention

Concurrent cache regenerations must not overwrite newer content with older content.

Use:

* Cache versions.
* Dependency versions.
* Single-flight regeneration.
* Version comparison before write.

---

# 63. Search Cache

Search results may be cached for a short TTL.

The cache key must include all search-affecting parameters:

* Query.
* Timeline.
* Category.
* Subcategory.
* Event type.
* Date.
* Pagination.

---

# 64. Date Rollover

At the Asia/Kolkata date boundary, the system must invalidate/rebuild date-dependent caches.

For example:

```text id="2wbrv9"
23:59
   ↓
Date changes
   ↓
Today changes
Tomorrow changes
This Week changes
```

Date rollover must not depend on a student being the first person to request the homepage.

---

# 65. No Redis

Redis is not part of the current architecture.

Caching should initially use:

* PostgreSQL-derived/precomputed data.
* Cloudflare/HTTP caching where appropriate.
* Application-level cache mechanisms.
* Dependency tags.
* Outbox-driven invalidation.
* Proactive regeneration.

Redis may be considered later only if measured load justifies the operational complexity.

---

# 66. Media Architecture

Cloudflare R2 is the media store for all public-facing media.

Use R2 for:

* Event images.
* Advertisement banners.
* Event Memory images.
* Sponsor logos.
* Backup objects.
* Historical archives.

PostgreSQL stores media metadata/references.

**Supabase Storage is NOT used for public media delivery.**

R2 egress is free (unlimited). Supabase egress is limited (10 GB/month on Free).

All public images are served via:

```text
R2 → Cloudflare Cache → Students
```

Supabase Storage (1 GB free) is reserved for internal/admin-only use such as:

* Temporary upload staging (if needed).
* Admin-only exports or reports.

Refer to `FREE_TIER_CAPACITY.md` Section 4.3 for R2 storage budget details.

### Image Size Policy

All uploaded images must be validated and compressed before storage:

| Image Type | Max File Size | Max Dimensions |
|---|---|---|
| Event Banner | 500 KB | 1200×630 px |
| Sponsor Logo | 100 KB | 400×400 px |
| Advertisement Banner | 300 KB | 1200×400 px |
| Event Memory Photo | 300 KB | 1200×800 px |
| Carousel Image | 500 KB | 1920×800 px |

WebP format is preferred. Oversized uploads must be rejected.

---

# 67. Media Upload Lifecycle

Recommended flow:

```text id="pnr2kq"
Admin Web
   ↓
Client validation
   ↓
Upload authorization
   ↓
R2 upload
   ↓
Server-side verification
   ↓
Database metadata commit
```

An invalid or failed upload must not become a permanent database reference.

---

# 68. Orphaned Media

An R2 object can exist without a completed database transaction.

Therefore:

* Media uploads are traceable.
* Orphan objects are identified.
* Cleanup jobs remove objects that remain unreferenced beyond the safety period.

This protects against storage leakage.

---

# 69. Media Deletion

Media deletion should not unnecessarily block an important database transaction.

Recommended flow:

```text id="4hj1yn"
Database transaction
   ↓
Cleanup task recorded
   ↓
Transaction commits
   ↓
Worker deletes R2 object
```

Failed cleanup is retryable.

---

# 70. Transactional Outbox

The platform uses the Transactional Outbox Pattern for important asynchronous side effects.

An outbox event is created in the same PostgreSQL transaction as the business change.

Examples:

* Cache invalidation.
* Cache warming.
* Media cleanup.
* Archive operations.
* Public announcement events.
* Important audit-related asynchronous tasks.

---

# 71. Outbox Idempotency

Workers may receive the same outbox event more than once.

Processing must therefore be idempotent.

Each event must have an idempotency mechanism such as:

* Unique event ID.
* Processed marker.
* Idempotency key.

---

# 72. Outbox Processing

A worker periodically:

1. Claim a batch of pending events.
2. Processes them.
3. Marks them successfully processed.
4. Records failures.
5. Retries retryable failures.

Use database locking to prevent multiple workers from processing the same event simultaneously.

---

# 73. Background Jobs

Background jobs include:

* Event completion.
* Cache invalidation.
* Cache warming.
* Media cleanup.
* Historical archiving.
* Outbox cleanup.
* Analytics aggregation where necessary.
* Backup verification.

Jobs must be:

* Batched.
* Retryable.
* Idempotent.
* Observable.

---

# 74. Job Failure Management

Failed jobs must not disappear silently.

Store:

* Attempt count.
* Last attempted time.
* Error information.
* Next retry time.
* Final failure state.

Repeated failures should become visible to Super Admin through the operational system.

---

# 75. PostgreSQL Responsibilities

PostgreSQL is responsible for:

* Authoritative data.
* Data constraints.
* Referential integrity.
* Authorization logic where appropriate.
* RLS.
* Atomic business operations.
* Lifecycle transitions.
* Outbox creation.
* Cache dependency updates.
* Audit writes.

---

# 76. Supabase Edge Function Responsibilities

Edge Functions are used when backend orchestration requires capabilities outside a normal database transaction.

Examples:

* External service integration.
* R2-related orchestration where appropriate.
* Email/notification delivery if later enabled.
* Scheduled workflows.
* Background processing.

Do not move every database operation into an Edge Function.

---

# 77. PostgreSQL RPC Responsibilities

Use database functions/RPCs for operations that need:

* Multiple related mutations.
* Atomicity.
* Server-side authorization.
* State transitions.
* Outbox insertion.
* Audit logging.

This prevents business-critical workflows from becoming fragile client-side multi-step operations.

---

# 78. Public Read Architecture

Public event data should be exposed through intentionally designed interfaces.

Possible mechanisms:

* Public-safe PostgreSQL views.
* RPCs.
* Supabase REST access under RLS.

The Student Website should not receive administrative fields just because those fields exist on the underlying table.

---

# 79. Admin Write Architecture

Administrative changes should go through authorized server-side operations.

A mutation should generally:

```text id="l7n9k2"
Authorize
   ↓
Validate
   ↓
Mutate
   ↓
Audit
   ↓
Outbox
   ↓
Commit
```

All steps that must be atomic belong in the same transaction.

External side effects happen after commit.

---

# 80. Row Level Security

RLS is mandatory for production tables where authorization boundaries apply.

RLS must enforce:

* Public-read restrictions.
* Organizer ownership.
* Super Admin access.
* Admin-access requests.
* Private administrative information.

Exact RLS policies are defined in:

`SECURITY_ARCHITECTURE.md`

---

# 81. Database Constraints

Critical invariants must be protected at database level.

Examples:

* Valid lifecycle states.
* Valid registration modes.
* Valid category/subcategory relationships.
* `end_at > start_at`.
* Required external URL for EXTERNAL registration.
* Referential integrity.
* Unique administrator identities where required.
* Valid status transitions where appropriate.

Do not rely only on React form validation.

---

# 82. Organizer Ownership Enforcement

The server must derive organizer ownership from the authenticated administrator identity.

The client must never be trusted to choose which organizer owns an event.

An Organizer attempting to modify another Organizer's event must be rejected even if they manipulate the request payload.

---

# 83. Direct Publish Validation

Because events are published directly:

Every publish operation must perform server-side validation.

Validation includes:

* Required fields.
* Taxonomy.
* Date/time.
* Registration configuration.
* URL.
* Content limits.
* Media references.
* Authorization.
* Cross-field constraints.

Only after validation succeeds does the event become `PUBLISHED`.

---

# 84. Event Editing

Published events remain editable according to field-level rules.

Every edit must:

* Revalidate authorization.
* Revalidate input.
* Validate cross-field rules.
* Update modification metadata.
* Create audit information for important changes.
* Trigger targeted cache invalidation.
* Trigger cache warming where needed.

---

# 85. Audit Architecture

Audit records should exist independently from the business records they describe.

Important actions include:

* Event creation.
* Event publication.
* Event modification.
* Event cancellation/deletion.
* Organizer approval.
* Organizer rejection.
* Advertisement changes.
* Featured Event changes.
* Event Memory changes.
* Carousel changes.
* Global Setting changes.
* High-impact administrative actions.

---

# 86. Audit Immutability

Audit data is append-oriented.

Ordinary administrators should not be able to alter historical audit entries.

An audit entry records, where applicable:

* Actor.
* Role.
* Action.
* Target type.
* Target ID.
* Timestamp.
* Reason.
* Relevant before/after metadata.

---

# 87. Analytics

PostHog is the analytics platform.

One shared PostHog project is used by both applications.

Every analytics event contains:

For Student Website:

```text id="amks9j"
app: "student"
```

For Admin Website:

```text id="qf4e2d"
app: "admin"
```

---

# 88. Analytics Non-Blocking Rule

Analytics must never be a prerequisite for core application functionality.

If PostHog is unavailable:

* Students can still browse events.
* Admins can still manage events.
* Publishing/editing can continue.
* Advertisements can continue functioning.

Analytics is observational, not transactional.

---

# 89. External Registration Click Analytics

The platform may record when a student clicks an external registration URL.

This metric must be called:

**Registration Link Click**

It must never be represented as:

* Registration completed.
* Ticket purchased.
* Ticket issued.
* Payment completed.

Only the external platform knows those outcomes.

---

# 90. Privacy

The Student Website is anonymous.

The platform should minimize collection of personal information for event discovery.

Analytics identifiers should be pseudonymous.

Analytics identifiers must not be treated as authenticated student accounts.

---

# 91. Environment Architecture

There are three environments:

```text id="h7y2qe"
LOCAL
STAGING
PRODUCTION
```

---

# 92. Local Environment

Local development uses:

* Docker Desktop.
* Supabase CLI.
* Local PostgreSQL.
* Local Supabase Auth.
* Local development applications.
* Development R2 resources where needed.

Both macOS and Windows must reproduce the same repository-defined environment.

---

# 93. Staging Environment

Staging is a remote environment used to verify:

* Integration.
* Deployment.
* Authentication.
* Database migrations.
* R2 behavior.
* Cache behavior.
* Application builds.
* End-to-end flows.

Staging must not use production credentials or production media buckets.

---

# 94. Production Environment

Production consists of:

```text id="jkrv8c"
Student Website
Admin Website
Supabase PostgreSQL/Auth
Cloudflare R2
PostHog
Cloudflare protection/hosting
```

Production secrets are stored through the relevant platform secret-management systems.

---

# 95. Frontend Deployment

Student Website:

```text id="3f0jqy"
apps/student-web
      ▼
Cloudflare Pages Project A
```

Admin Website:

```text id="nkw4jd"
apps/admin-web
      ▼
Cloudflare Pages Project B
```

They remain independent deployments.

---

# 96. Cloudflare Protection

Cloudflare should sit in front of production web traffic.

Use appropriate:

* WAF.
* DDoS protection.
* Bot protection.
* Rate limiting.
* Security headers.
* Turnstile on sensitive administrative actions where appropriate.

Public event discovery should remain lightweight.

---

# 97. Security Headers

Production applications should use appropriate security headers, including where applicable:

* Content-Security-Policy.
* Strict-Transport-Security.
* X-Frame-Options.
* Referrer-Policy.
* Permissions-Policy.

The final CSP must be compatible with:

* Supabase.
* PostHog.
* R2/media.
* External registration links.
* Required application services.

---

# 98. CI/CD

GitHub Actions validates the repository.

At minimum:

```text id="9ayup4"
Install
  ▼
Typecheck
  ▼
Lint
  ▼
Tests
  ▼
Student build
  ▼
Admin build
  ▼
Migration validation
```

Changes should be validated before deployment.

---

# 99. Monorepo Deployment Isolation

Changing Student Website code should not automatically deploy the Admin Website.

Changing Admin Website code should not automatically deploy the Student Website.

Changing shared code may trigger validation/build for both applications.

Changing migrations should trigger database migration validation.

---

# 100. Database Backup

PostgreSQL is the single operational source of truth.

Automated encrypted daily backups are stored separately.

Backups should:

* Be encrypted.
* Be verified after creation.
* Have retention rules.
* Generate failure alerts.
* Never replace a known-good backup until the next backup is verified.

---

# 101. Backup Storage

Cloudflare R2 can be used for backup storage.

Use separate backup locations from ordinary public media.

Production backups must never be publicly readable.

---

# 102. Historical Archive

Historical events reaching retention limits may be archived into R2.

Archive format may use:

* JSON.
* Parquet.

The chosen format should depend on the intended retrieval/analytics use.

The operational database record must not be deleted until archive integrity is verified.

---

# 103. Disaster Recovery

Disaster recovery must be tested periodically.

The project must document:

* Backup restoration.
* Database restoration.
* R2 recovery.
* Environment reconstruction.
* DNS/hosting recovery.
* Migration recovery.

A backup that has never been restored is not considered fully trustworthy.

---

# 104. Failure Handling

## PostgreSQL unavailable

The system cannot guarantee correct dynamic data.

The application should fail clearly rather than display misleading stale authoritative state.

## Cache unavailable

Read directly from the authoritative source where feasible.

## R2 unavailable

Core event metadata should remain available if already cached/stored.

Media uploads should enter retry/failure handling.

## PostHog unavailable

Core application operation continues.

## Worker unavailable

Committed outbox events remain pending for later processing.

---

# 105. Cache as Optimization

Cache is never authoritative.

The database remains the source of truth.

If all caches disappear, the platform must be able to regenerate them from PostgreSQL.

---

# 106. Cross-Platform Development

The development workflow supports:

* macOS.
* Windows.

The source of truth is GitHub.

Do not use:

* iCloud project synchronization.
* OneDrive project synchronization.
* Shared local folders.

Both systems run the same:

* Repository.
* Docker.
* Supabase local environment.
* npm commands.
* Migrations.

---

# 107. Database Migration Workflow

All production schema changes must be represented as version-controlled Supabase migrations.

Workflow:

```text id="5s0wux"
Schema change
     │
     ▼
Migration
     │
     ▼
Local reset/test
     │
     ▼
Commit
     │
     ▼
CI validation
     │
     ▼
Staging
     │
     ▼
Production
```

No undocumented manual production schema modifications.

---

# 108. Seed Data

Development seed data may exist in:

`supabase/seed.sql`

Seed data must contain only safe development/test records.

It must not contain:

* Production users.
* Real student information.
* Production secrets.
* Production media references.

---

# 109. Environment Secrets

Secrets must never be committed.

The repository contains:

```text id="x4v4ig"
.env.example
```

Real credentials belong in local ignored files or deployment secret management.

Examples include:

* Supabase service role key.
* R2 secret.
* PostHog private configuration where required.
* Other platform secrets.

---

# 110. No Secret Exposure

The following must never be shipped into browser bundles:

* Supabase service-role key.
* R2 secret key.
* Database credentials.
* Admin-only credentials.
* Other privileged secrets.

Only public client-safe values may be exposed to the frontend.

---

# 111. Dependency Strategy

Keep infrastructure and dependencies minimal.

Do not add:

* Redis.
* Elasticsearch.
* Kafka.
* Kubernetes.
* MinIO.
* Separate database.
* Dedicated queue service.

unless actual measured requirements justify them.

---

# 112. Performance Strategy

Performance priorities:

1. Fast homepage.
2. Fast event search.
3. Efficient event details.
4. Optimized media.
5. Minimal database load.
6. Targeted cache invalidation.
7. Progressive/incremental event loading.

Avoid:

* Large unbounded queries.
* Unnecessary realtime subscriptions.
* Fetching all events to the browser.
* Rebuilding the entire homepage for small changes.

---

# 113. HTTP and Browser Caching

Static assets should use long-lived caching with content hashes.

Public immutable media can use long cache lifetimes.

Dynamic public data should use appropriate short TTL/SWR policies.

Admin data should not be cached publicly.

---

# 114. Realtime

Realtime is not enabled globally.

**The Student Website does NOT use Supabase Realtime.**

Reasoning:

* Supabase Free allows 200 concurrent Realtime connections and 2M messages/month.
* With 10,000 students, even a fraction connecting simultaneously would exhaust the concurrent connection limit.
* Students do not need live push updates for event discovery.
* Data freshness is achieved through Cloudflare edge cache TTL expiry and admin-triggered cache invalidation.

The Admin Website may optionally use Realtime for:

* Dashboard live indicators (e.g., new access requests).
* Limited to authenticated admin users (~10 concurrent connections).

Admin Realtime usage must remain within:

* ≤ 10 concurrent connections.
* ≤ 50,000 messages/month.

Refer to `FREE_TIER_CAPACITY.md` Section 4.7 for Realtime budget details.

---

# 115. Version-Based Data Synchronization

The database maintains resource-specific server-generated versions such as:

```text id="iyg6r1"
events_version
categories_version
ads_version
featured_version
memories_version
carousel_version
settings_version
```

These versions are updated transactionally when relevant data changes.

### Server-Side Usage (Active)

Resource versions are used for:

* Server-side cache key versioning.
* Conditional HTTP response headers (ETag / If-None-Match).
* Admin dashboard staleness detection.
* Outbox-driven cache invalidation targeting.

### Client-Side Polling (Disabled for Free Tier)

**The Student Website MUST NOT poll version endpoints.**

Reasoning:

* 10,000 browsers polling `/api/versions` every 30 seconds = ~28.8M requests/day.
* This would exhaust Supabase egress and Cloudflare Workers quotas.
* Even with edge caching, the traffic volume is unnecessary.

Instead, data freshness on the Student Website is managed through:

```text
Admin mutation
    ↓
Database transaction (version increment + outbox entry)
    ↓
Outbox processor fires
    ↓
Cloudflare cache purge for affected keys
    ↓
Next student request gets fresh data
```

Refer to `FREE_TIER_CAPACITY.md` Section 7 for the full revised synchronization flow.

---

# 116. Security Review Strategy

Security reviews occur in stages.

After each major implementation module:

* Authentication.
* Authorization.
* Event management.
* Media.
* Homepage administration.
* Search/discovery.

Perform a targeted security review.

After the full product is feature-complete:

Perform:

* End-to-end security review.
* Permission review.
* RLS review.
* Penetration testing.
* Disaster-recovery testing.

Do not delay basic security controls until the end.

---

# 117. Architecture Loophole Review

The architecture was reviewed against common failure modes.

### Loophole 1 — Student login accidentally reintroduced

**Fix:** Student Website is anonymous.

### Loophole 2 — Google Sign-In or password authentication sneaks in

**Fix:** Admin authentication is Email OTP only.

### Loophole 3 — Approval workflow accidentally returns

**Fix:** Direct Publish is the canonical workflow.

### Loophole 4 — Draft rows accumulate

**Fix:** No persisted draft events.

### Loophole 5 — Ticketing requirements return

**Fix:** Ticketing is explicitly outside the architecture.

### Loophole 6 — External registration is mistaken for internal registration

**Fix:** `EXTERNAL` only stores/opens an external destination.

### Loophole 7 — External registration success is falsely inferred

**Fix:** Registration-link click is the maximum native platform knowledge.

### Loophole 8 — Cancelled events remain visible

**Fix:** Cancellation removes them from operational discovery immediately.

### Loophole 9 — Cancellation destroys audit evidence

**Fix:** Audit records are independent from event rows.

### Loophole 10 — Cache becomes a source of truth

**Fix:** PostgreSQL is always authoritative.

### Loophole 11 — Cache race restores stale content

**Fix:** Versioned/single-flight regeneration.

### Loophole 12 — R2 objects become orphaned

**Fix:** Orphan cleanup process.

### Loophole 13 — Database deletion breaks media deletion

**Fix:** Media cleanup uses transactional outbox work.

### Loophole 14 — Analytics outage blocks publishing

**Fix:** Analytics is asynchronous/non-critical.

### Loophole 15 — UTC breaks Today/Tomorrow

**Fix:** Asia/Kolkata is the business timezone.

### Loophole 16 — Organizer edits someone else's event

**Fix:** RLS + backend ownership validation.

### Loophole 17 — Client changes owner ID

**Fix:** Ownership derives from authenticated identity.

### Loophole 18 — Direct publishing bypasses validation

**Fix:** Publish-time server validation plus database constraints.

### Loophole 19 — Historical archive deleted before successful backup

**Fix:** Archive first, verify, then delete.

### Loophole 20 — Backup never tested

**Fix:** Scheduled restore testing is required.

---

# 118. Implementation Order

The architecture should now be implemented through the following documentation sequence:

```text id="x7f0vv"
TECH_STACK.md
       │
       ▼
SYSTEM_ARCHITECTURE.md
       │
       ▼
DATABASE_SCHEMA.md
       │
       ▼
API_CONTRACTS.md
       │
       ▼
SECURITY_ARCHITECTURE.md
       │
       ▼
CACHING_ARCHITECTURE.md
       │
       ▼
STUDENT_UI_SPEC.md
       │
       ▼
ADMIN_UI_SPEC.md
       │
       ▼
IMPLEMENTATION_PLAN.md
```

The exact order of UI and API documentation can be adjusted when detailed design begins, but database and security contracts must exist before implementing major business logic.

---

# 119. Completion Criteria

This architecture is considered the approved baseline when:

* Student Website is anonymous/public.
* Admin Website uses Email OTP only.
* Organizer and Super Admin authorization are separate.
* One `events` table is the event source of truth.
* Events publish directly.
* Persistent drafts are not stored.
* Event approval is not part of the normal lifecycle.
* Events transition to Completed after `end_at`.
* Cancellation removes the event from operational discovery.
* Cancellation remains auditable.
* Registration is external only.
* No internal registration exists.
* No ticketing exists.
* No payment processing exists.
* No booking exists.
* PostgreSQL remains the source of truth.
* Search uses PostgreSQL.
* Homepage caching is dependency-driven.
* Cache regeneration is proactive.
* R2 stores media and archives.
* Outbox processing is idempotent.
* Background jobs are retryable.
* Analytics cannot block core functionality.
* Backups are independent and verified.
* Student and Admin Websites remain independently deployable.
* Mac and Windows can reproduce the local development environment.

---

# 120. Final Architecture Definition

**LPU Events is a two-application event-discovery platform built around a single Supabase PostgreSQL source of truth. The Student Website is a public anonymous React/Vite application for discovering and viewing events. The Admin Website is a separately deployed authenticated React/Vite application for managing events and platform content. Admin authentication uses Email OTP only, with Organizer and Super Admin authorization enforced separately through backend controls and PostgreSQL RLS. Events are stored in one `events` table and published directly without a normal approval queue or persisted draft system. Registration is external only. LPU Events does not process ticket booking, payments, reservations, ticket generation, QR verification, or refunds. Cloudflare R2 handles media, backups, and historical archives. PostgreSQL provides authoritative data, constraints, transactional operations, RLS, cache dependencies, and outbox events. Dependency-driven caching, proactive warming, versioned synchronization, and idempotent background processing are used to maintain performance and consistency without unnecessary infrastructure.**

This document is the architectural baseline for the remaining technical design documents.
