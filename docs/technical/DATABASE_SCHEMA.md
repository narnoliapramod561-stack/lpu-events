# LPU Events — Database Schema

**File:** `docs/technical/DATABASE_SCHEMA.md`  
**Status:** LOCKED — Database Design Baseline  
**Version:** 1.0  
**Date:** 14 August 2026

---

# 1. Purpose

This document defines the PostgreSQL database architecture for LPU Events.

PostgreSQL is the single operational source of truth.

This document defines:

- Tables.
- Columns.
- Data types.
- Relationships.
- Enumerations.
- Constraints.
- Indexes.
- Ownership.
- Auditability.
- Outbox processing.
- Media metadata.
- Version synchronization.
- Retention.
- Archival metadata.
- Database-level invariants.

The actual SQL migrations must be derived from this document.

No production database table should be created outside the version-controlled Supabase migration system.

---

# 2. Database Principles

The database follows these principles:

1. PostgreSQL is authoritative.
2. One `events` table is the event source of truth.
3. No ticketing database exists.
4. No payment database exists.
5. No booking database exists.
6. No reservation database exists.
7. No persisted event draft table exists.
8. No event approval table exists.
9. Business-critical invariants are enforced by PostgreSQL.
10. Authorization is enforced through RLS and server-side logic.
11. Audit records survive deletion of the object they describe.
12. Outbox events are created transactionally.
13. Media metadata is separate from media binaries.
14. Analytics that belong in PostHog are not unnecessarily duplicated in PostgreSQL.
15. Historical data is retained according to an explicit retention policy.
16. Soft deletion is not used indiscriminately.
17. Hard deletion is used where the product explicitly requires permanent removal.
18. Database indexes must support actual query patterns.
19. All timestamps are timezone-aware.
20. Schema changes are version-controlled through Supabase migrations.

---

# 3. Database Overview

The major database domains are:

```text
Administrative
├── admin_users
├── organizations
├── organization_members
└── organizer_access_requests

Event Management
├── events
├── categories
└── subcategories

Content Management
├── advertisements
├── advertisement_positions
├── featured_events
├── carousel_items
├── event_memories
├── sponsors
└── global_settings

Media
└── media_assets

Operations
├── audit_logs
├── outbox_events
├── background_jobs
├── archive_records
└── resource_versions
```

---

# 4. Explicitly Excluded Tables

The following tables must NOT exist in the current architecture:

```text
tickets
bookings
reservations
ticket_inventory
payments
payment_attempts
refunds
ticket_verification
qr_tokens
seats
seat_inventory
```

LPU Events does not own these concepts.

Registration is external.

---

# 5. PostgreSQL Extensions

Only required PostgreSQL extensions should be enabled.

Expected extensions may include:

```text
pgcrypto
pg_trgm
```

### `pgcrypto`

Used for secure UUID generation and cryptographic functions where required.

### `pg_trgm`

Used to support efficient event-name contains/fuzzy search where appropriate.

No extension should be added merely because it is popular.

---

# 6. UUID Strategy

Primary identifiers should use UUIDs.

Recommended:

```sql
gen_random_uuid()
```

UUIDs prevent predictable sequential identifiers from being exposed publicly.

The event ID remains constant for the entire event lifetime.

---

# 7. Timestamp Strategy

All business timestamps use timezone-aware PostgreSQL timestamps:

```text
timestamptz
```

Store timestamps in UTC-aware form.

Business date calculations use:

```text
Asia/Kolkata
```

The application must not store local wall-clock timestamps without timezone context.

---

# 8. Administrative Domain

## 8.1 `admin_users`

Represents users who are allowed to interact with the Admin Website.

This table maps Supabase Auth identities to application-level administrative records.

### Columns

| Column         | Type        | Null | Description                              |
| -------------- | ----------- | ---: | ---------------------------------------- |
| `id`           | uuid        |   NO | Application admin ID                     |
| `auth_user_id` | uuid        |   NO | References `auth.users.id`               |
| `display_name` | text        |   NO | Administrative display name              |
| `email`        | text        |   NO | Normalized administrative email          |
| `is_active`    | boolean     |   NO | Whether admin access is currently active |
| `created_at`   | timestamptz |   NO | Creation timestamp                       |
| `updated_at`   | timestamptz |   NO | Last modification timestamp              |

### Constraints

* `auth_user_id` must be unique.
* Email must be normalized.
* Inactive administrators cannot perform administrative operations.
* The browser must never be able to arbitrarily create an `admin_users` record.

---

# 9. `organizations`

Represents the club/department/organization that owns events.

### Columns

| Column       | Type        | Null | Description                    |
| ------------ | ----------- | ---: | ------------------------------ |
| `id`         | uuid        |   NO | Organization ID                |
| `name`       | text        |   NO | Organization name              |
| `is_active`  | boolean     |   NO | Whether organization is active |
| `created_at` | timestamptz |   NO | Creation timestamp             |
| `updated_at` | timestamptz |   NO | Last modification timestamp    |

### Constraints

* Organization name must not be empty.
* Active organization names should be unique according to normalized comparison rules.

---

# 10. `organization_members`

Maps administrators to organizations.

This is intentionally separate from `admin_users`.

