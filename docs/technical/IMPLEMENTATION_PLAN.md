# LPU Events — Implementation Plan

**File:** `docs/technical/IMPLEMENTATION_PLAN.md`  
**Status:** LOCKED — Development Execution Plan  
**Version:** 1.0  
**Date:** 14 August 2026

---

# 1. Purpose

This document converts the approved LPU Events architecture and product specifications into an ordered implementation sequence.

The purpose is to prevent:

- Random feature development.
- Framework switching.
- Premature UI implementation.
- Database/API inconsistencies.
- Security regressions.
- Free-tier cost problems.
- Duplicate business logic.
- AI-generated architecture changes during implementation.

Implementation must follow the phases in this document unless a deliberate architecture change is approved.

---

# 2. Source-of-Truth Documents

Before implementing any feature, developers/AI agents must consult:

```text
docs/technical/

TECH_STACK.md
SYSTEM_ARCHITECTURE.md
DATABASE_SCHEMA.md
API_CONTRACTS.md
SECURITY_ARCHITECTURE.md
CACHING_ARCHITECTURE.md
STUDENT_UI_SPEC.md
ADMIN_UI_SPEC.md
FREE_TIER_CAPACITY.md
IMPLEMENTATION_PLAN.md
```

If an implementation conflicts with these documents, stop and resolve the conflict before coding.

Do not silently reinterpret the architecture.

---

# 3. Technology Lock

The technology stack is already defined in:

```text
TECH_STACK.md
```

Do not replace:

* React.
* TypeScript.
* Vite.
* Supabase.
* PostgreSQL.
* Cloudflare Pages.
* Cloudflare R2.

with alternative technologies without an explicit architecture decision.

---

# 4. Deployment Model

The two websites remain independently deployable:

```text
apps/
├── student-web/
└── admin-web/
```

They may live in one monorepo but must remain separate applications.

Production deployment:

```text
Student Website
    ↓
Cloudflare Pages

Admin Website
    ↓
Cloudflare Pages
```

They must have independent build/deployment configurations.

---

# 5. Backend Architecture

Business logic runs through the approved Supabase backend architecture.

Conceptually:

```text
Browser
  ↓
Supabase API / Edge Functions
  ↓
Authorization
  ↓
PostgreSQL
```

Privileged service credentials remain server-side.

---

# 6. Development Strategy

Implementation follows:

```text
Foundation
   ↓
Database
   ↓
Security primitives
   ↓
Backend/API
   ↓
Authentication
   ↓
Admin core
   ↓
Public content
   ↓
Student website
   ↓
Caching
   ↓
Observability
   ↓
Testing
   ↓
Deployment
   ↓
Final audit
```

Do not build all frontend screens first and connect the backend later.

---

# 7. Phase 0 — Repository Verification

## Goal

Confirm the existing development foundation before adding product code.

Verify:

```text
apps/student-web
apps/admin-web
packages/shared
supabase/
scripts/
```

Verify:

* Node/npm.
* Docker Desktop.
* Supabase CLI.
* Git.
* TypeScript.
* ESLint.
* Vite.
* Local Supabase.

Commands:

```bash
npm install
npm run typecheck
npm run lint
npm run build:student
npm run build:admin
```

Also verify:

```bash
docker ps
npx supabase start
npx supabase status
```

## Completion criteria

* Both applications start.
* Both applications build.
* Local Supabase starts.
* Git repository works.
* No secrets are tracked.

---

# 8. Phase 1 — Remove Temporary Foundation Artifacts

The repository currently contains the cleaned database foundation.

Verify:

```text
supabase/migrations/
supabase/seed.sql
```

must contain no temporary test schema.

Development seed data should be added only when the real schema requires it.

---

# 9. Phase 2 — Database Implementation

## Goal

Implement the canonical PostgreSQL schema.

Source:

```text
DATABASE_SCHEMA.md
```

Create version-controlled migrations.

Do not manually create production tables through Supabase Studio.

All schema changes must become migration files.

