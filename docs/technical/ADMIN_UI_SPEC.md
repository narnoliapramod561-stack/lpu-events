# LPU Events — Admin Website UI Specification

**File:** `docs/technical/ADMIN_UI_SPEC.md`  
**Status:** LOCKED — Canonical Admin Website UI/UX Specification  
**Version:** 1.0  
**Date:** 14 August 2026

---

# 1. Purpose

This document defines the complete UI, UX, navigation, workflows, authorization boundaries, validation behavior, operational interfaces, and failure behavior of the LPU Events Admin Website.

The Admin Website is a separate web application from the Student Website.

The Admin Website is responsible for:

- Platform administration.
- Organizer administration.
- Event management.
- Event approval.
- Public content management.
- Advertisement management.
- Carousel management.
- Category management.
- Sponsor management.
- Event Memories management.
- Operational monitoring where supported.
- Audit visibility.
- System health visibility.

The Admin Website is not the public Student Website.

---

# 2. Application Separation

The platform contains two independent web applications.

```text
apps/
├── student-web/
└── admin-web/
````

## Student Website

Purpose:

```text
Public event discovery
        ↓
Event details
        ↓
External registration
```

## Admin Website

Purpose:

```text
Authentication
        ↓
Authorization
        ↓
Platform administration
        ↓
Organizer administration
        ↓
Event/content management
```

The two applications may share safe code and types but must remain separate deployable applications.

---

# 3. Product Boundary

The Admin Website must not accidentally turn LPU Events into an internal ticketing/payment platform.

The current product boundary is:

```text
LPU Events
    ↓
Event discovery and administration
    ↓
Organizer-provided external registration URL
    ↓
External registration/ticketing platform
```

LPU Events does not process the student's external registration transaction.

---

# 4. Roles

The Admin Website supports two administrative roles:

```text
SUPER_ADMIN
ORGANIZER
```

No other administrative role should be introduced without an explicit product decision.

---

# 5. Super Admin

Super Admin has platform-level administrative authority.

Responsibilities include:

* Organizer access-request review.
* Organization administration.
* Event approval/rejection.
* Platform content management.
* Category/subcategory management.
* Advertisement management.
* Carousel management.
* Sponsor management.
* Event Memories management.
* Operational monitoring.
* Audit log access.
* System health monitoring.
* Platform configuration where explicitly supported.

Super Admin still remains subject to database constraints and business invariants.

Super Admin does not bypass security merely because of the role.

---

# 6. Organizer

Organizer is an organization-scoped administrative role.

Organizer can manage resources belonging to their authorized organization.

Organizer may:

* View organization information.
* Create events.
* Edit authorized events.
* Configure event registration information.
* Upload event media.
* Submit events for approval.
* View event lifecycle status.
* Cancel events where permitted.
* Manage other organizer capabilities explicitly assigned by the platform.

Organizer cannot:

* Approve their own events.
* Access another organization's events.
* Manage platform-wide advertisements.
* Manage platform-wide categories.
* Manage platform-wide carousel content.
* View platform-wide audit logs.
* Modify Super Admin settings.
* Change their own authorization level.

---

# 7. Authentication

The Admin Website uses **passwordless email OTP authentication**.

The only supported authentication method is:

```text
Email Address
+
One-Time Password
```

There is no password authentication.

---

# 8. Prohibited Authentication Methods

The following are explicitly prohibited:

```text
Password login
Password signup
Password reset
Password change
Google Sign-In
Google OAuth
Apple Sign-In
Microsoft Sign-In
GitHub Sign-In
Facebook Sign-In
Other social login
```

Email OTP is the sole Admin authentication mechanism unless this specification is explicitly changed.

---

# 9. Admin Login Flow

```text
Admin
  ↓
Admin Login
  ↓
Enter Email
  ↓
Request OTP
  ↓
Backend validates request
  ↓
OTP generated
  ↓
OTP stored as hash only
  ↓
OTP sent by email
  ↓
Enter OTP
  ↓
Verify OTP
  ↓
Authenticated session
  ↓
Backend role authorization
  ↓
Admin Dashboard
```

---

# 10. Login Page

The login page contains:

```text
LPU Events Admin

Email Address
[________________________]

[ Send OTP ]
```

There must be no password field.

There must be no Google Sign-In button.

---

# 11. OTP Verification Page

After requesting an OTP:

```text
Check your email

OTP sent to:
example@domain.com

[ _ _ _ _ _ _ ]

[ Verify OTP ]

Resend OTP
```

The exact OTP length is defined by the Security Architecture.

---

# 12. OTP Security

OTP requirements:

* Cryptographically secure random generation.
* Short expiration.
* Single use.
* Hash-only storage.
* Never store plaintext OTPs.
* Never return OTPs through APIs.
* Never log OTP values.
* Invalidate after successful verification.
* Invalidate after expiration.
* Rate limit generation.
* Rate limit verification attempts.

---

# 13. OTP Storage

The database must never contain plaintext OTP values.

The system stores only a secure hash or equivalent verifier.

Example:

```text
OTP entered
    ↓
Hash
    ↓
Compare against stored verifier
```

---

# 14. OTP Expiration

An OTP becomes invalid after the configured expiration period.

An expired OTP cannot authenticate the user.

---

# 15. OTP Replay Protection

Once an OTP has been successfully used:

```text
OTP
 ↓