One administrator identity can therefore be associated with an organization without embedding organization ownership directly into the authentication identity.

### Columns

| Column            | Type                     | Null | Description            |
| ----------------- | ------------------------ | ---: | ---------------------- |
| `id`              | uuid                     |   NO | Membership ID          |
| `organization_id` | uuid                     |   NO | Organization           |
| `admin_user_id`   | uuid                     |   NO | Administrator          |
| `role`            | organization_member_role |   NO | Membership role        |
| `is_active`       | boolean                  |   NO | Membership status      |
| `created_at`      | timestamptz              |   NO | Creation timestamp     |
| `updated_at`      | timestamptz              |   NO | Modification timestamp |

### Role

Current role:

```text
ORGANIZER
```

Super Admin is NOT represented by an organization membership.

Super Admin is a platform-level role.

### Constraints

A user must not have duplicate active membership in the same organization.

---

# 11. `organizer_access_requests`

Stores requests for administrative organizer access.

### Columns

| Column              | Type                  | Null | Description                        |
| ------------------- | --------------------- | ---: | ---------------------------------- |
| `id`                | uuid                  |   NO | Request ID                         |
| `admin_user_id`     | uuid                  |   NO | Requesting administrator           |
| `organization_name` | text                  |   NO | Requested club/department name     |
| `remarks`           | text                  |  YES | Optional remarks                   |
| `status`            | access_request_status |   NO | Request state                      |
| `reviewed_by`       | uuid                  |  YES | Super Admin who reviewed           |
| `reviewed_at`       | timestamptz           |  YES | Review timestamp                   |
| `review_reason`     | text                  |  YES | Optional rejection/approval reason |
| `created_at`        | timestamptz           |   NO | Creation timestamp                 |
| `updated_at`        | timestamptz           |   NO | Modification timestamp             |

### Status

```text
PENDING
APPROVED
REJECTED
```

### Constraints

Only one active `PENDING` request is permitted per administrator.

A rejected request may later create a new request.

An approved request should result in an organization and membership being created through one authorized transactional operation.

---

# 12. Super Admin Representation

Super Admin authorization must not depend on a client-controlled column.

Recommended implementation:

```text
admin_users
      ↓
platform_admin_roles
```

## `platform_admin_roles`

### Columns

| Column          | Type                | Null | Description   |
| --------------- | ------------------- | ---: | ------------- |
| `admin_user_id` | uuid                |   NO | Administrator |
| `role`          | platform_admin_role |   NO | Platform role |
| `created_at`    | timestamptz         |   NO | Creation time |

Current role:

```text
SUPER_ADMIN
```

### Critical Constraint

There must be exactly one active Super Admin under the current product requirement.

This must be enforced through a database-level unique strategy rather than frontend assumptions.

---

# 13. Event Domain

## 13.1 `events`

This is the **single source of truth for all operational events**.

There must not be separate draft, pending, or published event tables.

### Columns

| Column                      | Type               | Null | Description                               |
| --------------------------- | ------------------ | ---: | ----------------------------------------- |
| `id`                        | uuid               |   NO | Permanent event ID                        |
| `organization_id`           | uuid               |   NO | Owning organization                       |
| `created_by`                | uuid               |   NO | Admin who created event                   |
| `updated_by`                | uuid               |   NO | Admin who last modified event             |
| `name`                      | text               |   NO | Event name                                |
| `description`               | text               |   NO | Main event description/content            |
| `category_id`               | uuid               |   NO | Category                                  |
| `subcategory_id`            | uuid               |  YES | Optional subcategory                      |
| `banner_media_id`           | uuid               |  YES | Event banner                              |
| `start_at`                  | timestamptz        |   NO | Event start                               |
| `end_at`                    | timestamptz        |   NO | Event end                                 |
| `venue_name`                | text               |   NO | Venue                                     |
| `registration_mode`         | registration_mode  |   NO | NONE or EXTERNAL                          |
| `external_registration_url` | text               |  YES | External registration destination         |
| `registration_opens_at`     | timestamptz        |  YES | Informational registration opening        |
| `registration_closes_at`    | timestamptz        |  YES | Informational registration closing        |
| `pricing_type`              | event_pricing_type |   NO | FREE or PAID                              |
| `registration_format`       | text               |  YES | INDIVIDUAL or TEAM (for EXTERNAL mode)     |
| `capacity_limit`            | integer            |  YES | Maximum capacity of the event              |
| `capacity_counts_by`        | text               |  YES | TEAMS or STUDENTS                          |
| `team_pricing_mode`         | text               |  YES | FIXED_TEAM_PRICE or PER_MEMBER_PRICE       |
| `price_amount`              | numeric            |  YES | Informational event price amount           |
| `status`                    | event_status       |   NO | PUBLISHED or COMPLETED                    |
| `view_count`                | bigint             |   NO | Aggregated view count if retained locally |
| `created_at`                | timestamptz        |   NO | Creation time                             |
| `updated_at`                | timestamptz        |   NO | Last modification time                    |
| `completed_at`              | timestamptz        |  YES | Completion transition time                |

---

# 14. Event Status

The canonical status enum is:

```text
PUBLISHED
COMPLETED
```

There is intentionally no:

```text
DRAFT
PENDING_APPROVAL
APPROVED
CANCELLED
```