---

# 10. Database Implementation Order

Implement in dependency order.

Recommended:

```text
1. Extensions / database primitives
2. Administrative identities
3. Organizations
4. Organization memberships
5. Access requests
6. Taxonomy
7. Events
8. Event lifecycle data
9. Event media
10. Advertisements
11. Carousel
12. Sponsors
13. Event Memories
14. Resource versions
15. Audit logs
16. Outbox
17. Background job infrastructure
18. Remaining supporting tables
```

The exact table order must follow foreign-key dependencies defined in `DATABASE_SCHEMA.md`.

---

# 11. Database Invariants

Implement database-level protection for critical invariants.

Examples:

* Foreign keys.
* NOT NULL constraints.
* CHECK constraints.
* Unique constraints.
* Partial unique indexes where required.
* Valid lifecycle states.
* Valid pricing modes.
* Valid registration modes.
* Valid category/subcategory relationships.
* Organization ownership.
* Resource version consistency.

Do not rely exclusively on TypeScript validation.

---

# 12. Row Level Security

Enable RLS on all tables requiring protection.

RLS must be implemented as part of the database phase rather than postponed until the end.

Test:

```text
Anonymous
Organizer
Super Admin
```

against protected resources.

---

# 13. Database Migration Testing

For every migration:

```text
Create migration
    ↓
supabase db reset
    ↓
Apply all migrations
    ↓
Run database tests
    ↓
Verify constraints/RLS
```

A migration is not complete merely because it executes without SQL errors.

---

# 14. Phase 3 — Database Test Suite

Create database tests for:

* Constraints.
* RLS.
* Ownership.
* Role access.
* Lifecycle transitions.
* Category relationships.
* Event invariants.
* Advertisement validity.
* Resource versions.
* Audit records.
* Outbox creation.

Test both:

```text
Valid operation
Invalid operation
```

---

# 15. Phase 4 — Authentication Foundation

Implement passwordless authentication.

Authentication method:

```text
Email
  ↓
OTP
  ↓
Verification
  ↓
Session
```

No password system.

No Google Sign-In.

---

# 16. OTP Requirements

Implement:

* Secure OTP generation.
* Hash-only storage.
* Expiration.
* Single-use behavior.
* Verification attempt limits.
* OTP request rate limits.
* Resend cooldown.
* Safe error responses.
* Session creation.

Never log OTP values.

---

# 17. Authentication Security Testing

Test:

```text
Valid OTP
Invalid OTP
Expired OTP
Reused OTP
Too many OTP requests
Too many verification attempts
Logout
Expired session
Unauthorized route
```

Also verify that:

```text
No password API
No password fields
No Google OAuth
```

exist in the implementation.

---

# 18. Phase 5 — Authorization Foundation

Implement server-side authorization.

Authorization model:

```text
User
 ↓
Role
 ↓
Organization membership
 ↓
Resource ownership
 ↓
Business rules
```

Implement:

```text
SUPER_ADMIN
ORGANIZER
```

authorization.

---

# 19. Authorization Testing

Test:

### Organizer

Can:

```text
Read own organization
Read own events
Modify own authorized events
```

Cannot:

```text
Read another organization
Modify another organization's event
Approve events
Access Super Admin APIs
```

### Super Admin

Can access explicitly authorized platform operations.

---

# 20. Phase 6 — API Foundation

Implement the API contracts defined in:

```text
API_CONTRACTS.md
```

Do not create frontend-specific database queries that bypass the API architecture.

---

# 21. API Design Rules

Every protected mutation must perform:

```text
Authentication
↓
Authorization
↓
Validation
↓
Business rule validation
↓
Database transaction
```

Return consistent error structures.

Do not expose:

* Stack traces.
* SQL errors.
* Secrets.
* Internal infrastructure details.

---

# 22. Phase 7 — Transactional Outbox

Implement the Outbox Pattern before building major side effects.

Core flow:

```text
Business mutation
     ↓
Database transaction
     ├── business data
     └── outbox event
             ↓
          COMMIT
             ↓
      background processing
```

External services must not be called inside critical database transactions.

---

# 23. Outbox Consumers

Implement only the consumers actually required.

Potential consumers:

```text
Email
Cache invalidation
Analytics
Notifications
Background jobs
```

Failures must be retryable.

---

# 24. Phase 8 — Resource Versioning

Implement resource versioning for public resources where required.

Examples:

```text
events_version
categories_version
ads_version
sponsors_version
carousel_version
memories_version
```

Versions must change when the corresponding public resource changes.

---

# 25. Phase 9 — Admin Authentication UI

Implement:

```text
Login
Request OTP
Verify OTP
Resend OTP
Logout
Session expiry
```

Do not implement:

```text
Password login
Forgot password
Password reset
Google login
```

---

# 26. Phase 10 — Admin Shell

Implement the Admin Website foundation:

* Application shell.
* Sidebar.
* Header.
* Role-aware navigation.
* Route protection.
* Error boundary.
* Notification system.
* Loading states.
* Empty states.
* Responsive layout.

Do not build every feature inside the shell yet.

---

# 27. Phase 11 — Organizer Access Workflow

Implement:

```text
Access Request
    ↓
Super Admin Review
    ↓
Approve / Reject
    ↓
Organization membership
```

Test the complete workflow.

---

# 28. Phase 12 — Organization Management

Implement:

### Super Admin

* Organization list.
* Search.
* Filters.
* Detail.
* Activation/deactivation where supported.

### Organizer

* Organization information.
* Authorized editing only.

---

# 29. Phase 13 — Taxonomy

Implement:

```text
Category
Subcategory
```

Super Admin management.

Implement:

* Create.
* Edit.
* Activate/deactivate.
* Ordering where defined.
* Relationship validation.

Then connect event creation to taxonomy.

---

# 30. Phase 14 — Organizer Event Creation

Implement event creation using the canonical event schema.

Build:

```text
Event form
Validation
Media upload
Registration mode
Pricing mode
Capacity
External registration URL
```

---

# 31. Phase 15 — Event Lifecycle

Implement the backend state machine first.

Then implement the UI.

Required operations may include:

```text
Create (Direct Publish)
Edit
Cancel (Hard Delete)
Complete (Job Transition)
```

Only valid transitions may succeed.

---

# 32. Phase 16 — Retired (Event Approval)

This phase has been retired. There is no event approval queue or approval interface in the direct-publishing model. Events are validated and published directly.

---

# 33. Phase 17 — Event Editing

Implement lifecycle-aware editing.

Special requirement:

```text
Capacity Counts By
```

must become immutable after event publication.

Test this at both:

```text
UI level
Backend/database level
```

---

# 34. Phase 18 — External Registration

Implement:

```text
External Registration URL
```

storage and display.

Student-facing registration action:

```text
Student
 ↓
Register
 ↓
External URL
```

Do not build internal ticket checkout.

---

# 35. Phase 19 — Media System

Implement:

```text
Admin
 ↓
Upload authorization
 ↓
R2
 ↓
Confirmation
 ↓
Database association
```

Add:

* File-size limits.
* Type validation.
* Object-path protection.
* Ownership checks.
* Safe deletion.

---

# 36. Phase 20 — Advertisement Management

Implement Super Admin advertisement management.

Features:

* Create.
* Edit.
* Activate/deactivate.
* Scheduling.
* Positions.
* Feed insertion configuration.
* Redirect URL.
* Analytics.

Keep advertisement configuration separate from analytics.

---

# 37. Phase 21 — Carousel

Implement:

* Create.
* Edit.
* Reorder.
* Activate/deactivate.
* Remove.

Do not merge carousel with advertisements.

---

# 38. Phase 22 — Sponsors

Implement:

* Create.
* Edit.
* Activate/deactivate.
* Reorder.

Connect changes to cache invalidation.

---

# 39. Phase 23 — Event Memories

Implement:

* Create.
* Edit.
* Media upload.
* Activate/deactivate.
* Remove.

Connect public changes to cache invalidation.

---

# 40. Phase 24 — Admin Operations Console

Implement only operational functionality backed by real platform data.

Potential modules:

```text
Failed Emails
Failed Webhooks
Queue Monitoring
System Health
Audit Logs
```

Ticket/payment/refund modules are implemented only if the current platform actually owns those operations.

Do not create placeholder operational systems that imply unsupported capabilities.

---

# 41. Phase 25 — Audit Logging

Ensure important mutations produce audit records.

Test:

```text
Who
What
When
Which resource
Which action
```

Audit logging must not depend on the frontend.

---

# 42. Phase 26 — Student Website Foundation

After backend/admin foundations are stable, implement Student Website.

Student Website is:

```text
Public
Read-only
No login required for event discovery
No internal ticket booking
```

---

# 43. Phase 27 — Student Website Shell

Implement:

* LPU Events logo.
* Search.
* Notifications UI where defined.
* Dark/light mode.
* Profile area according to final public UX.
* Hero carousel.
* Advertisement bar.
* Happening Today.
* Filter bar.
* Events Hub.

---

# 44. Phase 28 — Events Hub

Initial configuration:

```text
Default events = 10
Show More = +5
```

The initial count and incremental count must be configurable by Super Admin according to the product specification.

Do not hard-code these values in multiple places.

---

# 45. Phase 29 — Public Event Pages

Implement:

```text
Banner
Event name
Date
Time
Venue
Advertisement
About the Event
More events
External registration action
```

No internal booking flow.

---

# 46. Phase 30 — Public Search and Filtering

Implement:

* Event search.
* Category.
* Subcategory.
* Date-related filters.
* Other approved filters.

Search must remain public and read-only.

---

# 47. Phase 31 — Public Caching

Implement the caching architecture only after public APIs are stable.

Primary objective:

```text
10,000 students
      ↓
mostly Cloudflare cache
      ↓
minimal Supabase origin traffic
```

Do not make every browser request directly hit PostgreSQL.

---

# 48. Phase 32 — Cache Dependency System

Implement dependency-aware caching.

Example:

```text
Event changes
 ↓
Event cache
 ↓
Relevant category cache
 ↓
Homepage event sections
 ↓
Search cache where applicable
```

Do not clear the entire site for every mutation.

---

# 49. Phase 33 — Cache Invalidation

Connect:

```text
Database mutation
 ↓
Outbox
 ↓
Dependency calculation
 ↓
Targeted invalidation
```

Invalidate only affected resources.

---

# 50. Phase 34 — Cache Warm-Up

For high-value public resources, support proactive regeneration/warm-up where useful.

Examples:

```text
Homepage
Featured
Today
Tomorrow
This Week
Popular event detail pages
```

Do not regenerate the entire public site unnecessarily.

---

# 51. Phase 35 — Free-Tier Capacity Optimization

Target workload:

```text
~10,000 students
~10 new events/day
```

Primary optimization:

```text
Cache public reads
Minimize origin requests
Minimize Supabase egress
Minimize database reads
Use R2 for media
Avoid unnecessary Realtime
Avoid unnecessary Edge Function calls
```

---

# 52. Phase 36 — Image Optimization

Implement upload limits.

Recommended principles:

* Reject unnecessarily large uploads.
* Resize/compress images.
* Use web-optimized formats where appropriate.
* Store optimized versions.
* Cache public images aggressively.

Do not allow unrestricted original-image storage.

---

# 53. Phase 37 — Realtime Policy

Do not enable Realtime globally.

Use it only where a concrete product requirement exists.

The Student Website should primarily rely on:

```text
Cache
+
Request-triggered freshness
+
Targeted invalidation
```

rather than maintaining thousands of live subscriptions.

---

# 54. Phase 38 — Observability

Implement:

* Error tracking.
* Uptime monitoring.
* Structured logs.
* Database monitoring.
* API failure monitoring.
* Background-job monitoring.
* Authentication abuse monitoring.