USED
```

it cannot be reused.

---

# 16. OTP Attempt Protection

Repeated incorrect OTP attempts must trigger the configured protection mechanism.

The frontend cannot bypass this protection.

The backend is authoritative.

---

# 17. OTP Request Rate Limiting

OTP generation must be rate limited using appropriate signals such as:

* Email address.
* IP address.
* Authentication request/session identifiers.
* Other abuse-protection signals where appropriate.

The system must prevent OTP flooding.

---

# 18. OTP Enumeration Protection

Authentication responses must not unnecessarily reveal whether an email address belongs to:

* An Organizer.
* A Super Admin.
* Another administrative account.
* No account.

The exact authentication response must follow the security architecture.

---

# 19. Session Creation

Successful OTP verification creates an authenticated session.

Authentication and authorization are separate:

```text
OTP verified
    ↓
Authenticated
    ↓
Determine role
    ↓
Authorize requested operation
```

---

# 20. Session Expiration

If the session expires:

```text
Protected request
    ↓
Unauthorized
    ↓
Clear authenticated state
    ↓
Return to login
```

The frontend must not continue using stale authorization state.

---

# 21. Logout

Logout must:

1. Invalidate the authenticated session.
2. Clear sensitive client state.
3. Return the user to login.
4. Prevent previously authenticated screens from remaining usable.

---

# 22. Authorization

The backend is the authority for:

* Role.
* Organization membership.
* Event ownership.
* Resource permissions.
* Lifecycle transitions.
* Administrative permissions.

The frontend must never be trusted for authorization.

---

# 23. Authorization Model

Every protected operation follows conceptually:

```text
Authenticated identity
        ↓
Role
        ↓
Organization membership where applicable
        ↓
Resource ownership
        ↓
Lifecycle/business rules
        ↓
Database authorization
        ↓
Mutation
```

---

# 24. Route Protection

Protected routes require authentication.

However:

> Frontend route protection is only a UX layer.

Every API operation must independently enforce authorization.

---

# 25. Unauthorized Access

If an Organizer accesses a Super Admin route:

```text
403 Forbidden
```

or equivalent safe access-denied behavior must be shown.

The UI must not rely on merely hiding navigation items.

---

# 26. Application Routes

Recommended route structure:

```text
/login

/organizer
/organizer/dashboard
/organizer/events
/organizer/events/new
/organizer/events/:eventId
/organizer/organization

/admin
/admin/dashboard
/admin/access-requests
/admin/organizations
/admin/events
/admin/events/:eventId
/admin/advertisements
/admin/carousel
/admin/categories
/admin/sponsors
/admin/memories
/admin/operations
/admin/audit-logs
/admin/system-health
```

Routes may evolve without changing the underlying authorization model.

---

# 27. Admin Layout

The Admin Website uses:

```text
Sidebar
+
Top Header
+
Main Content
```

The visible navigation is role-aware.

Authorization remains backend-controlled.

---

# 28. Organizer Navigation

Organizer navigation should contain only authorized functionality.

Example:

```text
Dashboard
My Events
Create Event
Organization
```

---

# 29. Super Admin Navigation

Super Admin navigation may contain:

```text
Dashboard
Access Requests
Organizations
Events
Advertisements
Carousel
Categories
Sponsors
Event Memories
Operations
Audit Logs
System Health
Settings
```

---

# 30. Dashboard — Organizer

Organizer dashboard should show:

* Own event statistics.
* Published events.
* Completed events.
* Relevant warnings.
* Required actions.

No other organization's data may appear.

---

# 31. Dashboard — Super Admin

Super Admin dashboard may show:

* Pending organizer requests.
* Published events.
* Recently changed events.
* Advertisement status.
* Operational failures.
* Failed jobs.
* System health.
* Important platform alerts.

Dashboard statistics are informational.

They are not the source of truth.

---

# 32. Event Data Source

All events use one authoritative database entity:

```text
events
```

There are no separate authoritative tables for:

```text
draft_events
pending_events
published_events
```

Lifecycle state exists within the single event entity.

---

# 33. Event ID

An event receives one stable ID.

The event ID does not change when:

* Edited.
* Submitted.
* Approved.
* Rejected.
* Published.
* Cancelled.
* Completed.

---

# 34. Event Lifecycle

The Admin UI must reflect the backend state machine. Since all events publish directly, the operational lifecycle is simple:

```text
PUBLISHED
    │
    │ end_at reached
    ▼
COMPLETED
```

When an event is cancelled, it is hard deleted from the operational database. There is no CANCELLED or DRAFT database state.

The exact states and allowed transitions must match the canonical database/API specifications.

---

# 35. Lifecycle Authority

The frontend must never directly change lifecycle state.

Incorrect:

```text
UPDATE events SET status = 'PUBLISHED'
```

from the browser.

Correct:

```text
Admin UI
  ↓
Protected backend operation
  ↓
Authorization
  ↓
Business validation
  ↓
Database transaction
  ↓
Outbox
  ↓
Cache invalidation
```

---

# 36. Event Creation

Organizer selects:

```text
Create Event
```

The event form contains fields defined by the canonical database schema.

Required and optional fields must be clearly identified.

---

# 37. Event Publication

When the Organizer selects Publish Event:

```text
Admin UI
  ↓
Backend validation
  ↓