Cancellation is represented by deletion.

---

# 15. Event Registration Mode

```text
NONE
EXTERNAL
```

### NONE

No registration URL is required.

### EXTERNAL

`external_registration_url` is mandatory.

---

# 16. Event Pricing Type

```text
FREE
PAID
```

This is informational.

`PAID` does not create a payment record.

---

# 17. Event Integrity Constraints

The database must enforce:

```text
end_at > start_at
```

For EXTERNAL registration:

```text
external_registration_url IS NOT NULL
```

For NONE registration:

```text
external_registration_url IS NULL
```

Registration dates, if present, must be logically valid:

```text
registration_closes_at >= registration_opens_at
```

where both exist.

For team registration and pricing details, the database enforces:

```text
-- Valid values
registration_format IN ('INDIVIDUAL', 'TEAM')
capacity_counts_by IN ('TEAMS', 'STUDENTS')
team_pricing_mode IN ('FIXED_TEAM_PRICE', 'PER_MEMBER_PRICE')
capacity_limit > 0
price_amount >= 0

-- Conditional constraints
if registration_mode == 'EXTERNAL':
    registration_format IS NOT NULL

if registration_format == 'TEAM':
    capacity_counts_by IS NOT NULL

if pricing_type == 'PAID':
    price_amount IS NOT NULL
    if registration_format == 'TEAM':
         team_pricing_mode IS NOT NULL

if pricing_type == 'FREE':
    price_amount == 0 OR price_amount IS NULL
```

---

# 18. Event Taxonomy Integrity

An event's category/subcategory combination must be valid.

Do not allow:

```text
Category A
+
Subcategory belonging to Category B
```

This should be enforced using relational constraints rather than frontend checks alone.

---

# 19. Dynamic About Content

The event description may need structured/dynamic sections.

Do not put uncontrolled HTML directly into a large database field without sanitization.

Recommended model:

## `event_content_sections`

| Column         | Type        | Description                  |
| -------------- | ----------- | ---------------------------- |
| `id`           | uuid        | Section ID                   |
| `event_id`     | uuid        | Event                        |
| `section_type` | text        | Content type                 |
| `title`        | text        | Section title                |
| `content`      | jsonb       | Structured sanitized content |
| `sort_order`   | integer     | Display order                |
| `created_at`   | timestamptz | Created                      |
| `updated_at`   | timestamptz | Updated                      |

The exact supported section types are defined in the UI specification.

### Constraint

`sort_order` must be deterministic per event.

---

# 20. Event Media

An event should reference media through `media_assets`.

Do not store R2 URLs directly as the only source of truth.

Store a stable media object reference.

This allows:

* CDN URL changes.
* Object migration.
* Cleanup.
* Metadata tracking.

---

# 21. Categories

## `categories`

### Columns

| Column       | Type        | Null | Description         |
| ------------ | ----------- | ---: | ------------------- |
| `id`         | uuid        |   NO | Category ID         |
| `key`        | text        |   NO | Stable category key |
| `name`       | text        |   NO | Display name        |
| `sort_order` | integer     |   NO | Display order       |
| `is_active`  | boolean     |   NO | Whether available   |
| `created_at` | timestamptz |   NO | Created             |
| `updated_at` | timestamptz |   NO | Updated             |

`key` is immutable once used by events.

---

# 22. Subcategories

## `subcategories`

### Columns

| Column        | Type        | Null | Description     |
| ------------- | ----------- | ---: | --------------- |
| `id`          | uuid        |   NO | Subcategory ID  |
| `category_id` | uuid        |   NO | Parent category |
| `key`         | text        |   NO | Stable key      |
| `name`        | text        |   NO | Display name    |
| `sort_order`  | integer     |   NO | Display order   |
| `is_active`   | boolean     |   NO | Availability    |
| `created_at`  | timestamptz |   NO | Created             |
| `updated_at`  | timestamptz |   NO | Updated             |

Unique constraint:

```text
(category_id, key)
```

---

# 23. Taxonomy Immutability

Category/subcategory keys referenced by existing events should not be silently renamed.

If a display name changes:

* Update the display name.
* Preserve the stable key.

If a taxonomy item is retired:

* Mark inactive.
* Do not delete it while historical events reference it.

This prevents historical event records from becoming invalid.

---

# 24. Media Domain

## `media_assets`

Tracks objects stored in Cloudflare R2.

### Columns

| Column            | Type         | Null | Description            |
| ----------------- | ------------ | ---: | ---------------------- |
| `id`              | uuid         |   NO | Media ID               |
| `bucket`          | text         |   NO | R2 bucket identifier   |
| `object_key`      | text         |   NO | R2 object key          |
| `media_type`      | media_type   |   NO | Event banner, ad, etc. |
| `mime_type`       | text         |   NO | MIME type              |
| `file_size_bytes` | bigint       |   NO | File size              |
| `checksum`        | text         |  YES | Integrity checksum     |
| `width`           | integer      |  YES | Image width            |
| `height`          | integer      |  YES | Image height           |
| `status`          | media_status |   NO | Upload lifecycle       |
| `created_by`      | uuid         |   NO | Admin uploader         |
| `created_at`      | timestamptz  |   NO | Created                |
| `verified_at`     | timestamptz  |  YES | Verification timestamp |
| `deleted_at`      | timestamptz  |  YES | Cleanup marker         |

