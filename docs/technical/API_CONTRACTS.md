# LPU Events — API Contracts

**File:** `docs/technical/API_CONTRACTS.md`  
**Status:** DRAFT — Awaiting Review  
**Version:** 1.1  
**Date:** 14 August 2026

---

# 1. Purpose

This document defines the API contracts between the **Student Website (public/anonymous)**, the **Admin Website (protected)**, and the **Supabase Backend** (composed of PostgREST REST endpoints, PostgreSQL Functions/RPCs, and Storage/Edge Functions).

These contracts align with the principles locked in:
- `SYSTEM_ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`

All client operations must implement the formats, query structures, and response schemas defined here.

---

# 2. Communication Paradigms

Client communication with Supabase uses two primary pathways:

1. **Direct PostgREST Queries**: For declarative reads and filters (Student and Admin). Row-Level Security (RLS) is evaluated on the database to filter out inactive/private entries automatically.
2. **PostgreSQL RPCs (Remote Procedure Calls)**: For complex transactional mutations (event publishing, editing, cancellation, access request approvals) to ensure database-level atomicity, audit trails, and version increments occur in a single database transaction.

### Request Headers
Protected administrative requests must supply:
* `Authorization: Bearer <Supabase_JWT>`
* `apikey: <Supabase_Anon_Key>`

Public reads use only the client `apikey`.

---

# 3. Authentication & Session Initiation

## 3.1 Request OTP

Sends a one-time verification passcode to an LPU email address. Only administrative users/organizers require login.

* **Protocol**: Supabase Auth REST API
* **Endpoint**: `POST /auth/v1/otp`
* **Request Payload**:
```json
{
  "email": "organizer.name@lpu.co.in",
  "options": {
    "shouldCreateUser": true
  }
}
```
* **Success Response (`200 OK`)**:
```json
{
  "message": "OTP sent successfully"
}
```

## 3.2 Verify OTP (Exchange for Session JWT)

Exchanges the email passcode for an access session containing the user's JWT.