PUBLISHED
```

The backend performs direct validation (dates, organization authorization, external URL, taxonomy). If validation succeeds, the event is immediately created with status `PUBLISHED`. There is no approval requirement or pending state.

---

# 38. Event Form

The event form may include:

```text
Event Name
Description
Banner
Category
Subcategory
Date
Start Time
End Time
Venue
Registration Mode
Pricing Mode
Price
Capacity
Capacity Counts By
External Registration URL
Organizer Information
Additional Event Information
```

The exact canonical field list comes from `DATABASE_SCHEMA.md`.

---

# 39. Event Name

Event name must:

* Be required.
* Respect configured length limits.
* Be validated server-side.
* Be safely rendered in public UI.

---

# 40. Event Description

Description content must be safely stored and rendered.

If rich text is supported:

* Sanitize content.
* Prevent XSS.
* Do not render arbitrary executable HTML.

---

# 41. Category

Organizer selects a category from the approved taxonomy.

Only active/usable categories should be selectable.

---

# 42. Subcategory

Subcategory options depend on the selected category.

Invalid category/subcategory combinations must be rejected server-side.

---

# 43. Date and Time

Organizer specifies:

```text
Event Date
Start Time
End Time
```

Business-time calculations use:

```text
Asia/Kolkata
```

The backend remains authoritative for temporal validation.

---

# 44. Venue

Venue information must use the approved event fields.

Required fields must be clearly marked.

---

# 45. Event Banner

Organizer may upload an event banner using the controlled media workflow.

The Admin browser must never receive permanent private storage credentials.

---

# 46. Media Upload

Recommended flow:

```text
Admin Website
    ↓
Request upload authorization
    ↓
Backend validates user/event
    ↓
Controlled upload authorization
    ↓
Cloudflare R2
    ↓
Upload
    ↓
Confirm upload
    ↓
Backend associates media
```

---

# 47. Media Security

Backend must validate:

* File type.
* File size.
* Resource ownership.
* Upload authorization.
* Object path.
* Association target.

Frontend validation is not a security control.

---

# 48. External Registration URL

The event may contain an organizer-provided external registration URL.

This URL is used by the Student Website.

The Organizer is responsible for providing the correct URL.

---

# 49. External URL Policy

The current product requirement does not require product-level URL availability checking.

The platform should safely store and render the URL.

The platform must not silently rewrite the destination.

---

# 50. Registration Mode

Registration mode and pricing mode are separate concepts.

Registration mode:

```text
INDIVIDUAL
TEAM
```

---

# 51. Pricing Mode

For Team Registration:

```text
FIXED_TEAM_PRICE
PER_MEMBER_PRICE
```

Pricing mode does not determine registration mode.

---

# 52. Team Registration

Team Registration represents a team-based registration model.

The Student Website still does not process the registration.

The external registration platform owns the actual transaction.

---

# 53. Capacity Counts By

Team Registration may use:

```text
TEAMS
STUDENTS
```

as its capacity-counting basis.

---

# 54. Capacity Counts By Lock

Before approval submission:

```text
Capacity Counts By
    ↓
Editable
```

After the event is submitted for Super Admin approval:

```text
Capacity Counts By
    ↓
IMMUTABLE
```

This restriction must be enforced by the backend.

Disabling the UI control alone is insufficient.

---

# 55. Pricing Validation

Valid combinations must be enforced.

Conceptually:

```text
Individual Registration
    ↓
Individual pricing

Team Registration
    ↓
Fixed Team Price
OR
Per Member Price
```

The database/backend remains authoritative.

---

# 56. Capacity Validation

Capacity values must obey database and business constraints.

The frontend provides useful validation messages.

The backend performs the final validation.

---

# 57. External Booking Boundary

The platform's registration architecture is:

```text
Student Website
      ↓
Event Details
      ↓
Register
      ↓
Organizer-provided external URL
      ↓
External platform
```

The Admin Website configures the destination.

LPU Events does not own the external booking transaction.

---

# 58. No Internal Ticket Checkout

The current Admin Website must not provide:

```text
Book Ticket
Reserve Ticket
Choose Seat
Internal Checkout
Internal Payment
Internal Ticket Purchase
```

unless the product architecture is explicitly changed.

---

# 59. Event Publication Action

Organizer publication:

```text
Edit Event
    ↓
Publish Event
    ↓
Backend validation
    ↓