---

# 25. Media Status

```text
UPLOADING
READY
FAILED
PENDING_DELETE
DELETED
```

Only `READY` media may be referenced by published content.

---

# 26. Media Object Uniqueness

The combination:

```text
bucket + object_key
```

must be unique.

This prevents accidental object collisions.

---

# 27. Advertisement Domain

## `advertisements`

### Columns

| Column         | Type                 | Null | Description      |
| -------------- | -------------------- | ---: | ---------------- |
| `id`           | uuid                 |   NO | Advertisement ID |
| `name`         | text                 |   NO | Internal name    |
| `media_id`     | uuid                 |   NO | Banner/image     |
| `redirect_url` | text                 |   NO | Destination      |
| `start_at`     | timestamptz          |   NO | Start time       |
| `end_at`       | timestamptz          |   NO | End time         |
| `status`       | advertisement_status |   NO | Lifecycle        |
| `created_by`   | uuid                 |   NO | Creator          |
| `updated_by`   | uuid                 |   NO | Last editor      |
| `created_at`   | timestamptz          |   NO | Created          |
| `updated_at`   | timestamptz          |   NO | Updated          |

Constraint:

```text
end_at > start_at
```

---

# 28. `advertisement_positions`

An advertisement can appear in multiple positions.

### Columns

| Column             | Type                   | Description   |
| ------------------ | ---------------------- | ------------- |
| `advertisement_id` | uuid                   | Advertisement |
| `position`         | advertisement_position | Placement     |
| `created_at`       | timestamptz            | Created       |

Primary key:

```text
(advertisement_id, position)
```

Supported positions:

```text
homepage_top
homepage_feed
event_top
event_bottom
```

---

# 29. Advertisement Feed Configuration

## `advertisement_feed_config`

Stores the Super Admin-configured event interval.

### Columns

| Column           | Type        | Description          |
| ---------------- | ----------- | -------------------- |
| `id`             | boolean     | Singleton identifier |
| `event_interval` | integer     | Events between ads   |
| `updated_by`     | uuid        | Last editor          |
| `updated_at`     | timestamptz | Last update          |

Constraint:

```text
event_interval > 0
```

A singleton row prevents multiple conflicting global feed intervals.

---

# 30. Advertisement Analytics

Advertisement analytics are separate from advertisement configuration.

## `advertisement_metrics_daily`

Stores aggregated daily metrics where PostgreSQL-side reporting is required.

### Columns

| Column             | Type        | Description      |
| ------------------ | ----------- | ---------------- |
| `advertisement_id` | uuid        | Advertisement    |
| `metric_date`      | date        | Reporting date   |
| `impressions`      | bigint      | Impression count |
| `clicks`           | bigint      | Click count      |
| `updated_at`       | timestamptz | Last update      |

Primary key:

```text
(advertisement_id, metric_date)
```

Raw product analytics remain in PostHog.

This table exists only for operational/reporting aggregates that the Admin Website needs efficiently.

---

# 31. Featured Events

## `featured_events`

Represents Super Admin curation.

### Columns

| Column       | Type        | Description   |
| ------------ | ----------- | ------------- |
| `event_id`   | uuid        | Event         |
| `sort_order` | integer     | Display order |
| `created_by` | uuid        | Admin         |
| `created_at` | timestamptz | Created       |
| `updated_at` | timestamptz | Updated       |

Primary key:

```text
event_id
```

---

# 32. Carousel

## `carousel_items`

Represents Homepage Carousel configuration.

### Columns

| Column             | Type               | Description            |
| ------------------ | ------------------ | ---------------------- |
| `id`               | uuid               | Carousel item          |
| `item_type`        | carousel_item_type | Item type              |
| `event_id`         | uuid               | Optional event         |
| `advertisement_id` | uuid               | Optional advertisement |
| `memory_id`        | uuid               | Optional memory        |
| `media_id`         | uuid               | Optional direct media  |
| `sort_order`       | integer            | Display order          |
| `is_active`        | boolean            | Active                 |
| `start_at`         | timestamptz        | Optional start         |
| `end_at`           | timestamptz        | Optional end           |
| `created_by`       | uuid               | Admin                  |
| `updated_by`       | uuid               | Admin                  |
| `created_at`       | timestamptz        | Created                |
| `updated_at`       | timestamptz        | Updated                |

The database must enforce that the referenced content matches `item_type`.

---

# 33. Event Memories

## `event_memories`

Represents historical event-memory content.

### Columns

| Column           | Type           | Description             |
| ---------------- | -------------- | ----------------------- |
| `id`             | uuid           | Memory ID               |
| `event_id`       | uuid           | Optional original event |
| `title`          | text           | Display title           |
| `description`    | text           | Description             |
| `cover_media_id` | uuid           | Cover image             |
| `status`         | content_status | Publication state       |
| `created_by`     | uuid           | Admin                   |
| `updated_by`     | uuid           | Admin                   |
| `created_at`     | timestamptz    | Created                 |
| `updated_at`     | timestamptz    | Updated                 |

The `event_id` may be nullable because a memory should be able to survive archival/deletion of the original event.