Monitoring must remain within the free-tier budget where possible.

---

# 55. Phase 39 — Security Review: Authentication

After authentication is implemented, perform a targeted security review.

Check:

* OTP storage.
* OTP expiry.
* OTP replay.
* Rate limiting.
* Session handling.
* Authorization.
* Secret exposure.
* Enumeration.
* Logout.
* Session expiration.

Do not wait until final audit to find basic authentication flaws.

---

# 56. Phase 40 — Security Review: Event Module

After event management is implemented, review:

* Ownership.
* RLS.
* Lifecycle transitions.
* Capacity manipulation.
* Pricing manipulation.
* External URL handling.
* Media ownership.
* IDOR.
* Concurrency.
* Audit logging.

---

# 57. Phase 41 — Security Review: Admin

Review:

* Super Admin authorization.
* Organizer isolation.
* Privileged endpoints.
* Administrative mutations.
* Audit logs.
* Session handling.
* Cache isolation.
* Service-role exposure.

---

# 58. Phase 42 — Security Review: Public Website

Review:

* XSS.
* Unsafe HTML.
* External URLs.
* Cache poisoning.
* Public API abuse.
* Search abuse.
* Rate limiting.
* R2 media access.
* Sensitive data exposure.

---

# 59. Phase 43 — Automated Testing

Test layers:

```text
Unit
Integration
Database
API
Component
End-to-end
```

Prioritize business-critical paths.

---

# 60. Critical End-to-End Tests

At minimum:

```text
Admin OTP login
Organizer access request
Super Admin access request approval
Event creation & publication
Event editing
Capacity Counts By locking
External registration
Event cancellation (Hard delete + audit + outbox)
Advertisement publishing
Public event discovery
Cache invalidation
```

---

# 61. Database Testing

Every critical database invariant must have automated tests.

Especially:

```text
RLS
Ownership
Lifecycle
Unique constraints
Foreign keys
Capacity rules
Pricing rules
Taxonomy
Audit
Outbox
```

---

# 62. API Testing

Every privileged endpoint must have tests for:

```text
Unauthenticated
Organizer
Wrong Organizer
Authorized Organizer
Super Admin
Invalid input
Duplicate request
Concurrent request
```

---

# 63. Frontend Testing

Test:

* Forms.
* Validation.
* Error states.
* Loading states.
* Empty states.
* Route protection.
* Role-aware navigation.
* External registration links.
* Responsive behavior.

---

# 64. Free-Tier Load Testing

Before production, simulate the target workload.

Target scenario:

```text
10,000 students
+
10 new events/day
```

Measure:

* Cache hit rate.
* Origin requests.
* Supabase requests.
* Supabase egress.
* Database load.
* R2 usage.
* API latency.
* Error rate.

---

# 65. Capacity Safety Targets

The implementation should target:

```text
High public cache hit rate
Low origin request volume
Low database read volume
Low Supabase egress
Controlled image storage
Minimal background processing
```

Exact numeric thresholds belong in:

```text
FREE_TIER_CAPACITY.md
```

---

# 66. Quota Monitoring

Monitor free-tier usage for:

```text
Supabase
Cloudflare Pages
Cloudflare R2
Cloudflare
PostHog
Email provider
```

Alerts should occur before quota exhaustion where supported.

---

# 67. Free-Tier Failure Policy

If a free-tier quota approaches its limit:

Prioritize:

```text
1. Core public event discovery
2. Event details
3. Admin event management
4. Authentication
5. Critical backend operations
```

Non-critical functionality should be reduced before core functionality.

Never silently degrade data integrity.

---

# 68. Production Database Migration Policy

Never modify production schema manually.

Production schema changes must follow:

```text
Migration
 ↓
Local test
 ↓
CI test
 ↓
Review
 ↓
Production migration
```

---

# 69. CI/CD

CI must run:

```text
npm install
npm run typecheck
npm run lint
npm run build:student
npm run build:admin
database tests
API tests
```

where applicable.

---

# 70. Deployment Separation

Student Website:

```text
apps/student-web
        ↓
Cloudflare Pages
```

Admin Website:

```text
apps/admin-web
        ↓
Cloudflare Pages
```

A failure in one deployment should not require rebuilding the other application unnecessarily.

---

# 71. Environment Separation

Maintain separate configurations for:

```text
Development
Staging where used
Production
```

Never commit secrets.

---

# 72. Production Secrets

Secrets must exist only in approved server-side/hosting secret stores.

Never commit:

```text
.env
service-role keys
R2 secrets
email secrets
webhook secrets
```

---

# 73. Backup and Recovery

Production PostgreSQL data must have automated backups according to the approved infrastructure plan.

Backups must be:

* Encrypted.
* Retained according to policy.
* Tested for restoration.

A backup that has never been restored is not considered verified disaster recovery.

---

# 74. Disaster Recovery Test

Before final production launch:

```text
Backup
 ↓
Restore
 ↓
Verify schema
 ↓
Verify critical data
 ↓
Verify application compatibility
```

Document the result.

---

# 75. Final Security Audit

After the entire product is feature complete:

Perform a comprehensive end-to-end security review.

This should include:

* Authentication.
* Authorization.
* RLS.
* API.
* Database.
* Admin.
* Student.
* R2.
* Cache.
* External URLs.
* Secrets.
* Rate limiting.
* Audit logs.
* Concurrency.
* Deployment configuration.

This is the final audit, not a substitute for the targeted reviews performed after major modules.

---

# 76. Final Performance Review

Measure:

```text
Student homepage
Event detail
Search
Admin dashboard
Event editor
Access requests reviewer
```

under realistic load.

---

# 77. Final Free-Tier Review

Before production launch confirm:

```text
Expected traffic
+
Expected storage
+
Expected egress
+
Expected API calls
+
Expected background jobs
```

remain within the free-tier capacity model.

---

# 78. Final Manual Verification

Before declaring the system production-ready, manually verify:

## Student Website

* Homepage.
* Search.
* Filters.
* Event Hub.
* Show More.
* Past events.
* Event details.
* External registration.
* Advertisement display.
* Carousel.
* Dark/light mode.
* Responsive layouts.

## Admin Website

* Email OTP.
* Organizer access workflow.
* Super Admin access approval workflow.
* Event creation & publication.
* Editing.
* Cancellation.
* Advertisement management.
* Carousel.
* Categories.
* Sponsors.
* Memories.
* Audit logs.
* System health.

---

# 79. Release Candidate

Create a release candidate only after:

```text
All critical tests pass
+
Security reviews pass
+
Free-tier capacity is acceptable
+
Backup restore is verified
+
Manual verification passes
```

---

# 80. Production Launch

Production launch sequence:

```text
1. Final database migration
2. Verify production secrets
3. Deploy backend
4. Verify health
5. Deploy Student Website
6. Verify Student Website
7. Deploy Admin Website
8. Verify Admin Website
9. Verify external registration
10. Verify cache
11. Monitor
```

---

# 81. Post-Launch Monitoring

Immediately after launch monitor:

* Error rate.
* Authentication failures.
* OTP abuse.
* API latency.
* Database load.
* Cache hit rate.
* Supabase egress.
* R2 usage.
* Failed background jobs.
* Failed emails.
* Failed webhooks.
* Public website availability.

---

# 82. Development Rule — No Scope Creep

During implementation, developers/AI agents must not introduce:

```text
New framework
New database
New authentication provider
New caching system
New payment system
New ticketing system
New deployment platform
```

without an explicit architecture decision.

---

# 83. Development Rule — No Direct Production Hacks

Do not:

```text
Edit production database manually
Disable RLS to fix an application bug
Expose service-role keys
Disable security checks
Bypass lifecycle validation
Disable cache controls
```

to make a feature work.

Fix the underlying implementation.