* **Protocol**: Supabase Auth REST API
* **Endpoint**: `POST /auth/v1/verify?type=magiclink` (or `type=signup`/`type=email`)
* **Request Payload**:
```json
{
  "email": "organizer.name@lpu.co.in",
  "token": "123456"
}
```
* **Success Response (`200 OK`)**:
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "f83b12...",
  "user": {
    "id": "d3b07384-d113-49cd-a5d6-89d0b8f4eeae",
    "email": "organizer.name@lpu.co.in",
    "created_at": "2026-08-14T01:00:00Z"
  }
}
```

---

# 4. Student Website API Contracts (Public & Read-Only)

All requests in this section are public, read-only, and execute anonymously. Row Level Security ensures only `status = 'PUBLISHED'` events and active items are visible.

### Caching Requirements (Free-Tier Constraint)

All public Student Website API responses **must** include appropriate caching headers.

These headers enable Cloudflare edge caching, which is essential for staying within Supabase's 10 GB/month egress limit.

**Required response headers for all public endpoints:**

```text
Cache-Control: public, max-age=300, stale-while-revalidate=180
```

The specific `max-age` and `stale-while-revalidate` values vary by endpoint:

| Endpoint Category | max-age | stale-while-revalidate |
|---|---|---|
| Categories / Subcategories | 3600 (1 hr) | 1800 (30 min) |
| Event Listings / Feed | 300 (5 min) | 180 (3 min) |
| Event Detail | 600 (10 min) | 300 (5 min) |
| Search Results | 120 (2 min) | 60 (1 min) |
| Homepage Sections | 600 (10 min) | 300 (5 min) |
| Advertisements | 600 (10 min) | 300 (5 min) |
| Sponsors | 3600 (1 hr) | 1800 (30 min) |

**ETag support:**

Public API responses should include an `ETag` header derived from the relevant `resource_version`.

Clients may send `If-None-Match` with a cached ETag to receive `304 Not Modified` when data hasn't changed.

```text
Response:  ETag: "events-v1422"
Request:   If-None-Match: "events-v1422"
Response:  304 Not Modified (no body, minimal egress)
```

Refer to `FREE_TIER_CAPACITY.md` Section 6.2 for the complete TTL table and `CACHING_ARCHITECTURE.md` Section 124 for SWR details.

## 4.1 Fetch Categories & Subcategories

* **Protocol**: PostGREST REST API
* **Endpoint**: `GET /rest/v1/categories?is_active=eq.true&select=id,key,name,sort_order,subcategories(id,key,name,sort_order)&order=sort_order.asc,subcategories(sort_order.asc)`
* **Response Format (`200 OK`)**:
```json
[
  {
    "id": "e4587c12-32a8-4c12-8812-7bb3cd6d34bf",
    "key": "tech",
    "name": "Technology",
    "sort_order": 1,
    "subcategories": [
      {
        "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "key": "coding",
        "name": "Coding Contests",
        "sort_order": 1
      },
      {
        "id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
        "key": "webdev",
        "name": "Web Development",
        "sort_order": 2
      }
    ]
  }
]
```

## 4.2 Fetch Event Feed (Discover Hub)

Provides paginated upcoming events. Supports category/subcategory filtering.

* **Protocol**: PostGREST REST API
* **Endpoint**: `GET /rest/v1/events`
* **Query Parameters**:
  - `status`: `eq.PUBLISHED`
  - `start_at`: `gte.now()` (or standard timestamptz string)
  - `category_id`: Optional `eq.uuid`
  - `subcategory_id`: Optional `eq.uuid`
  - `pricing_type`: Optional `eq.FREE` or `eq.PAID`
  - `limit`: `integer` (e.g. `20`)
  - `offset`: `integer` (e.g. `0`)
  - `select`: `id,name,description,start_at,end_at,venue_name,registration_mode,pricing_type,banner_media_id,organizations(name)`
  - `order`: `start_at.asc`
* **Example Full Request URL**: `/rest/v1/events?status=eq.PUBLISHED&start_at=gte.2026-08-14T00%3A00%3A00Z&limit=10&select=id,name,start_at,end_at,venue_name,pricing_type,organizations(name)`
* **Response Format (`200 OK`)**:
```json
[
  {
    "id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
    "name": "DevHack 2026",
    "start_at": "2026-10-15T09:00:00+05:30",
    "end_at": "2026-10-17T18:00:00+05:30",
    "venue_name": "Block 33, Audi-3",
    "pricing_type": "FREE",
    "organizations": {
      "name": "Developer Club LPU"
    }
  }
]
```

## 4.3 Search Events

Implements case-insensitive keyword search on the event title using a dedicated database function (to support prefix-first ranking and trigram contains search as defined in Loophole T).

* **Protocol**: Supabase RPC
* **Endpoint**: `POST /rest/v1/rpc/search_events`
* **Payload**:
```json
{
  "query_text": "dev",
  "limit_count": 20,
  "offset_count": 0
}
```
* **Response Format (`200 OK`)**:
```json
[
  {
    "id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
    "name": "DevHack 2026",
    "start_at": "2026-10-15T09:00:00+05:30",
    "end_at": "2026-10-17T18:00:00+05:30",
    "venue_name": "Block 33, Audi-3",
    "pricing_type": "FREE",
    "rank": 1
  }
]
```

## 4.4 Fetch Event Details (with Content Sections)

* **Protocol**: PostgREST REST API
* **Endpoint**: `GET /rest/v1/events?id=eq.f81d4fae-7dec-11d0-a765-00a0c91e6bf6&select=*,organizations(*),event_content_sections(*)`
* **Response Format (`200 OK`)**:
```json
[
  {
    "id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
    "organization_id": "8c48a732-b8a9-46cd-9e32-0b81ea199201",
    "name": "DevHack 2026",
    "description": "Annual flagship hackathon of LPU.",
    "category_id": "e4587c12-32a8-4c12-8812-7bb3cd6d34bf",
    "subcategory_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "banner_media_id": "50e41712-4632-4412-bc12-bc783cd78bf3",
    "start_at": "2026-10-15T09:00:00+05:30",
    "end_at": "2026-10-17T18:00:00+05:30",
    "venue_name": "Block 33, Audi-3",
    "registration_mode": "EXTERNAL",
    "external_registration_url": "https://hack2026.lpu.in",
    "registration_opens_at": "2026-09-01T00:00:00+05:30",
    "registration_closes_at": "2026-10-10T23:59:59+05:30",
    "pricing_type": "PAID",
    "registration_format": "TEAM",
    "capacity_limit": 50,
    "capacity_counts_by": "TEAMS",
    "team_pricing_mode": "FIXED_TEAM_PRICE",
    "price_amount": 500.00,
    "status": "PUBLISHED",
    "view_count": 1420,
    "organizations": {
      "id": "8c48a732-b8a9-46cd-9e32-0b81ea199201",
      "name": "Developer Club LPU",
      "is_active": true
    },
    "event_content_sections": [
      {
        "id": "78a2e12a-3b56-4c7b-91b4-2b7e9b04f32c",
        "section_type": "rules",
        "title": "Hackathon Rules",
        "content": {
          "rules_list": [
            "Teams must consist of 2-4 students.",
            "All code must be written during the event."
          ]
        },
        "sort_order": 1
      }
    ]
  }
]
```

## 4.5 Fetch Homepage Content (Carousel, Featured, Ads, Sponsors)

These are fetched via standard SELECT queries optimized with correct order fields.

### Carousel Items
`GET /rest/v1/carousel_items?is_active=eq.true&select=*,media_assets(*)&order=sort_order.asc`

### Featured Events
`GET /rest/v1/featured_events?select=event_id,sort_order,events(*,organizations(*))&order=sort_order.asc`

### Advertisements
`GET /rest/v1/advertisements?status=eq.active&select=*,advertisement_positions(*)&order=created_at.desc`
*(Client filters out items where local timestamp is not between `start_at` and `end_at`).*

### Event Memories
`GET /rest/v1/event_memories?status=eq.PUBLISHED&select=*,event_memory_media(sort_order,media_assets(*))&order=created_at.desc`

### Sponsors
`GET /rest/v1/sponsors?status=eq.PUBLISHED&select=*&order=sort_order.asc`

---

# 5. Administrative Website API Contracts (Protected)

Requires valid organizer/admin Supabase authentication.

## 5.1 Organizer Access Requests

### 5.1.1 Submit Access Request
Creates a new administrative access request. Checked by partial unique index (only one `PENDING` request allowed per user).
* **Protocol**: PostgREST REST API
* **Endpoint**: `POST /rest/v1/organizer_access_requests`
* **Request Payload**:
```json
{
  "organization_name": "Robotics Society LPU",
  "remarks": "Requesting access for event coordination."
}
```
* **Response Format (`201 Created`)**

### 5.1.2 Get Access Request Status
Allows the authenticated user to verify their approval status.
* **Protocol**: PostgREST REST API
* **Endpoint**: `GET /rest/v1/organizer_access_requests?select=id,organization_name,remarks,status,review_reason`
* **Response Format (`200 OK`)**:
```json
[
  {
    "id": "bc731ea2-45bc-4bb8-89c0-ff43b23c91ea",
    "organization_name": "Robotics Society LPU",
    "remarks": "Requesting access for event coordination.",
    "status": "PENDING",
    "review_reason": null
  }
]
```

## 5.2 Super Admin: Access Request Review

Transactionally reviews the request. If approved, creates the organization, creates the admin member record with role `ORGANIZER`, logs audit record, and updates request status.

* **Protocol**: Supabase RPC
* **Endpoint**: `POST /rest/v1/rpc/review_access_request`
* **Request Payload**:
```json
{
  "request_id": "bc731ea2-45bc-4bb8-89c0-ff43b23c91ea",
  "action_status": "APPROVED", // or REJECTED
  "reason": "Official society recognized by DSA."
}
```
* **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "message": "Access request approved, organization and membership created."
}
```