---

# 34. Event Memory Media

## `event_memory_media`

### Columns

| Column       | Type        | Description   |
| ------------ | ----------- | ------------- |
| `memory_id`  | uuid        | Event memory  |
| `media_id`   | uuid        | Media         |
| `sort_order` | integer     | Display order |
| `created_at` | timestamptz | Created       |

Primary key:

```text
(memory_id, media_id)
```

---

# 35. Sponsors

## `sponsors`

### Columns

| Column          | Type           | Description      |
| --------------- | -------------- | ---------------- |
| `id`            | uuid           | Sponsor ID       |
| `name`          | text           | Sponsor name     |
| `logo_media_id` | uuid           | Logo             |
| `website_url`   | text           | Optional website |
| `status`        | content_status | Status           |
| `sort_order`    | integer        | Display order    |
| `created_by`    | uuid           | Admin            |
| `updated_by`    | uuid           | Admin            |
| `created_at`    | timestamptz    | Created          |
| `updated_at`    | timestamptz    | Updated          |

---

# 36. Global Settings

## `global_settings`

Stores operational configuration that should be adjustable by Super Admin.

### Columns

| Column        | Type        | Description                |
| ------------- | ----------- | -------------------------- |
| `key`         | text        | Setting key                |
| `value`       | jsonb       | Setting value              |
| `description` | text        | Human-readable description |
| `updated_by`  | uuid        | Last editor                |
| `updated_at`  | timestamptz | Last update                |

Primary key:

```text
key
```

---

# 37. Global Setting Rules

Only settings explicitly designated as configurable should be stored here.

Examples:

```text
events_hub_initial_count
events_hub_increment
search_min_characters
search_debounce_ms
past_event_retention_days
view_deduplication_window
```

Do not store arbitrary application state in `global_settings`.

Security-sensitive configuration belongs in environment/platform secrets instead.

---

# 38. Resource Versions

## `resource_versions`

Provides lightweight version-based synchronization.

### Columns

| Column       | Type          | Description     |
| ------------ | ------------- | --------------- |
| `resource`   | resource_type | Resource        |
| `version`    | bigint        | Current version |
| `updated_at` | timestamptz   | Last change     |

Primary key:

```text
resource
```

Example resources:

```text
events
categories
ads
featured
memories
carousel
sponsors
settings
```

---

# 39. Version Increment Rules

A resource version must increase whenever a relevant public representation changes.

Example:

```text
Event updated
   ↓
events_version++
```

An advertisement update may increment:

```text
ads_version++
```

A category change may increment:

```text
categories_version++
```

Version increments must happen transactionally with the corresponding data mutation.

---

# 40. Audit Logs

## `audit_logs`

Audit records survive deletion of the entity they describe.

### Columns

| Column           | Type        | Description              |
| ---------------- | ----------- | ------------------------ |
| `id`             | uuid        | Audit ID                 |
| `actor_admin_id` | uuid        | Actor                    |
| `actor_role`     | text        | Role at action time      |
| `action`         | text        | Action                   |
| `target_type`    | text        | Entity type              |
| `target_id`      | uuid        | Entity ID                |
| `reason`         | text        | Optional reason          |
| `before_data`    | jsonb       | Relevant previous state  |
| `after_data`     | jsonb       | Relevant resulting state |
| `metadata`       | jsonb       | Additional context       |
| `created_at`     | timestamptz | Action timestamp         |

---

# 41. Audit Log Design

Audit records must not contain unnecessary secrets or sensitive data.

`before_data` and `after_data` should contain only fields necessary to reconstruct the administrative action.

Do not store:

* Authentication tokens.
* OTP values.
* Passwords.
* Service credentials.
* R2 credentials.

---

# 42. Audit Retention

Audit records should be retained longer than ordinary operational content.

The retention policy should be defined separately from event retention.

Deleting an event must never cascade-delete its audit history.

---

# 43. Transactional Outbox

## `outbox_events`

### Columns

| Column           | Type          | Description              |
| ---------------- | ------------- | ------------------------ |
| `id`             | uuid          | Outbox event ID          |
| `event_type`     | text          | Event type               |
| `aggregate_type` | text          | Source entity            |
| `aggregate_id`   | uuid          | Source entity ID         |
| `payload`        | jsonb         | Event payload            |
| `status`         | outbox_status | Processing state         |
| `attempt_count`  | integer       | Attempts                 |
| `available_at`   | timestamptz   | Earliest processing time |
| `locked_at`      | timestamptz   | Processing lock          |
| `locked_by`      | text          | Worker identity          |
| `processed_at`   | timestamptz   | Successful processing    |
| `last_error`     | text          | Last failure             |
| `created_at`     | timestamptz   | Creation                 |

---

# 44. Outbox Status

```text
PENDING
PROCESSING
PROCESSED
FAILED
```

Retryable failures should return to `PENDING`.

Permanent failures remain visible for operational intervention.

---

# 45. Outbox Idempotency

Every outbox event has a unique ID.

Workers must treat the ID as an idempotency key.

Processing the same event twice must not:

* Double-delete media.
* Double-count analytics.
* Corrupt cache state.
* Create duplicate notifications.

---

# 46. Background Jobs

## `background_jobs`