---

# 84. Development Rule — Backend First for Business Logic

For business-critical functionality:

```text
Database invariants
 ↓
Backend operation
 ↓
API contract
 ↓
Frontend UI
```

Do not implement business logic exclusively in React.

---

# 85. Development Rule — UI Is Not Security

The following are UX controls, not security controls:

```text
Disabled button
Hidden menu
Hidden route
Read-only input
Frontend validation
```

Security must be enforced server-side.

---

# 86. Development Rule — One Source of Truth

Do not duplicate authoritative state across:

```text
Database
localStorage
frontend constants
separate JSON database
MongoDB
another live database
```

PostgreSQL remains the operational source of truth.

---

# 87. Development Rule — Public Data Is Cacheable, Private Data Is Not

Public Student Website content may be aggressively cached.

User-specific or authenticated Admin data must not be placed into shared public caches.

---

# 88. Development Rule — Free Tier First

Every new dependency must answer:

```text
Does it work on the free tier?
What is its quota?
What happens when the quota is reached?
Does it create unnecessary network traffic?
Can we remove it?
```

Do not add a paid dependency merely for convenience.

---

# 89. Development Rule — Simplicity

Prefer:

```text
Existing stack
+
Simple architecture
+
Fewer moving parts
+
Cache public reads
+
PostgreSQL source of truth
```

over unnecessary infrastructure.

---

# 90. Completion Gates

Each major phase has a gate.

```text
Phase
 ↓
Implementation
 ↓
Automated tests
 ↓
Manual verification
 ↓
Targeted security review
 ↓
Phase complete
```

Do not move to the next major phase when a critical gate fails.

---

# 91. Manual Verification Rule

After every major implementation task, explicitly document:

```text
Manual verification required: YES / NO
```

If YES, list exactly what must be checked manually.

A task is not considered complete until the required manual verification is completed.

---

# 92. Recommended Development Order

Final execution order:

```text
01. Repository foundation
02. Database schema
03. Database constraints/RLS
04. Database tests
05. Authentication
06. Authorization
07. API foundation
08. Transactional outbox
09. Resource versions
10. Admin shell
11. Organizer access workflow
12. Organization management
13. Taxonomy
14. Event creation
15. Event lifecycle
16. Retired (Event approval)
17. Event editing
18. Media/R2
19. External registration
20. Advertisements
21. Carousel
22. Sponsors
23. Event Memories
24. Audit logs
25. Operations
26. Student Website shell
27. Public event discovery
28. Event details
29. Search/filtering
30. Public caching
31. Cache invalidation
32. Free-tier optimization
33. Observability
34. Automated testing
35. Load/capacity testing
36. Targeted security reviews
37. Backup/restore verification
38. Production deployment
39. Final end-to-end security audit
40. Production launch
```

---

# 93. Final Definition of Done

LPU Events is considered implementation-complete only when:

```text
Database
        +
Backend
        +
Authentication
        +
Authorization
        +
Admin Website
        +
Student Website
        +
Caching
        +
Media
        +
Observability
        +
Testing
        +
Security
        +
Free-tier capacity validation
        +
Backup/recovery
        +
Production deployment
```

are all verified.

---

# 94. Final Architecture Invariant

The implementation must preserve:

```text
PostgreSQL
    ↓
Single source of truth

Cloudflare
    ↓
Public delivery/cache

R2
    ↓
Media storage

Supabase
    ↓
Authentication + backend/database infrastructure

Student Website
    ↓
Public read-only discovery
    ↓
External registration

Admin Website
    ↓
Administrative control
```

---

# 95. Final Status

**IMPLEMENTATION_PLAN.md is the canonical development execution plan for LPU Events.**

Development must proceed phase-by-phase.

No major feature should be implemented out of sequence without documenting the dependency and verifying that the architecture remains consistent.

The final goal is a simple, secure, reproducible, independently deployable, free-tier-oriented LPU Events platform capable of serving the expected workload without introducing unnecessary infrastructure.