PUBLISHED
```

The UI must clearly show the resulting state.

---

# 60. Publication Locking

After event creation/publication, immutable fields must be visibly locked.

At minimum:

```text
Capacity Counts By
```

is locked and immutable to prevent corruption of external registration metrics.

---

# 61. Approval Queue (Disabled)

This section is disabled. There is no Super Admin approval queue for events under the direct-publishing model.

---

# 62. Approval Detail (Disabled)

This section is disabled. There is no Super Admin approval detail screen under the direct-publishing model.

---

# 63. Approve Event (Disabled)

This section is disabled. There is no event approval action.

---

# 64. Reject Event (Disabled)

This section is disabled. There is no event rejection action.

---

# 65. Rejected Event (Disabled)

This section is disabled.

---

# 66. Event Editing

Organizer may edit only:

```text
Authorized event
+
Allowed fields
+
Allowed lifecycle state (PUBLISHED)
```

The backend must enforce all three.

---

# 67. Published Event Editing

Published event editing updates the event details directly after validation and increments the resource version. No approval or re-approval is required.

---

# 68. Event Cancellation

Authorized cancellation uses a controlled backend transition.

The frontend must never directly change the event state.

---

# 69. Cancellation Confirmation

Cancellation requires explicit confirmation.

The dialog should communicate the consequences.

Where required, a cancellation reason must be collected.

---

# 70. Completed Events

Completed events remain historical records.

They must not disappear simply because the event is no longer upcoming.

The Admin Website must clearly distinguish:

```text
PUBLISHED
COMPLETED
CANCELLED
```

---

# 71. Event Search

Admin event search may support:

```text
Event Name
Event ID
Organization
Organizer
Status
Category
Date
```

Search should be server-side for large datasets.

---

# 72. Event Filters

Supported filters may include:

```text
Status
Organization
Category
Date Range
Registration Mode
Pricing Mode
```

Only filters supported by the API should be exposed.

---

# 73. Pagination

Large Admin datasets must be paginated.

Prefer cursor/keyset pagination where appropriate.

Do not download the entire event database into the browser.

---

# 74. Access Requests

Super Admin can review Organizer access requests.

Conceptual workflow:

```text
REQUESTED
    ↓
REVIEW
    ↓
APPROVED / REJECTED
```

Exact states must match the canonical database/API specification.

---

# 75. Access Request Detail

Show:

* Applicant information.
* Organization.
* Submission date.
* Current state.
* Review information where supported.

---

# 76. Access Request Approval

Approval must be performed through a protected backend operation.

The browser must not directly update access-request records.

---

# 77. Organization Management

Super Admin can manage organizations.

Organization membership must remain authoritative.

Organizer cannot:

* Change their organization through client-side manipulation.
* Add themselves to another organization.
* Access another organization's events.

---

# 78. Organization Lifecycle

Organization activation/deactivation must use controlled backend operations.

Existing resources must remain referentially consistent.

---

# 79. Advertisement Management

Super Admin manages advertisements.

Advertisement fields include:

```text
Name
Image/Banner
Redirect URL
Positions
Start Date
End Date
Status
Analytics
```

---

# 80. Advertisement Positions

Supported positions:

```text
homepage_top
homepage_feed
event_top
event_bottom
```

Super Admin manually selects applicable positions.

---

# 81. Advertisement Feed Rule

Super Admin may configure the event-card insertion interval.

Example:

```text
After every 5 event cards
```

The rule must be applied consistently across pagination/Show More operations.

---

# 82. Advertisement Scheduling

Advertisement eligibility depends on:

```text
Start Date
End Date
Status
Position
```

The backend is authoritative.

---

# 83. Advertisement Rotation

When multiple active advertisements occupy the same position, the platform may rotate them according to the configured selection strategy.

The Admin UI should show which advertisements are eligible.

---

# 84. Advertisement Analytics

Advertisement analytics are independent from advertisement configuration.

Analytics may include:

```text
Clicks
Impressions where implemented
Performance by period
Performance by position
```

Historical analytics must not be rewritten simply because an advertisement is edited.

---

# 85. Carousel Management

Carousel is a separate system from advertisements.

Super Admin may:

* Create carousel content.
* Edit carousel content.
* Activate/deactivate.
* Reorder.
* Remove.

---

# 86. Carousel vs Advertisement

These must remain separate:

```text
Carousel
    ↓
Presentation/content

Advertisement
    ↓