Tracks scheduled/operational jobs.

### Columns

| Column            | Type        | Description  |
| ----------------- | ----------- | ------------ |
| `id`              | uuid        | Job ID       |
| `job_type`        | text        | Job type     |
| `status`          | job_status  | Job status   |
| `attempt_count`   | integer     | Attempts     |
| `started_at`      | timestamptz | Start        |
| `finished_at`     | timestamptz | Finish       |
| `next_attempt_at` | timestamptz | Retry time   |
| `last_error`      | text        | Error        |
| `metadata`        | jsonb       | Job metadata |
| `created_at`      | timestamptz | Created      |
| `updated_at`      | timestamptz | Updated      |

Jobs must be batched and retryable.

---

# 47. Archive Records

## `archive_records`

Tracks historical data archived outside PostgreSQL.

### Columns

| Column           | Type           | Description        |
| ---------------- | -------------- | ------------------ |
| `id`             | uuid           | Archive ID         |
| `entity_type`    | text           | Entity             |
| `entity_id`      | uuid           | Original ID        |
| `archive_bucket` | text           | R2 bucket          |
| `object_key`     | text           | Archive object     |
| `checksum`       | text           | Integrity checksum |
| `status`         | archive_status | Archive state      |
| `archived_at`    | timestamptz    | Archive time       |
| `verified_at`    | timestamptz    | Verification       |
| `created_at`     | timestamptz    | Created            |

---

# 48. Archive Safety Rule

An operational record must not be permanently deleted merely because an archive upload started.

The order is:

```text
Create archive
      ↓
Verify archive
      ↓
Mark archive verified
      ↓
Delete operational data
```

---

# 49. Backup Metadata

Backups are primarily infrastructure-level artifacts rather than normal application data.

If application-level backup tracking is required:

## `backup_records`

### Columns

| Column               | Type          | Description        |
| -------------------- | ------------- | ------------------ |
| `id`                 | uuid          | Backup ID          |
| `backup_date`        | timestamptz   | Backup timestamp   |
| `storage_object_key` | text          | R2 object          |
| `checksum`           | text          | Integrity checksum |
| `status`             | backup_status | Status             |
| `verified_at`        | timestamptz   | Verification       |
| `created_at`         | timestamptz   | Created            |

This table must never contain actual database secrets.

---

# 50. View Analytics

Raw student event views should primarily be handled by PostHog.

The database should not store a raw event-view row for every page visit unless later scale/analytics requirements justify it.

If the Admin Website needs fast event-level totals, the `events.view_count` field may hold an aggregated count.

The aggregation mechanism must be designed to avoid turning every page view into a heavyweight PostgreSQL transaction.

---

# 51. Event View Count Integrity

`view_count` is an analytics metric.

It is not a security-sensitive invariant.

If analytics temporarily fail:

* Event remains available.
* Event editing continues.
* Publishing continues.

Analytics may be reconciled later.

---

# 52. Registration Click Analytics

Registration-link clicks should primarily be tracked through PostHog.

Optional PostgreSQL aggregates may be introduced later if the Admin Website needs SQL-native reporting.

Do not create a raw `registration_clicks` table unless a measured requirement exists.

---

# 53. Foreign Key Deletion Strategy

Foreign key behavior must be explicitly chosen.

Do not use `ON DELETE CASCADE` blindly.

Examples:

### Events → Audit

```text
NO ACTION / independent audit
```

Audit must survive event deletion.

### Events → Event content sections

```text
CASCADE
```

Content has no meaning without the event.

### Events → Featured

```text
CASCADE
```

A deleted event cannot remain Featured.

### Events → Carousel

Deletion must be handled safely and must not leave invalid carousel references.

### Events → Memories

Do NOT cascade-delete the memory merely because the original event disappears.

---

# 54. Event Deletion Dependency Rule

When an event is cancelled/deleted, the system must clean up:

* Event content sections.
* Featured relationship.
* Carousel references.
* Event-specific media references.
* Other event-owned records.

But it must preserve:

* Audit logs.
* Historical analytics aggregates where applicable.
* Independent Event Memories.
* Operational deletion evidence.

---

# 55. Media Reference Safety

A media asset should not be deleted while still referenced by:

* Published event.
* Advertisement.
* Event Memory.
* Sponsor.
* Carousel.

Deletion should be blocked or converted into a pending cleanup operation until all references are removed.

---

# 56. Unique Constraints

Important uniqueness constraints include:

```text
admin_users.auth_user_id
organizations normalized name
organization_members (organization_id, admin_user_id)
categories.key
subcategories (category_id, key)
media_assets (bucket, object_key)
featured_events.event_id
advertisement_positions (advertisement_id, position)
event_memory_media (memory_id, media_id)
global_settings.key
resource_versions.resource
```

---

# 57. Indexing Strategy

Indexes must support real application queries.

Required/expected indexes include:

### Events

```text
events(status)
events(start_at)
events(end_at)
events(category_id)
events(subcategory_id)
events(organization_id)
events(pricing_type)
events(registration_mode)
```

Composite indexes should be added for frequent combinations such as:

```text
(status, start_at)
(status, end_at)
(category_id, status, start_at)
(subcategory_id, status, start_at)
```

Exact indexes should be validated with query plans before excessive indexing.