## 5.3 Event Lifecycle RPCs

To enforce strict relational integrity, outbox transactional generation, and version tracking, events cannot be modified via simple REST inserts. They must go through locked RPC commands.

### 5.3.1 Publish Event RPC

Publishes a new event. Validates that the organizer belongs to the organization, checks subcategory matches category, verifies external registration URL structure, creates the event + content sections, increments `resource_versions` for `events`, writes to `outbox_events` and creates an `audit_logs` entry in one transactional block.

* **Protocol**: Supabase RPC
* **Endpoint**: `POST /rest/v1/rpc/publish_event`
* **Request Payload**:
```json
{
  "event_payload": {
    "organization_id": "8c48a732-b8a9-46cd-9e32-0b81ea199201",
    "name": "RoboWars 2026",
    "description": "Clash of metals in the arena.",
    "category_id": "e4587c12-32a8-4c12-8812-7bb3cd6d34bf",
    "subcategory_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "banner_media_id": "50e41712-4632-4412-bc12-bc783cd78bf3",
    "start_at": "2026-11-20T10:00:00+05:30",
    "end_at": "2026-11-22T17:00:00+05:30",
    "venue_name": "Unipolis, LPU",
    "registration_mode": "EXTERNAL",
    "external_registration_url": "https://robowars.lpu.in",
    "registration_opens_at": "2026-09-01T10:00:00+05:30",
    "registration_closes_at": "2026-11-15T23:59:59+05:30",
    "pricing_type": "PAID",
    "registration_format": "TEAM",
    "capacity_limit": 64,
    "capacity_counts_by": "TEAMS",
    "team_pricing_mode": "FIXED_TEAM_PRICE",
    "price_amount": 1000.00
  },
  "content_sections": [
    {
      "section_type": "timeline",
      "title": "Event Timeline",
      "content": {
        "schedule": [
          { "time": "Day 1 - 10:00 AM", "details": "Round 1 Matches" }
        ]
      },
      "sort_order": 0
    }
  ]
}
```
* **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "event_id": "5c6d7e8f-9a0b-1c2d-3e4f-5a6b7c8d9e0f"
}
```

### 5.3.2 Edit Event RPC

Modifies an existing event. Replaces content sections, verifies permissions, writes audit records, and increments resource versions.

* **Protocol**: Supabase RPC
* **Endpoint**: `POST /rest/v1/rpc/edit_event`
* **Request Payload**:
```json
{
  "event_id": "5c6d7e8f-9a0b-1c2d-3e4f-5a6b7c8d9e0f",
  "event_payload": {
    "name": "RoboWars 2026 - Extended Arena",
    "description": "Arena size increased. Clash of metal!",
    "category_id": "e4587c12-32a8-4c12-8812-7bb3cd6d34bf",
    "subcategory_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "banner_media_id": "50e41712-4632-4412-bc12-bc783cd78bf3",
    "start_at": "2026-11-20T10:00:00+05:30",
    "end_at": "2026-11-22T17:00:00+05:30",
    "venue_name": "Unipolis Main Arena, LPU",
    "registration_mode": "EXTERNAL",
    "external_registration_url": "https://robowars.lpu.in",
    "registration_opens_at": "2026-09-01T10:00:00+05:30",
    "registration_closes_at": "2026-11-15T23:59:59+05:30",
    "pricing_type": "PAID",
    "registration_format": "TEAM",
    "capacity_limit": 64,
    "capacity_counts_by": "TEAMS",
    "team_pricing_mode": "FIXED_TEAM_PRICE",
    "price_amount": 1000.00
  },
  "content_sections": [
    {
      "section_type": "timeline",
      "title": "Updated Event Timeline",
      "content": {
        "schedule": [
          { "time": "Day 1 - 09:30 AM", "details": "Registrations and briefing" },
          { "time": "Day 1 - 10:30 AM", "details": "Round 1 Arena Matches" }
        ]
      },
      "sort_order": 0
    }
  ]
}
```
* **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "event_id": "5c6d7e8f-9a0b-1c2d-3e4f-5a6b7c8d9e0f"
}
```