Promotion/advertising + analytics
```

Do not merge the two entities.

---

# 87. Category Management

Super Admin manages:

```text
Categories
Subcategories
```

Category relationships must remain valid.

---

# 88. Category Deactivation

Where events reference a category, deactivation is generally safer than destructive deletion.

The exact deletion/reassignment rules must follow the database schema.

No orphaned category references are allowed.

---

# 89. Sponsor Management

Super Admin may:

* Create sponsors.
* Edit sponsors.
* Activate/deactivate sponsors.
* Reorder sponsors.

Sponsor changes trigger appropriate public cache invalidation.

---

# 90. Event Memories

Super Admin may manage public Event Memories.

Supported operations may include:

* Create.
* Edit.
* Upload media.
* Activate/deactivate.
* Remove.

---

# 91. Operations Console

The Operations Console exists for genuine platform operational data.

Potential areas:

```text
Student Lookup
Failed Emails
Failed Webhooks
Queue Monitoring
System Health
```

---

# 92. Payment/Refund Boundary (Out of Scope)

LPU Events does not own, process, or integrate with payments or refunds. The external registration platform is solely responsible for all financial transactions. The Admin Website must not contain payment dashboards or refund actions.

---

# 93. No Fake Operational Data

Do not create placeholder UI screens or databases for payments, refunds, bookings, or tickets.

---

# 94. Ticket Verification (Out of Scope)

This section is disabled. LPU Events does not manage ticket verification or QR code validation.

---

# 95. Ticket Verification Boundary (Out of Scope)

This section is disabled.

---

# 96. QR Verification (Out of Scope)

This section is disabled.

---

# 97. Manual Ticket Lookup (Out of Scope)

This section is disabled.

---

# 98. Scan Logging (Out of Scope)

This section is disabled.

---

# 99. Audit Logs

Important administrative actions must be auditable.

Examples:

```text
Organizer approval
Organizer rejection
Event creation
Event changes
Event approval
Event rejection
Event cancellation
Advertisement changes
Carousel changes
Category changes
Sponsor changes
Memory changes
Administrative settings changes
```

---

# 100. Audit Log Interface

Super Admin can search/filter by:

```text
Actor
Action
Resource Type
Resource ID
Date Range
```

---

# 101. Audit Log Integrity

Audit logs are:

* Read-only in the normal Admin UI.
* Not editable by Organizers.
* Not directly deletable through the Admin UI.

Audit logs are separate from analytics.

---

# 102. System Health

Super Admin may view:

```text
Database
API
Background jobs
Email system
Storage
Webhook processing
Cache/invalidation
External integrations
```

Only systems actually deployed should be represented.

---

# 103. Health Status Integrity

A "Healthy" indicator must represent an actual health check.

The frontend must not fabricate system health status.

---

# 104. Queue Monitoring

Where background jobs exist, Super Admin may see:

* Pending jobs.
* Processing jobs.
* Failed jobs.
* Retry counts.
* Processing latency.
* Dead-letter/failure states where applicable.

Sensitive payloads must be redacted.

---

# 105. Failed Emails

Display operational information such as:

* Job ID.
* Type.
* Status.
* Attempt count.
* Last failure.
* Retry status.

Do not expose provider credentials.

---

# 106. Failed Webhooks

Display:

* Provider.
* Event type.
* Received timestamp.
* Processing state.
* Retry count.
* Failure reason.
* Idempotency/reference identifier.

Sensitive payload content must be minimized.

---

# 107. Admin Forms

All forms must provide:

* Required-field indication.
* Field validation.
* Cross-field validation.
* Lifecycle-aware validation.
* Accessible error messages.

Frontend validation improves UX.

Backend validation remains authoritative.

---

# 108. Save vs Submit

The UI must clearly distinguish:

```text
Save Changes
```

from:

```text
Submit for Approval
```

These actions have different consequences.

---

# 109. Unsaved Changes

Long forms should warn before navigating away when meaningful unsaved changes exist.

Do not show unnecessary warnings when no changes exist.

---

# 110. Destructive Actions

Destructive operations require explicit confirmation.

Examples:

```text
Cancel Event
Deactivate Advertisement
Remove Sponsor
Delete Media
Remove Carousel Item
```

The confirmation must explain the actual consequence.

---

# 111. Double Submission Protection

Mutation buttons must prevent accidental duplicate requests.

Example:

```text
Approve
```

must not produce multiple approvals from repeated clicks.

Backend idempotency/state-transition protection remains mandatory.

---

# 112. Optimistic UI

Security-sensitive operations should not use optimistic success states.

Prefer:

```text
Request
  ↓
Backend success
  ↓
Update UI
```

The UI must not display "Approved" before the backend confirms approval.

---

# 113. Mutation Failure

When a mutation fails:

* Do not show false success.
* Preserve safe user input where possible.
* Show a meaningful error.
* Refresh stale data when necessary.

---

# 114. Concurrency Control

If two administrators edit the same resource, the backend must detect conflicting versions where required.

Example:

```text
Admin A reads Version 10
Admin B changes Version 10 → 11
Admin A submits Version 10
```

Admin A must not silently overwrite Version 11.

The UI should show a conflict/reload state.

---

# 115. Concurrency Race Protection

If two admins attempt to edit the same event simultaneously, the backend must safely handle the concurrency race using resource versions.

---

# 116. Concurrency Race Boundary

The frontend must display the authoritative state returned by the backend in case of conflict.

---

# 117. Organizer Edit Concurrency

If an Organizer changes an event while another is viewing or editing it:
* Backend concurrency rules apply.
* Stale versions must be detected.
* Silent overwrites are prohibited.

---

# 118. Cache Invalidation

Successful Admin mutations must trigger appropriate cache invalidation.

Example:

```text
Admin mutation
    ↓
PostgreSQL transaction
    ↓
Outbox event
    ↓
Dependency calculation
    ↓
Targeted cache invalidation
    ↓
Student Website refresh
```

The browser must not directly purge Cloudflare cache.

---

# 119. Resource Versions

Relevant public resource changes update resource versions such as:

```text
events_version
categories_version
ads_version
sponsors_version
carousel_version
memories_version
```

Resource version updates must be transactionally associated with the underlying mutation.

---

# 120. Cache Safety

Authenticated Admin responses must not enter shared public Cloudflare caches.

Public cache representations and Admin responses are separate.

---

# 121. Admin Search

Search must be:

* Server-side where datasets are large.
* Debounced where appropriate.
* Race-safe.
* Pagination-aware.
* Authorization-aware.

Older search responses must not overwrite newer results.

---

# 122. Admin Tables

Tables should support where appropriate:

* Search.
* Filters.
* Sorting.
* Pagination.
* Loading state.
* Empty state.
* Error state.

---

# 123. Empty State

Example:

```text
No pending events.
```

An empty result is not an error.

Provide useful next actions where appropriate.

---

# 124. Error State

Example:

```text
Unable to load events.