---

# 58. Search Indexes

Event name should have:

* Case-normalized search support.
* Trigram index if required.

Do not create several redundant text-search indexes without query-plan evidence.

---

# 59. Outbox Indexes

Important indexes:

```text
outbox_events(status, available_at)
outbox_events(aggregate_type, aggregate_id)
outbox_events(created_at)
```

Workers must be able to efficiently claim pending events.

---

# 60. Audit Indexes

Useful indexes:

```text
audit_logs(actor_admin_id, created_at)
audit_logs(target_type, target_id, created_at)
audit_logs(action, created_at)
audit_logs(created_at)
```

---

# 61. Access Request Indexes

Required:

```text
organizer_access_requests(admin_user_id)
organizer_access_requests(status, created_at)
```

And a partial unique index for one active pending request per admin.

---

# 62. Organizer Ownership Indexes

Required:

```text
organization_members(admin_user_id, is_active)
organization_members(organization_id, is_active)
events(organization_id, status)
```

These support authorization and event-management queries.

---

# 63. Event Retention Index

Event retention jobs need efficient access to completed events.

Use an index supporting:

```text
status = COMPLETED
AND end_at < retention_threshold
```

A partial index should be considered.

---

# 64. Check Constraints

Database-level checks should include:

```text
end_at > start_at
event_interval > 0
file_size_bytes >= 0
width > 0 when present
height > 0 when present
sort_order >= 0
attempt_count >= 0
```

Additional constraints should be added where the invariant is stable and deterministic.

---

# 65. Enum Strategy

Enums are appropriate for stable finite states such as:

```text
event_status
registration_mode
event_pricing_type
access_request_status
advertisement_status
media_status
content_status
outbox_status
job_status
archive_status
backup_status
```

Avoid PostgreSQL enums for values that administrators may need to modify frequently.

---

# 66. JSONB Usage

JSONB is allowed where data is genuinely flexible.

Appropriate examples:

* Structured event content.
* Audit metadata.
* Outbox payload.
* Global setting values.
* Job metadata.

Do not use JSONB as a replacement for normal relational columns when the data:

* Requires joins.
* Requires foreign keys.
* Is frequently filtered.
* Has strict integrity requirements.

---

# 67. No Generic Entity Table

Do not create a giant generic table such as:

```text
entities
```

with:

```text
entity_type
entity_id
payload
```

for normal business data.

Strong relational models are preferred.

---

# 68. No Generic Key-Value Database

Apart from intentionally limited `global_settings`, do not build the application around arbitrary key-value storage.

Core business data must remain relational.

---

# 69. Data Ownership

The database ownership model is:

```text
Organization
   ↓
Events
   ↓
Event content/media relationships
```

Super Admin operates across the entire platform.

---

# 70. Public vs Private Data

Public:

* Published event information.
* Published event media.
* Public advertisements.
* Published memories.
* Public taxonomy.
* Public sponsor information.

Private:

* Admin identities.
* Access requests.
* Organization memberships.
* Audit logs.
* Outbox.
* Job metadata.
* Backup metadata.
* Internal media metadata where appropriate.
* Operational configuration.

RLS must enforce this separation.

---

# 71. Database Security Principle

No table is considered secure merely because the frontend does not display it.

Security must be enforced in PostgreSQL.

The final policy definitions belong in:

`SECURITY_ARCHITECTURE.md`

---

# 72. Migration Strategy

Every schema change must create a new Supabase migration.

Example:

```text
supabase/migrations/
├── 20260815000000_initial_schema.sql
├── 20260816000000_add_event_indexes.sql
└── ...
```

Do not edit an already-applied production migration.

---

# 73. Migration Testing

Before a migration is accepted:

1. Start local Supabase.
2. Reset database.
3. Apply all migrations.
4. Load safe seed data.
5. Run schema tests.
6. Run RLS tests.
7. Run application tests.
8. Verify indexes and constraints.

---

# 74. Schema Change Rule

Changing a table because a frontend component needs one field is not sufficient justification.

Before schema modification, determine:

* Product requirement.
* Data ownership.
* Query pattern.
* Security impact.
* Retention impact.
* Migration impact.
* Cache impact.
* Analytics impact.

---

# 75. Database Loophole Review — Pass 1

The initial schema review identified the following issues.

## Loophole A — Event approval tables

Previous architecture could accidentally reintroduce pending events.

**Fix:** No approval-specific event tables or statuses.

---

## Loophole B — Student accounts

A profile table could accidentally be introduced.

**Fix:** No student identity tables.

---

## Loophole C — Ticketing remnants

Legacy ticket architecture could leak back into schema.

**Fix:** Explicitly prohibited ticket/booking/payment tables.

---

## Loophole D — Category mismatch

An event could reference a category and an unrelated subcategory.

**Fix:** Composite relational integrity.

---

## Loophole E — Deleted event destroys audit

A cascade could delete historical audit records.

**Fix:** Audit records are independent.

---

## Loophole F — Deleted event destroys memories

Event deletion could cascade into historical memories.

**Fix:** Memory references are nullable and independent.

---

## Loophole G — R2 orphan accumulation

Media could remain in R2 forever.

**Fix:** Media lifecycle + cleanup state + orphan cleanup.