### 5.3.3 Cancel Event RPC (Hard Deletion with Auditing)

Cancels the event. Enforces authorization checks, marks event media for cleanup verification, transactionally writes cancellation audit records, inserts outbox cache-invalidation messages, deletes the event and its associated sections, and increments resource versions.

* **Protocol**: Supabase RPC
* **Endpoint**: `POST /rest/v1/rpc/cancel_event`
* **Request Payload**:
```json
{
  "event_id": "5c6d7e8f-9a0b-1c2d-3e4f-5a6b7c8d9e0f",
  "reason": "Administrative instructions from division head."
}
```
* **Success Response (`200 OK`)**:
```json
{
  "status": "success",
  "message": "Event deleted and cancellation audit finalized."
}
```

---

# 6. Media Asset Management

Since files are uploaded to Cloudflare R2, the Supabase backend generates secure upload parameters. The client uploads the asset directly, then notifies the backend.

## 6.1 Generate Upload Credentials
* **Protocol**: Supabase RPC (or Supabase Edge Function API)
* **Endpoint**: `POST /rest/v1/rpc/request_media_upload`
* **Request Payload**:
```json
{
  "media_type": "EVENT_BANNER",
  "mime_type": "image/webp",
  "file_size_bytes": 1048576,
  "width": 1200,
  "height": 630
}
```
* **Response Format (`200 OK`)**:
Creates a database entry in `media_assets` with status `UPLOADING` and returns Cloudflare R2 upload parameters.
```json
{
  "media_id": "d0e12d4a-937b-402a-9e12-ff5b91a27e31",
  "upload_url": "https://media.lpu-events.in/upload/banners/d0e12d4a.webp?Signature=...",
  "method": "PUT",
  "headers": {
    "Content-Type": "image/webp"
  }
}
```