[ Retry ]
```

Never expose internal stack traces.

---

# 125. Loading State

Use localized loading states.

Do not replace the entire Admin application with a spinner whenever a single table is loading.

---

# 126. Responsive Design

The Admin Website must support:

```text
Desktop
Tablet
Mobile where practical
```

Complex administrative tables may use horizontal scrolling or responsive cards.

Readability takes priority over forcing every table into a narrow mobile layout.

---

# 127. Accessibility

Target WCAG 2.2 AA principles where practical.

Required:

* Keyboard navigation.
* Visible focus.
* Semantic controls.
* Accessible labels.
* Accessible forms.
* Accessible error messages.
* Accessible dialogs.
* Proper heading hierarchy.
* Sufficient contrast.
* Screen-reader-compatible state changes.

---

# 128. Dialog Accessibility

Dialogs must:

* Have accessible titles.
* Trap focus appropriately.
* Have explicit actions.
* Provide Cancel.
* Avoid accidental destructive confirmation.

---

# 129. Notifications

The Admin Website may use:

```text
Success
Warning
Information
Error
```

notifications.

Critical information must not exist only inside a temporary toast.

---

# 130. Error Boundaries

An error in one Admin module should not unnecessarily crash the entire application.

Provide module-level recovery where practical.

---

# 131. Security Boundary

The Admin Website is an untrusted browser client.

Never trust client-supplied:

```text
role
organization_id
event_owner_id
event_state
capacity
pricing
approval state
resource permissions
```

All must be validated server-side.

---

# 132. Privileged Secrets

The browser must never receive:

```text
SUPABASE_SERVICE_ROLE_KEY
R2_SECRET
R2_ACCESS_KEY
Payment provider secret keys
Email provider secret keys
Webhook signing secrets
Other server-side credentials
```

---

# 133. Database Access

The Admin Website must not connect directly to PostgreSQL using privileged credentials.

All protected mutations go through the approved backend architecture.

---

# 134. RLS

Row Level Security remains enabled for protected database tables.

Backend authorization and RLS work together.

Neither should be replaced by frontend checks.

---

# 135. Organizer Ownership

Organizer access requires:

```text
Authenticated Organizer
        +
Authorized organization membership
        +
Resource belongs to that organization
```

This must be enforced server-side.

---

# 136. Super Admin Authority

Super Admin may have platform-wide access where explicitly defined.

However:

```text
Super Admin
    ≠
Ignore database constraints
```

Database invariants remain mandatory.

---

# 137. Authentication Abuse Protection

Authentication endpoints must include appropriate protection against:

* OTP flooding.
* Brute-force OTP attempts.
* Credential/account enumeration.
* Automated abuse.

Cloudflare/WAF/rate limiting/Turnstile may be used according to the Security Architecture.

---

# 138. Auditability

Important privileged operations must create audit records.

Audit logging should occur as part of the backend-controlled mutation workflow.

The UI must not be responsible for creating trustworthy audit records.

---

# 139. Analytics

The Admin Website uses the shared PostHog project.

Persistent application property:

```text
app = "admin"
```

Student Website:

```text
app = "student"
```

---

# 140. Analytics Events

Possible Admin analytics:

```text
admin_login
event_created
event_submitted
event_approved
event_rejected
event_cancelled
advertisement_created
advertisement_updated
carousel_updated
category_updated
sponsor_updated
memory_updated
```

Analytics are not a replacement for audit logs.

---

# 141. Analytics Failure

Analytics failure must never block an administrative operation.

---

# 142. Performance

The Admin Website should:

* Paginate large datasets.
* Lazy-load rarely used modules.
* Avoid unnecessary dashboard queries.
* Avoid downloading entire tables.
* Reuse safe reference data.
* Avoid duplicate API requests.

---

# 143. Reference Data

Reference data such as categories may be cached/reused where safe.

However, stale client reference data must never override backend validation.

---

# 144. URL State

List filters may be represented in URL query parameters.

Example:

```text
/admin/events?status=PENDING_APPROVAL
```

This supports:

* Refresh.
* Browser back/forward.
* Reproducible administrative views.

---

# 145. Sensitive URL State

Never put:

```text
OTP
session secrets
password
private tokens
secret API keys
sensitive payloads
```

in URLs.

---

# 146. Browser Back After Logout

After logout, browser Back must not restore a usable authenticated Admin interface.

Sensitive pages must revalidate authorization.

---

# 147. Authorization Revocation

If an Organizer loses authorization while the Admin Website is open:

```text
Existing session
    ↓
Protected API request
    ↓
Backend rejects
    ↓