---

## Loophole H — Multiple pending access requests

An organizer could spam access requests.

**Fix:** Partial unique index for one active pending request.

---

# 76. Database Loophole Review — Pass 2

A second review was performed after the first fixes.

## Loophole I — Super Admin uniqueness

A normal unique role column would not prevent multiple Super Admins.

**Fix:** Enforce a single active Super Admin at database level.

---

## Loophole J — Event ownership spoofing

Client could submit a different organization ID.

**Fix:** Backend/RLS derives ownership from authenticated organization membership.

---

## Loophole K — Invalid external registration state

`EXTERNAL` could have no URL.

**Fix:** Database check constraint + server validation.

---

## Loophole L — NONE could contain misleading URL

An event could accidentally have an external URL while registration mode is NONE.

**Fix:** Explicit mutual-exclusion constraint.

---

## Loophole M — Invalid registration dates

Closing date could precede opening date.

**Fix:** Database constraint.

---

## Loophole N — Archived event deleted before archive verification

**Fix:** Archive status and verification must precede operational deletion.

---

## Loophole O — Cache version not updated

Data changes could leave client synchronization stale.

**Fix:** Resource version changes are part of the same transaction as relevant data changes.

---

## Loophole P — Outbox duplicate processing

Worker retry could duplicate side effects.

**Fix:** Unique outbox IDs and idempotent handlers.

---

## Loophole Q — Media deleted while still referenced

**Fix:** Reference checks + pending deletion state.

---

## Loophole R — Taxonomy key deletion

Deleting a category could break historical events.

**Fix:** Stable keys and inactive state instead of destructive deletion.

---

## Loophole S — Raw analytics table explosion

Storing every student view in PostgreSQL could create unnecessary database load.

**Fix:** PostHog handles raw analytics; PostgreSQL stores only useful aggregates.

---

## Loophole T — Over-indexing

Adding indexes for every possible filter could slow writes and increase storage.

**Fix:** Indexes must correspond to real query patterns and be verified with query plans.

---

## Loophole U — JSONB replacing relational integrity

Putting entire events inside JSONB would destroy foreign-key and indexing benefits.

**Fix:** Core business data remains relational; JSONB is restricted to genuinely flexible structures.

---

# 77. Final Table Inventory

The approved schema consists of these principal tables:

```text
ADMINISTRATION
├── admin_users
├── platform_admin_roles
├── organizations
├── organization_members
└── organizer_access_requests

EVENTS
├── events
├── event_content_sections
├── categories
└── subcategories

MEDIA
└── media_assets

CONTENT
├── advertisements
├── advertisement_positions
├── advertisement_feed_config
├── advertisement_metrics_daily
├── featured_events
├── carousel_items
├── event_memories
├── event_memory_media
└── sponsors

CONFIGURATION
└── global_settings

SYNCHRONIZATION
└── resource_versions

OPERATIONS
├── audit_logs
├── outbox_events
├── background_jobs
├── archive_records
└── backup_records
```

---

# 78. Tables Explicitly Not Included

The following must not be added unless the product architecture is deliberately changed:

```text
students
student_profiles
tickets
bookings
reservations
payments
payment_attempts
refunds
ticket_inventory
ticket_verification
qr_tokens
seats
seat_inventory
event_approvals
event_drafts
```

---

# 79. Final Data Flow

A normal event publication transaction conceptually looks like:

```text
Organizer
   ↓
Authenticate with Email OTP
   ↓
Authorization
   ↓
Validate event
   ↓
Insert events row
   ↓
Insert content sections
   ↓
Create audit record
   ↓
Increment resource version
   ↓
Create outbox events
   ↓
COMMIT
   ↓
Background processing
   ├── Cache invalidation
   ├── Cache warming
   └── Analytics/secondary effects
```

External services are never called inside the core database transaction unless specifically designed to be transaction-safe.

---

# 80. Final Event Deletion Flow

```text
Authorized cancellation
        ↓
Validate permission
        ↓
Create audit record
        ↓
Identify dependent media
        ↓
Create cleanup/outbox work
        ↓
Delete event + event-owned records
        ↓
Increment relevant resource versions
        ↓
COMMIT
        ↓
Invalidate caches
        ↓
Delete R2 objects asynchronously
```

The audit record remains.

---

# 81. Final Schema Definition

PostgreSQL is the only operational source of truth.

The schema intentionally remains relatively small because LPU Events is a discovery platform rather than a ticketing/transaction platform.

The central model is:

```text
                    ┌─────────────────┐
                    │  organizations  │
                    └────────┬────────┘
                             │
                             ▼
                       ┌──────────┐
                       │  events  │
                       └────┬─────┘
                            │
          ┌─────────────────┼──────────────────┐
          ▼                 ▼                  ▼
     categories       content sections      media
          │
          ▼
    subcategories

Super Admin
     │
     ├── advertisements
     ├── featured_events
     ├── carousel_items
     ├── event_memories
     ├── sponsors
     └── global_settings

All important mutations
     │
     ├── audit_logs
     ├── resource_versions
     └── outbox_events
```

This schema is the baseline from which the actual Supabase SQL migrations must be generated.

No production migration should introduce a table or relationship that contradicts this document without first updating and approving this document.