## 6.2 Confirm Successful Upload
After performing a `PUT` request with the image binary to the `upload_url`, the client must request validation.
* **Protocol**: Supabase RPC
* **Endpoint**: `POST /rest/v1/rpc/confirm_media_upload`
* **Request Payload**:
```json
{
  "media_id": "d0e12d4a-937b-402a-9e12-ff5b91a27e31"
}
```
* **Response Format (`200 OK`)**:
Backend verifies the asset checksum/existence on Cloudflare R2, marks status to `READY`, and updates verification times.
```json
{
  "status": "success",
  "media_id": "d0e12d4a-937b-402a-9e12-ff5b91a27e31",
  "media_status": "READY"
}
```

---

# 7. Synchronization & Caching Strategy (Revised for Free Tier)

### Client-Side Polling: Disabled

The Student Website does **not** poll the `resource_versions` table.

Client-side polling was removed from the architecture because:

* 10,000 browsers polling every 30 seconds = ~28.8M requests/day.
* This would exhaust Supabase egress and Workers quotas.
* Cloudflare edge caching makes polling unnecessary.

Refer to `FREE_TIER_CAPACITY.md` Section 6.3 and `CACHING_ARCHITECTURE.md` Section 32.

### Server-Driven Cache Invalidation

Data freshness is managed through server-side cache invalidation:

```text
Admin mutation
    ↓
Database transaction:
  - Data change
  - resource_versions increment
  - outbox_events entry
    ↓
Outbox processor fires
    ↓
Cloudflare cache purge (by URL) for affected endpoints
    ↓
Next student request triggers cache miss
    ↓
Fresh data fetched from Supabase origin
    ↓
Cached at Cloudflare edge
```

### Resource Versions API (Server/Admin Use Only)

The `resource_versions` endpoint remains available but is used only by:

* The outbox processor (to determine which caches to purge).
* The Admin Website (for dashboard staleness indicators).

* **Endpoint**: `GET /rest/v1/resource_versions`
* **Response Format (`200 OK`)**:
```json
[
  { "resource": "events", "version": 1422, "updated_at": "2026-08-14T01:05:00Z" },
  { "resource": "categories", "version": 12, "updated_at": "2026-08-10T14:30:00Z" },
  { "resource": "ads", "version": 89, "updated_at": "2026-08-14T00:50:00Z" }
]
```

> **This endpoint is NOT called by the Student Website in production.**

---

# 8. Error Specifications & Invariant Failures

The Supabase API uses standard HTTP response codes combined with precise error payload keys to indicate business rules violations.

## 8.1 Validation Failures (`400 Bad Request`)

### Category-Subcategory Mismatch
Thrown if `subcategory_id` does not belong to the selected `category_id`.
```json
{
  "code": "TAXONOMY_MISMATCH",
  "message": "The selected subcategory does not belong to the parent category.",
  "details": {
    "category_id": "e4587c12-32a8-4c12-8812-7bb3cd6d34bf",
    "subcategory_id": "f88b812a-3c56-4c7b-91b4-2b7e9b04f32c"
  }
}
```

### Invalid Date Boundaries
Thrown if `end_at` is preceding `start_at`, or registration bounds overlap incorrectly.
```json
{
  "code": "INVALID_TEMPORAL_BOUNDS",
  "message": "Event end time must occur after the start time.",
  "details": {
    "start_at": "2026-11-20T10:00:00+05:30",
    "end_at": "2026-11-19T10:00:00+05:30"
  }
}
```

### Invalid Registration Mode State
Thrown if registration mode is `EXTERNAL` but no URL is provided, or `NONE` and a URL is provided.
```json
{
  "code": "REGISTRATION_MODE_INVARIANT_VIOLATION",
  "message": "Registration URL must be provided if and only if mode is set to EXTERNAL."
}
```

## 8.2 Authorization Failures (`403 Forbidden`)

### Organization Access Spoofing
Thrown if the organizer tries to publish an event under an organization they are not an active member of.
```json
{
  "code": "INSUFFICIENT_ORGANIZATION_PERMISSIONS",
  "message": "You do not have active administrative permissions for this organization.",
  "details": {
    "organization_id": "8c48a732-b8a9-46cd-9e32-0b81ea199201"
  }
}
```

### Single Super Admin Invariant
Thrown if attempting to insert an active role when one already exists.
```json
{
  "code": "SINGLE_SUPER_ADMIN_INVARIANT_VIOLATION",
  "message": "There can only be exactly one active Super Admin on the platform."
}
```

## 8.3 Rate Limiting or Lockouts (`429 Too Many Requests`)
Returned if OTP spammed or access request submitted multiple times.
```json
{
  "code": "CONCURRENT_PENDING_REQUESTS",
  "message": "You already have one active pending access request. Please wait for review."
}
```