UI updates access state
```

Cached authorization must not grant continued access.

---

# 148. Organization Deactivation

When an organization becomes inactive:

* Organizer access is updated according to backend policy.
* New unauthorized mutations are blocked.
* Existing resource relationships remain consistent.
* Orphaned resources are prohibited.

---

# 149. External Registration Failure

If the Organizer's external registration platform is unavailable, the Admin Website must not claim that LPU Events' internal payment system failed.

Correct:

```text
External registration service may be unavailable.
```

Incorrect:

```text
LPU Events payment failed.
```

when LPU Events did not process the payment.

---

# 150. UI Security Review — Pass 1

## Loophole A — Frontend role spoofing

**Risk:** User changes local role state.

**Fix:** Backend role authorization.

---

## Loophole B — Organizer accesses another organization's event

**Risk:** Manipulated organization/event ID.

**Fix:** Backend ownership checks + RLS.

---

## Loophole C — Organizer modifies immutable field

**Risk:** UI disabled but malicious API request changes it.

**Fix:** Backend and database enforcement.

---

## Loophole D — Client publishes event directly

**Risk:** Browser manipulates lifecycle state.

**Fix:** Controlled backend state transition.

---

## Loophole E — Admin response enters public cache

**Risk:** Sensitive information becomes publicly cacheable.

**Fix:** Private/no-store authenticated responses.

---

## Loophole F — External registration mistaken for internal payment

**Risk:** Developers implement an accidental checkout system.

**Fix:** Explicit external-registration boundary.

---

# 151. UI Security Review — Pass 2

## Loophole G — OTP stored in plaintext

**Fix:** Hash-only OTP storage.

---

## Loophole H — OTP reused

**Fix:** Single-use OTP state.

---

## Loophole I — Unlimited OTP requests

**Fix:** Rate limiting and cooldown.

---

## Loophole J — Unlimited OTP guesses

**Fix:** Verification attempt limits.

---

## Loophole K — Password authentication accidentally introduced

**Fix:** No password fields, password schema, password APIs, or password recovery workflow.

---

## Loophole L — Google Sign-In accidentally introduced

**Fix:** Email OTP is the sole authentication mechanism.

---

# 152. UI Security Review — Pass 3

## Loophole M — Concurrent Admin overwrites another Admin

**Fix:** Version/concurrency checks.

---

## Loophole N — Duplicate approval request

**Fix:** Backend transition safety + UI request locking.

---

## Loophole O — Arbitrary R2 object upload

**Fix:** Controlled upload authorization.

---

## Loophole P — Audit records modified by Admin

**Fix:** Read-only audit UI and protected backend.

---

## Loophole Q — Fake payment/refund console

**Fix:** Operational modules only represent genuinely platform-managed data.

---

# 153. UI Security Review — Pass 4

## Loophole R — External URL becomes executable content

**Fix:** Safe URL storage/rendering and safe browser navigation.

---

## Loophole S — Stale authorization

**Fix:** Backend authorization on every protected operation.

---

## Loophole T — Ticket verification

**Fix:** Ticket verification is entirely out of scope. No QR scanning, verification, or manual lookup endpoints or UIs exist on the platform.

---

## Loophole U — Category deletion leaves broken events

**Fix:** Referential integrity and controlled deactivation/reassignment.

---

## Loophole V — Expired advertisement remains publicly visible

**Fix:** Backend eligibility + targeted cache invalidation.

---

# 154. Admin Mutation Architecture

All important mutations follow:

```text
Admin Browser
     ↓
Authenticated API
     ↓
Authentication verification
     ↓
Role authorization
     ↓
Organization/resource authorization
     ↓
Business validation
     ↓
PostgreSQL transaction
     ↓
Database constraints
     ↓
Outbox event
     ↓
Commit
     ↓
Cache invalidation / side effects
     ↓
Response
```

External services must not be called inside critical database transactions where the architecture specifies the Outbox Pattern.

---

# 155. Student Website Boundary

The Admin Website controls public event configuration.

The Student Website consumes the resulting public representation.

```text
Admin Website
      ↓
Backend
      ↓
PostgreSQL
      ↓
Outbox / cache invalidation
      ↓
Public cache
      ↓
Student Website
```

The Student Website cannot modify the event.

---

# 156. Final Product Boundary

The complete current flow is:

```text
                   ┌─────────────────────┐
                   │   ADMIN WEBSITE     │
                   │                     │
                   │ Email → OTP         │
                   │ Organizer           │
                   │ Super Admin         │
                   └──────────┬──────────┘
                              │
                              ▼
                    Backend / PostgreSQL
                              │
                              ▼
                    Public Event Data
                              │
                              ▼
                   ┌─────────────────────┐
                   │  STUDENT WEBSITE    │
                   │                     │
                   │ Discover Events     │
                   │ View Event          │
                   │ Search / Filter     │
                   └──────────┬──────────┘
                              │
                              ▼
                   External Registration
                              │
                              ▼
                    Organizer Platform
```

---

# 157. Explicitly Out of Scope

The current Admin Website does not include:

```text
Password authentication
Google authentication
Student accounts
Student login
Internal student registration
Internal ticket checkout
Internal ticket reservation
Internal seat selection
Internal payment processing
Internal refund processing
Fake booking records
Fake payment records
Fake ticket records
```

unless a future approved product specification explicitly changes the architecture.

---

# 158. Definition of Done

The Admin Website is complete only when:

## Authentication

* [ ] Email OTP login works.
* [ ] OTP is stored only as a hash.
* [ ] OTP expiration works.
* [ ] OTP replay protection works.
* [ ] OTP rate limiting works.
* [ ] OTP verification attempt protection works.
* [ ] No password authentication exists.
* [ ] No password database fields exist.
* [ ] No password reset workflow exists.
* [ ] No Google Sign-In exists.
* [ ] Logout works.
* [ ] Session expiration works.

## Authorization

* [ ] Super Admin authorization works.
* [ ] Organizer authorization works.
* [ ] Organization ownership is enforced.
* [ ] Unauthorized routes are blocked.
* [ ] Backend authorization is enforced independently of frontend guards.

## Events

* [ ] Event creation works.
* [ ] Event editing works.
* [ ] Event lifecycle works.
* [ ] Event approval works.
* [ ] Event rejection works.
* [ ] Event cancellation works.
* [ ] Event completion works.
* [ ] Stable event IDs are maintained.
* [ ] Capacity configuration works.
* [ ] Capacity Counts By locking works.
* [ ] Team registration works.
* [ ] Fixed Team Price works.
* [ ] Per Member Price works.
* [ ] External registration URL works.

## Content

* [ ] Advertisements work.
* [ ] Advertisement scheduling works.
* [ ] Advertisement positions work.
* [ ] Advertisement analytics work where configured.
* [ ] Carousel management works.
* [ ] Categories work.
* [ ] Subcategories work.
* [ ] Sponsors work.
* [ ] Event Memories work.

## Operations

* [ ] Operations Console contains only supported operational features.
* [ ] Audit logs work.
* [ ] System health works.
* [ ] Failed email monitoring works where deployed.
* [ ] Failed webhook monitoring works where deployed.
* [ ] Queue monitoring works where deployed.

## Architecture

* [ ] Cache invalidation works.
* [ ] Resource versions update correctly.
* [ ] Outbox events are generated.
* [ ] Public and private cache boundaries are maintained.
* [ ] Concurrent modifications are handled.
* [ ] Duplicate mutations are protected.

## UX

* [ ] Loading states exist.
* [ ] Empty states exist.
* [ ] Error states exist.
* [ ] Destructive confirmations exist.
* [ ] Responsive behavior works.
* [ ] Keyboard navigation works.
* [ ] Accessibility requirements are met.

---

# 159. Manual Verification Requirements

After implementation, manually verify:

## Authentication

1. Enter valid email.
2. Receive OTP.
3. Enter valid OTP.
4. Confirm successful login.
5. Enter invalid OTP.
6. Confirm rejection.
7. Reuse a successful OTP.
8. Confirm rejection.
9. Wait for OTP expiry.
10. Confirm rejection.
11. Trigger OTP rate limits.
12. Confirm protection.
13. Verify there is no password field.
14. Verify there is no Google Sign-In.
15. Logout.
16. Verify protected routes are inaccessible.
17. Verify expired sessions redirect correctly.

---

## Organizer Authorization

Verify:

1. Organizer can access their organization.
2. Organizer can create an event.
3. Organizer can edit their event.
4. Organizer cannot access another organization's event.
5. Organizer cannot approve an event.
6. Organizer cannot access Super Admin routes.
7. Organizer cannot modify `Capacity Counts By` after approval submission.
8. Organizer cannot manipulate organization IDs to access another organization.

---

## Super Admin

Verify:

1. Super Admin can review access requests.
2. Super Admin can approve/reject requests.
3. Super Admin can review events.
4. Super Admin can approve events.
5. Super Admin can reject events.
6. Super Admin can manage advertisements.
7. Super Admin can manage carousel.
8. Super Admin can manage categories.
9. Super Admin can manage sponsors.
10. Super Admin can manage memories.
11. Super Admin can access audit logs.
12. Super Admin can access system health.

---

## Event Lifecycle

Verify:

```text
Create
  ↓
Submit
  ↓
Pending Approval
  ↓
Approve
  ↓
Published
  ↓
Completed
```

Also:

```text
Pending Approval
  ↓
Reject
```

and:

```text
Published
  ↓
Cancel
```

Only valid backend transitions must succeed.

---

## Concurrency

Test:

* Two Admins editing the same event.
* Two Super Admins approving the same event.
* One Admin approving while another rejects.
* Organizer editing while Super Admin reviews.
* Advertisement update during expiry.

No silent overwrite is acceptable.

---

## External Registration

Verify:

* Correct URL is stored.
* Correct URL reaches the Student Website.
* Clicking registration opens the external destination.
* Missing URL does not create a broken button.
* No internal payment page appears.
* No internal ticket checkout appears.

---

## Security

Verify:

* No service-role key in frontend bundle.
* No R2 secret in frontend bundle.
* No email provider secret in frontend bundle.
* No payment provider secret in frontend bundle.
* Organizer cannot call Super Admin operations.
* Organizer cannot change ownership.
* Organizer cannot bypass lifecycle restrictions.
* Admin responses are not publicly cached.
* Audit logs cannot be edited from the UI.

---

# 160. Final Non-Negotiable Rules

1. The Admin Website is separate from the Student Website.
2. Admin authentication is **email OTP only**.
3. Password authentication does not exist.
4. Google Sign-In does not exist.
5. Social login does not exist.
6. OTPs are never stored in plaintext.
7. OTP verification is rate limited.
8. OTPs are single-use.
9. Authentication and authorization are separate.
10. Backend authorization is authoritative.
11. Organizer access is organization-scoped.
12. Super Admin has platform-level authority where explicitly permitted.
13. Events use one authoritative `events` table.
14. Event IDs remain stable.
15. Event lifecycle transitions are backend-controlled.
16. `Capacity Counts By` becomes immutable after approval submission.
17. No fake internal payment or ticket workflow should be implemented.
18. All important mutations must go through controlled backend operations.
19. Cache invalidation, resource versions, outbox, and audit behavior are part of the UI contract.

---

# 161. Status

**ADMIN_UI_SPEC.md is the canonical UI/UX baseline for the LPU Events Admin Website.**

Any future administrative UI implementation must conform to this specification.
