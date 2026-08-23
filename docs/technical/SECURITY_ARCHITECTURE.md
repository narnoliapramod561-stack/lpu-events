# LPU Events — Security Architecture

**File:** `docs/technical/SECURITY_ARCHITECTURE.md`  
**Status:** LOCKED — Security Baseline  
**Version:** 1.0  
**Date:** 14 August 2026

---

# 1. Purpose

This document defines the security architecture for the LPU Events platform.

It establishes security requirements for:

- Authentication.
- Authorization.
- PostgreSQL Row Level Security.
- Supabase Auth.
- Edge Functions.
- PostgreSQL RPCs.
- Cloudflare.
- Cloudflare R2.
- API access.
- Media uploads.
- Rate limiting.
- Audit logging.
- Secrets.
- Sessions.
- Caching.
- Background jobs.
- Database operations.
- Administrative actions.
- Monitoring.
- Incident response.

Security is enforced as a layered system.

No single security mechanism is considered sufficient by itself.

---

# 2. Security Objectives

The platform must guarantee, as far as technically practical:

1. Anonymous students cannot modify platform data.
2. Unauthenticated users cannot access Admin functionality.
3. Authenticated users do not automatically become administrators.
4. Organizers cannot access another organization's data.
5. Organizers cannot escalate themselves to Super Admin.
6. Super Admin operations require explicit authorization.
7. Client-side validation is never treated as a security boundary.
8. Sensitive database operations cannot be performed through unrestricted client queries.
9. Privileged secrets never reach browsers.
10. Public APIs expose only intentionally public fields.
11. Audit records cannot be modified by normal administrators.
12. External registration URLs cannot be used to execute arbitrary application behavior.
13. Media uploads cannot be used to gain unauthorized storage access.
14. Cache contents cannot bypass authorization.
15. Background workers cannot be triggered as arbitrary privileged database operations.
16. Security failures fail closed rather than granting access.

---

# 3. Security Principles

The platform follows:

- Zero-trust authorization.
- Least privilege.
- Defense in depth.
- Deny by default.
- Explicit authorization.
- Server-side validation.
- Database-enforced invariants.
- Short-lived credentials where possible.
- Separation of public and private data.
- Immutable auditability.
- Idempotent privileged operations.
- Fail-closed security behavior.
- Minimal data collection.
- Minimal infrastructure.

---

# 4. Trust Boundaries

The major trust boundaries are:

```text
Internet
   │
   ▼
Cloudflare
   │
   ├───────────────┐
   ▼               ▼
Student Web     Admin Web
   │               │
   └───────┬───────┘
           ▼
      Supabase API
           │
      ┌────┴────┐
      ▼         ▼
 PostgreSQL   Edge Functions
      │         │
      └────┬────┘
           ▼
        R2 / PostHog
````

Every boundary must assume the upstream component can be manipulated.

---

# 5. Security Classification

## Public

Examples:

* Published event information.
* Public categories.
* Public subcategories.
* Public advertisements.
* Public carousel content.
* Public sponsor information.
* Public Event Memories.

## Internal

Examples:

* Organizer identities.
* Organization membership.
* Operational configuration.
* Resource versions.
* Aggregated internal analytics.

## Sensitive

Examples:

* Supabase Auth identity information.
* Access requests.
* Audit logs.
* Administrative metadata.
* Internal media metadata.
* Background-job information.

## Secret

Examples:

* Supabase service-role key.
* R2 secret access credentials.
* Deployment secrets.
* API secrets.
* Encryption keys.

Secrets must never be exposed to the browser.

---

# 6. Application Separation

There are two applications:

```text
Student Website
Admin Website
```

They are separate security domains.

The Student Website must never inherit Admin Website privileges.

The Admin Website must not expose privileged functionality through the Student Website.

---

# 7. Student Website Security Model

The Student Website is anonymous.

There is no student authentication.

There are no student accounts.

There are no student sessions.

There are no student-owned database records.

The Student Website is therefore treated as an untrusted public client.

---

# 8. Student Website Allowed Operations

The Student Website may:

* Read published public events.
* Search public events.
* Read public taxonomy.
* Read public advertisements.
* Read public carousel content.
* Read public memories.
* Read public sponsor information.
* Record anonymous/pseudonymous analytics.
* Open external registration URLs.

The Student Website must not directly perform administrative mutations.

---

# 9. Student Website Database Access

Prefer exposing public data through intentionally designed:

* Public-safe views.
* Read-only RPCs.
* Carefully scoped Supabase REST endpoints.

Do not expose the entire underlying table structure merely because a table contains some public columns.

---

# 10. Public Data Projection

For public event reads, expose only fields required by the Student Website.

Example:

```text
public_event
├── id
├── name
├── description
├── category
├── subcategory
├── banner
├── start_at
├── end_at
├── venue
├── registration_mode
├── external_registration_url
├── pricing_type
└── public content
```

Do not expose:

* `created_by`.
* `updated_by`.
* Internal organization identifiers where unnecessary.
* Audit information.
* Internal media metadata.
* Operational fields.
* Internal moderation/security information.

---

# 11. Admin Authentication

Admin authentication is handled by Supabase Auth.

The only supported authentication mechanism is:

**Email OTP.**

Explicitly unsupported:

* Google Sign-In.
* Password authentication.
* Mobile OTP.
* Social login.
* Anonymous Admin sessions.

---

# 12. Email OTP Security

OTP values must never be stored by the application in plaintext.

Supabase Auth manages the OTP lifecycle.

Application-level OTP storage is prohibited unless explicitly required by a future architecture.

If custom OTP functionality is ever introduced, OTPs must be stored only as cryptographic hashes.

---

# 13. OTP Abuse Protection

Authentication endpoints must be protected against:

* Brute force.
* Enumeration.
* Repeated OTP requests.
* Automated account creation.
* Request flooding.

Controls include:

* Supabase Auth rate limiting.
* Cloudflare rate limiting where appropriate.
* Turnstile for suspicious/high-risk flows.
* Short OTP lifetime.
* Maximum verification attempts.
* Temporary throttling.
* Monitoring.

---

# 14. Email Enumeration Protection

The system should avoid revealing whether a particular email address is an approved administrator.

Responses should not unnecessarily disclose:

```text
"this email is an administrator"
```

or:

```text
"this email does not exist"
```

Use generic authentication responses where practical.

---

# 15. Authentication vs Authorization

Authentication answers:

> Who are you?

Authorization answers:

> What are you allowed to do?

A successful Supabase login does not grant Admin access.

The authorization chain is:

```text
Supabase Auth
      ↓
admin_users
      ↓
active authorization
      ↓
role
      ↓
permission
      ↓
operation
```

---

# 16. Admin Authorization

Supported roles:

```text
ORGANIZER
SUPER_ADMIN
```

Roles are server-controlled.

The client cannot:

* Assign itself a role.
* Change its role.
* Change its organization.
* Add itself to an organization.
* Create itself as Super Admin.

---

# 17. Organizer Authorization

Organizer access is based on active organization membership.

The organizer can access:

```text
organization
       ↓
owned events
       ↓
owned event content
```

The organizer cannot access another organization's events merely by changing an ID in the request.

---

# 18. Super Admin Authorization

Super Admin is a platform-level authorization.

Super Admin permissions are stored separately from organization membership.

The system must never determine Super Admin status from:

* Frontend state.
* Email address supplied by the browser.
* Local storage.
* URL parameters.
* JWT claims that the client can influence.

Authorization must be verified server-side.

---

# 19. Single Super Admin Constraint

The current product requires a single Super Admin.

The database must enforce this invariant.

The application must not assume that:

```text
there is only one Super Admin
```

without database enforcement.

Any future multi-Super-Admin requirement requires an explicit architecture change.

---

# 20. RLS Baseline

Row Level Security is mandatory on all application tables containing protected data.

Default principle:

```text
NO POLICY
   ↓
NO ACCESS
```

Do not enable RLS and then create broad:

```sql
USING (true)
```

policies on sensitive tables.

---

# 21. RLS Responsibilities

RLS protects against direct database/API access.

Application-level authorization provides additional validation.

The architecture intentionally uses:

```text
RLS
+
Backend authorization
+
Database constraints
```

This is defense in depth.

---

# 22. Public RLS

Public data should have explicit SELECT policies.

Example concept:

```text
Published event
    ↓
Anonymous SELECT
```

But:

```text
Draft/private/admin data
    ↓
Anonymous SELECT
    ↓
DENIED
```

---

# 23. Organizer RLS

Organizer policies must verify:

1. Authenticated identity.
2. Active admin record.
3. Active organizer membership.
4. Correct organization ownership.
5. Appropriate operation.

Do not rely on a request payload containing the correct organization ID.

---

# 24. Super Admin RLS

Super Admin policies must verify a trusted database-side authorization relationship.

Do not use:

```sql
auth.jwt() ->> 'role'
```

as the sole source of authorization unless that claim is issued and controlled exclusively by the trusted authorization system.

Prefer server/database authorization records.

---

# 25. RLS Function Security

Helper functions used by RLS must be carefully designed.

If a function uses:

```text
SECURITY DEFINER
```

it must:

* Be owned by a trusted role.
* Have a fixed `search_path`.
* Explicitly qualify objects.
* Avoid dynamic SQL where unnecessary.
* Expose only the minimum required information.
* Be inaccessible to unauthorized roles.

---

# 26. `SECURITY DEFINER` Hardening

Security-definer functions must not use an unsafe search path such as an attacker-controlled schema.

Use an explicit safe search path.

Example principle:

```sql
SET search_path = pg_catalog, public;
```

and schema-qualify important references.

---

# 27. Function Privileges

RPC functions are not automatically public.

Each RPC must explicitly define:

* Who can execute it.
* What it validates.
* What tables it can mutate.
* What it returns.

Sensitive functions must have `EXECUTE` revoked from roles that do not need them.

---

# 28. Privileged RPC Rule

Every privileged RPC follows:

```text
Authenticate
    ↓
Authorize
    ↓
Validate input
    ↓
Validate state
    ↓
Perform transaction
    ↓
Write audit
    ↓
Write outbox
    ↓
Update resource version
    ↓
Commit
```

The client cannot skip any of these steps.

---

# 29. Event Publishing Security

Publishing an event requires:

* Valid authenticated admin.
* Active organizer membership.
* Organization ownership.
* Valid event fields.
* Valid taxonomy.
* Valid date/time.
* Valid registration configuration.
* Valid media references.
* Allowed content.
* Database constraints.

Only after all checks pass may the event become `PUBLISHED`.

---

# 30. Event Ownership Attack

Attack:

```text
Organizer A
POST /events
organization_id = Organization B
```

Protection:

* Organization ownership is derived server-side.
* RLS checks membership.
* Backend ignores untrusted ownership claims.
* Database foreign keys maintain integrity.

Result:

```text
DENIED
```

---

# 31. Event Update Attack

Attack:

```text
Organizer A
PUT /events/B
```

Protection:

* Event B ownership checked.
* Organization membership checked.
* RLS checked.

Result:

```text
DENIED
```

---

# 32. Event Deletion Attack

Cancellation is a privileged operation.

Before deletion:

* Verify role.
* Verify event ownership.
* Verify event state.
* Write audit record.
* Prepare dependent cleanup.
* Delete transactionally.

An organizer cannot delete another organization's event.

---

# 33. Event Lifecycle Tampering

The client must not directly set:

```text
status = COMPLETED
```

or manipulate lifecycle fields arbitrarily.

Lifecycle transitions are controlled by server-side functions/jobs.

The database should reject invalid state transitions.

---

# 34. Event Completion Security

The scheduled completion job is trusted infrastructure.

It must:

* Process only eligible events.
* Use bounded batches.
* Be idempotent.
* Update only appropriate records.
* Create required outbox/cache work.

A normal browser user cannot invoke the job with arbitrary parameters.

---

# 35. External Registration URL Security

The external registration URL is organizer-provided.

However, the platform must still protect itself from dangerous schemes.

Allowed:

```text
https://...
```

Potentially allowed if explicitly required:

```text
http://...
```

Not allowed:

```text
javascript:
data:
vbscript:
file:
```

The production policy should prefer HTTPS.

---

# 36. External URL Trust Boundary

LPU Events does not guarantee the external destination is legitimate.

The platform's responsibility is to:

* Validate the URL syntax.
* Reject dangerous schemes.
* Render the destination safely.
* Clearly indicate external navigation.

The organizer remains responsible for the destination's correctness.

---

# 37. Open Redirect Consideration

The platform must not create an endpoint like:

```text
/go?url=<arbitrary-url>
```

without strict validation.

Prefer storing the approved URL and navigating directly to it.

If click tracking requires an intermediate endpoint, the destination must be resolved from an authenticated/validated advertisement or event record rather than accepting an arbitrary URL from the browser.

---

# 38. Advertisement URL Security

Advertisement redirects require the same scheme validation.

The client must not be allowed to modify the redirect destination through query parameters.

The destination comes from the advertisement record.

---

# 39. XSS Protection

User-controlled content includes:

* Event descriptions.
* Dynamic content sections.
* Organization names.
* Advertisement names.
* Memory descriptions.
* Sponsor names.

Content must be safely rendered.

Do not inject arbitrary HTML using:

```text
dangerouslySetInnerHTML
```

unless the content has been sanitized using a trusted, explicitly defined sanitization pipeline.

---

# 40. Rich Text Security

If rich text is supported:

1. Define an allowlist of HTML/formatting elements.
2. Sanitize server-side.
3. Sanitize again at rendering boundary if necessary.
4. Remove scripts.
5. Remove event-handler attributes.
6. Remove dangerous URLs.
7. Prevent iframe/script injection unless explicitly required.

---

# 41. CSP

Production websites should use a restrictive Content Security Policy.

The CSP must restrict:

* Script sources.
* Image sources.
* Connect sources.
* Frame sources.
* Font sources.
* Style sources.

Required third-party services such as Supabase and PostHog must be explicitly allowlisted.

Avoid:

```text
script-src *
```

or similarly broad policies.

---

# 42. Clickjacking Protection

Admin pages must not be embeddable by arbitrary third-party websites.

Use:

```text
X-Frame-Options: DENY
```

and/or appropriate CSP `frame-ancestors`.

---

# 43. CSRF

Because the Admin Website uses token-based Supabase authentication, CSRF risk differs from cookie-only authentication.

Nevertheless:

* Do not introduce unnecessary authentication cookies.
* Do not create state-changing GET endpoints.
* State-changing operations must use appropriate authenticated requests.
* If cookie-based authentication is introduced later, explicit CSRF protection becomes mandatory.

---

# 44. XSS and Token Theft

Even if access tokens are handled by Supabase, XSS can compromise authenticated sessions.

Therefore:

* Avoid unsafe HTML.
* Apply CSP.
* Validate input.
* Sanitize rich content.
* Avoid arbitrary third-party scripts.
* Keep dependencies updated.

---

# 45. Session Security

Admin sessions must:

* Use Supabase's supported session mechanism.
* Be refreshed through the supported client SDK.
* Be invalidated when the user is disabled.
* Not be copied into application database tables unnecessarily.
* Not be placed into URLs.
* Not be logged.

---

# 46. Logout

Logout must invalidate the local authenticated session through Supabase Auth.

High-risk account disablement must also prevent further authorized API operations through authorization checks.

---

# 47. Disabled Admin

Setting:

```text
admin_users.is_active = false
```

must immediately prevent administrative operations.

Authorization must check active status at the authorization boundary.

Do not rely on the user closing their browser.

---

# 48. Organization Membership Revocation

If an organizer loses organization membership:

```text
is_active = false
```

their ability to manage that organization's events must stop.

Existing sessions must not bypass the authorization check.

---

# 49. Access Request Security

Access requests can be created only for authenticated Admin Website identities.

A user cannot:

* Approve their own request.
* Change their request status.
* Assign themselves an organization.
* Assign themselves Super Admin.
* Modify another user's request.

Only authorized Super Admin operations may approve/reject requests.

---

# 50. Approval Transaction

Approving an access request must be atomic.

Conceptually:

```text
Verify Super Admin
      ↓
Lock access request
      ↓
Verify still PENDING
      ↓
Create/find organization
      ↓
Create organization membership
      ↓
Mark request APPROVED
      ↓
Audit
      ↓
Outbox
      ↓
COMMIT
```

If any step fails:

```text
ROLLBACK
```

---

# 51. Concurrent Approval Protection

Two concurrent Super Admin requests/processes must not approve the same pending request twice.

Use:

* Row locking.
* State verification.
* Transactional update.

The transition must be:

```text
PENDING → APPROVED
```

only once.

---

# 52. Race Conditions

Security-sensitive mutations must consider concurrent requests.

Examples:

* Event cancellation + event editing.
* Organizer membership revocation + event editing.
* Access request approval + rejection.
* Advertisement disable + cache generation.
* Media deletion + content update.

Use transactions and appropriate row locking/state checks.

---

# 53. TOCTOU Protection

Do not perform:

```text
Check authorization
    ↓
Wait
    ↓
Perform mutation
```

as two unrelated operations.

Authorization and mutation must occur within the same trusted transactional boundary wherever the state can change between checks.

---

# 54. Idempotency

Critical administrative operations should be designed to tolerate retries.

Examples:

* Publish request retry.
* Cancellation retry.
* Access-request approval retry.
* Media finalization retry.
* Outbox processing retry.

A network timeout must not result in duplicate business operations.

---

# 55. Replay Protection

A previously valid privileged request must not be replayable in a way that causes unintended repeated state changes.

Use:

* State-transition checks.
* Idempotency keys where appropriate.
* Unique constraints.
* Server-side timestamps/state.

---

# 56. API Input Validation

Every API/RPC input must be validated server-side.

Validation includes:

* Type.
* Length.
* Format.
* Allowed enum.
* Range.
* Required fields.
* Cross-field relationships.
* Authorization context.

Never trust TypeScript types as runtime security.

---

# 57. Mass Assignment Protection

Do not accept arbitrary objects and update the database directly.

Dangerous pattern:

```text
UPDATE events SET <all client fields>
```

Instead, each operation should explicitly control allowed fields.

A client must not be able to submit:

```text
created_by
organization_id
status
completed_at
```

unless that operation explicitly permits those fields.

---

# 58. SQL Injection

All database operations must use:

* Parameterized queries.
* Supabase RPC parameters.
* Safe query builders.

Never concatenate untrusted input into SQL.

Dynamic SQL inside `SECURITY DEFINER` functions is prohibited unless strictly necessary and safely parameterized.

---

# 59. Search Security

Search queries are user-controlled.

Search must:

* Use parameterized queries.
* Have reasonable length limits.
* Reject pathological input.
* Use indexed search.
* Apply rate limits where abuse is detected.

Search must not expose private records.

---

# 60. Rate Limiting

Rate limiting must exist at multiple layers where appropriate:

```text
Cloudflare
    ↓
Supabase/API
    ↓
Application logic
    ↓
Database safeguards
```

High-risk operations receive stricter limits.

Examples:

* OTP requests.
* OTP verification.
* Admin login attempts.
* Access request creation.
* Media uploads.
* Search abuse.
* Administrative mutations.

---

# 61. Turnstile

Cloudflare Turnstile may be required for suspicious/high-risk authentication or abuse-sensitive flows.

It must not become an unnecessary requirement for ordinary public event browsing.

The exact endpoints are configured based on observed abuse risk.

---

# 62. Bot Protection

Public browsing should remain accessible to legitimate students.

Bot protection should primarily target:

* Authentication abuse.
* Scraping at abusive rates.
* Automated mutation attempts.
* Credential/OTP abuse.

Do not indiscriminately block all automated clients from public event pages if legitimate indexing/access is required.

---

# 63. R2 Upload Security

Browsers must not receive permanent R2 secret credentials.

Upload flow:

```text
Admin
   ↓
Authenticated request
   ↓
Authorization check
   ↓
Validate file metadata
   ↓
Issue restricted upload authorization
   ↓
R2
   ↓
Verify object
   ↓
Mark media READY
```

---

# 64. Upload Restrictions

Uploads must enforce:

* Maximum file size.
* Allowed MIME types.
* Allowed file extensions.
* Maximum dimensions.
* Image decoding validation where applicable.
* Object-key restrictions.

Do not trust only the filename extension.

---

# 65. Content-Type Validation

The declared browser MIME type is not sufficient.

The backend/storage processing pipeline should verify that the uploaded object matches the expected content type where practical.

---

# 66. File Name Security

Original user-provided filenames must not become unrestricted R2 object keys.

Generate server-controlled object keys.

Example:

```text
media/{uuid}/original
```

or equivalent.

This prevents:

* Path manipulation.
* Object collisions.
* Predictable naming.
* Unauthorized overwrite.

---

# 67. R2 Bucket Separation

Production should separate:

* Public media.
* Private operational objects.
* Backups.
* Archives.

Do not place backups in the same public bucket as event images.

---

# 68. Private R2 Objects

Backup and internal archive objects must not be publicly accessible.

Access should occur through controlled backend/infrastructure credentials.

---

# 69. Media Ownership

An Organizer may upload media only for resources they are authorized to modify.

An uploaded object must not automatically grant ownership of another organization's content.

The media metadata record must preserve creator/ownership context.

---

# 70. Orphan Media

Uploads can succeed while the database transaction fails.

Therefore:

```text
R2 object exists
+
No READY database reference
```

must eventually trigger cleanup.

Use a safety period before deletion to avoid deleting objects during legitimate retry flows.

---

# 71. Media Deletion Race

A cleanup worker must verify that an object is still unreferenced before deletion.

Flow:

```text
Candidate object
      ↓
Check references
      ↓
Still unreferenced?
      ├── NO → keep
      └── YES → delete
```

Never trust a stale cleanup list blindly.

---

# 72. Secrets Management

Secrets must exist only in:

* Local ignored environment files.
* Cloudflare/Supabase secret stores.
* GitHub Actions secrets.
* R2 secret management.
* Other approved secret-management infrastructure.

Never in:

* Git.
* Source code.
* Database rows.
* Logs.
* Client bundles.
* URLs.

---

# 73. Service Role Key

The Supabase service-role key bypasses normal RLS protections.

Therefore:

**It must never be exposed to the browser.**

It may only be used by trusted server-side infrastructure.

---

# 74. Privileged Service Boundary

Server-side code using the service-role key must still perform explicit authorization.

The service-role key is an infrastructure privilege, not a substitute for application authorization.

A dangerous pattern is:

```text
Authenticated user
     ↓
Edge Function
     ↓
service-role query
     ↓
No authorization
```

This is prohibited.

---

# 75. Edge Function Security

Every protected Edge Function must:

1. Validate authentication.
2. Validate authorization.
3. Validate input.
4. Execute only the intended operation.
5. Return only intended data.
6. Avoid leaking internal errors.

Do not create generic database proxy functions.

---

# 76. Generic RPC/Proxy Prohibition

Avoid endpoints such as:

```text
/query
```

where the client submits arbitrary SQL-like instructions or arbitrary table names.

APIs must represent business operations, not expose the database as a generic proxy.

---

# 77. Error Handling

Errors must not reveal:

* Database passwords.
* Service keys.
* SQL statements.
* Internal stack traces.
* Private database structure.
* Internal file paths.

Clients receive stable error codes.

Detailed errors are logged securely server-side.

---

# 78. Logging

Security-relevant events should be logged.

Examples:

* Authentication failures.
* OTP abuse.
* Authorization failures.
* Access request changes.
* Event ownership violations.
* Privileged mutations.
* Suspicious upload activity.
* Rate-limit violations.
* R2 failures.
* Background-job failures.

---

# 79. Log Privacy

Logs must not contain:

* OTP codes.
* Access tokens.
* Refresh tokens.
* Passwords.
* Service keys.
* Full secrets.

Email addresses should be minimized or masked where full identity is not necessary.

---

# 80. Audit vs Logs

These are separate concepts.

### Audit logs

Authoritative record of administrative business actions.

### Application/security logs

Operational diagnostics and security monitoring.

Do not treat ordinary application logs as the authoritative audit trail.

---

# 81. Audit Integrity

Normal administrators must not be able to:

* Edit audit records.
* Delete audit records.
* Rewrite actor identity.
* Rewrite timestamps.

Audit insertion should occur through trusted server/database operations.

---

# 82. Audit Actor Integrity

The actor ID must come from the authenticated security context.

Never accept:

```text
actor_id
```

as a trusted client parameter.

---

# 83. Cache Security

Authorization-sensitive data must never enter a public cache.

Examples:

```text
Organizer dashboard
Super Admin dashboard
Access requests
Audit logs
Private operational information
```

must not use public CDN caching.

---

# 84. Cache Key Isolation

Public cache keys must not depend on arbitrary client-controlled authorization parameters.

A cache key such as:

```text
/event?id=123
```

is acceptable for public event data.

A shared cache must never return:

```text
Organizer A's private data
```

to:

```text
Organizer B
```

---

# 85. Cache Invalidation Security

Only trusted server-side operations may invalidate or regenerate protected cache entries.

A browser must not be able to request:

```text
invalidate_all_cache
```

or equivalent privileged functionality.

---

# 86. Cache Poisoning

Cache entries must be generated from validated server-side data.

Do not construct cacheable HTML/data directly from unvalidated query parameters.

---

# 87. Public Cache Rule

Only explicitly public resources may be publicly cached.

If uncertain:

```text
DO NOT PUBLICLY CACHE
```

---

# 88. Resource Version Security

Resource versions are public synchronization metadata where required.

Clients may read versions.

Clients cannot:

* Set versions.
* Decrease versions.
* Increment versions arbitrarily.

Version updates occur transactionally with trusted mutations.

---

# 89. Outbox Security

The outbox is an internal mechanism.

Clients must not:

* Insert arbitrary outbox events.
* Modify event payloads.
* Mark events processed.
* Retry privileged jobs manually.

Outbox insertion occurs through trusted transactional operations.

---

# 90. Outbox Payload Security

Outbox payloads must not contain:

* Access tokens.
* Passwords.
* OTPs.
* Service secrets.

Only information required by the worker should be included.

---

# 91. Background Job Security

Workers are trusted infrastructure.

Job execution must:

* Validate job type.
* Validate payload.
* Use bounded batches.
* Be idempotent.
* Prevent arbitrary job execution from clients.

A browser must never be able to submit:

```text
job_type = "delete_everything"
```

or similar arbitrary commands.

---

# 92. Database Privileges

Database roles should follow least privilege.

Application clients should not have unrestricted:

* DDL.
* Schema modification.
* Role modification.
* Extension installation.

Production schema changes occur through controlled migrations.

---

# 93. Migration Security

Migrations must be reviewed as security-sensitive code.

A migration can:

* Disable RLS.
* Grant privileges.
* Create unsafe functions.
* Expose data.
* Break constraints.

Therefore migrations require the same review discipline as application code.

---

# 94. Dangerous Database Defaults

Avoid:

```text
public INSERT
public UPDATE
public DELETE
```

on protected tables.

Avoid:

```sql
GRANT ALL ON ...
```

unless explicitly justified.

---

# 95. Public Views

If public views are used, ensure they do not accidentally inherit privileged information.

A public view should expose only intentional columns.

Do not create:

```text
SELECT *
```

public views for large administrative tables.

---

# 96. Search and Enumeration Protection

Public event IDs may be UUIDs, reducing simple enumeration.

However, UUIDs are not authorization.

Private resources must still require authorization.

Never treat an unpredictable ID as a security boundary.

---

# 97. IDOR/BOLA Defense

Every protected resource request must verify:

```text
authenticated user
+
required role
+
resource ownership/scope
```

before returning or modifying the resource.

---

# 98. Organization IDOR

An organizer cannot access another organization by changing:

```text
organization_id
```

in:

* URL.
* JSON.
* Query parameters.
* Headers.
* Local storage.

Authorization derives from server-side membership.

---

# 99. Event IDOR

An event UUID does not grant access.

Protected event operations verify ownership.

Public event reads are intentionally public only when the event is eligible for public display.

---

# 100. Mass Data Extraction

Admin endpoints must use pagination and bounded result sets.

Do not allow:

```text
?limit=100000000
```

to become an expensive database operation.

Server-side maximum limits are mandatory.

---

# 101. Query Abuse

Expensive search/filter combinations must be:

* Indexed.
* Bounded.
* Rate limited if abused.
* Monitored.

The browser must not be able to force arbitrary expensive database queries.

---

# 102. Pagination

Prefer cursor/keyset pagination for large administrative datasets.

Offset pagination may be acceptable for small bounded lists.

Do not expose unlimited result sets.

---

# 103. External Link Safety

External registration and advertisement links must:

* Use safe URL schemes.
* Open externally where appropriate.
* Use secure browser navigation patterns.
* Never execute arbitrary JavaScript.

When opening a new tab/window, use appropriate `noopener` protections.

---

# 104. Dependency Security

Dependencies must be:

* Version controlled.
* Audited.
* Updated regularly.
* Removed when unnecessary.

Do not add large dependencies for trivial functionality.

---

# 105. Supply Chain Security

CI should use:

* Lockfiles.
* Dependency vulnerability scanning.
* Pinned/controlled CI actions where practical.
* Protected deployment secrets.

Do not execute arbitrary downloaded scripts in CI without review.

---

# 106. Git Security

Never commit:

```text
.env
.env.local
service-role keys
R2 credentials
deployment secrets
database dumps containing sensitive information
```

Use `.gitignore` and CI secret scanning.

---

# 107. Environment Isolation

Development, staging, and production must use separate:

* Supabase projects.
* R2 buckets.
* Credentials.
* Analytics environments where appropriate.
* Deployment secrets.

Development must never connect to production databases.

---

# 108. Production Data Protection

Production data must never be copied into local development environments without explicit anonymization and authorization.

Seed data must be synthetic.

---

# 109. Backup Security

Backups must be:

* Encrypted.
* Private.
* Access controlled.
* Integrity checked.
* Retained according to policy.

A backup bucket must not be publicly readable.

---

# 110. Backup Restore Security

Restoration must occur into an isolated environment first when practical.

Do not overwrite production immediately during a restore test.

---

# 111. Disaster Recovery Security

Recovery procedures must preserve:

* RLS.
* Privileges.
* Secrets separation.
* Audit integrity.
* Environment boundaries.

A restored database must be security-tested before being considered production-ready.

---

# 112. Security Monitoring

Monitor at minimum:

* Repeated OTP failures.
* Excessive OTP requests.
* Authorization failures.
* Repeated denied organizer access.
* Suspicious media uploads.
* Rate-limit violations.
* Failed privileged operations.
* Repeated RPC failures.
* Outbox failures.
* Backup failures.
* Database/RLS anomalies.

---

# 113. Alert Severity

### Critical

* Privilege escalation.
* Unauthorized Super Admin creation.
* RLS bypass indication.
* Service-role credential exposure.
* Production secret exposure.
* Unexpected mass deletion.

### High

* Repeated authorization bypass attempts.
* Large-scale upload abuse.
* Persistent authentication abuse.
* Backup failures.

### Medium

* Repeated individual authorization failures.
* Outbox failures.
* Cache regeneration failures.

---

# 114. Incident Response

Security incidents follow:

```text
Detect
  ↓
Contain
  ↓
Investigate
  ↓
Remediate
  ↓
Recover
  ↓
Review
```

Security incidents must not be silently fixed without preserving enough evidence for investigation.

---

# 115. Credential Compromise

If a secret is exposed:

1. Revoke/rotate it immediately.
2. Determine where it was exposed.
3. Search logs/repository history where appropriate.
4. Assess access.
5. Rotate dependent credentials.
6. Record the incident.
7. Deploy corrected configuration.

Deleting the secret from the current file is not sufficient if it was committed to Git.

---

# 116. Super Admin Compromise

Because Super Admin has platform-wide authority:

* Revoke compromised sessions.
* Disable compromised account.
* Rotate relevant credentials if necessary.
* Review audit logs.
* Review recent administrative mutations.
* Verify event/content integrity.
* Review access-request changes.
* Restore affected data if necessary.

---

# 117. Database Compromise

If database credentials or service-role credentials are compromised:

* Rotate credentials.
* Revoke exposed credentials.
* Inspect database audit/connection logs.
* Review unauthorized mutations.
* Verify RLS and grants.
* Review recent migrations.
* Restore from verified backup if integrity cannot be established.

---

# 118. Security Testing Strategy

Security testing occurs continuously.

## During development

Test:

* RLS.
* Authorization.
* Validation.
* Ownership.
* RPC permissions.

## After major modules

Perform targeted security review.

## Feature complete

Perform comprehensive security review.

---

# 119. Mandatory Security Tests

The project must have automated tests for:

### Anonymous

* Cannot modify events.
* Cannot modify advertisements.
* Cannot read admin records.
* Cannot read audit logs.
* Cannot execute admin RPCs.

### Organizer

* Can modify own events.
* Cannot modify another organization's events.
* Cannot modify global settings.
* Cannot manage advertisements.
* Cannot approve access requests.
* Cannot assign roles.

### Super Admin

* Can perform permitted platform operations.
* Cannot violate database constraints.

### Disabled Admin

* Cannot perform administrative operations.

---

# 120. RLS Test Matrix

Each protected table must have tests covering:

```text
Anonymous → denied
Organizer A → own data allowed
Organizer A → Organizer B data denied
Super Admin → permitted
Disabled admin → denied
```

This must be tested directly against the database/API rather than only through React.

---

# 121. Security Loophole Review — Pass 1

The initial security design was deliberately attacked.

## Loophole 1 — "RLS means we're secure"

False.

A `SECURITY DEFINER` RPC could bypass RLS.

**Fix:**

* Harden security-definer functions.
* Explicit authorization inside RPCs.
* Restrict function execution privileges.

---

## Loophole 2 — Service role bypasses everything

True.

**Fix:**

Service-role code must implement explicit authorization before privileged operations.

---

## Loophole 3 — Organizer changes organization ID

**Fix:**

Ownership derived server-side + RLS.

---

## Loophole 4 — Client changes role

**Fix:**

Roles exist only in trusted authorization records.

---

## Loophole 5 — Student accesses hidden fields

**Fix:**

Explicit public projections/views.

---

## Loophole 6 — External URL becomes JavaScript

**Fix:**

Scheme allowlist and server-side validation.

---

## Loophole 7 — R2 upload gives storage access

**Fix:**

Restricted upload authorization + generated object keys + validation.

---

## Loophole 8 — Audit disappears after event deletion

**Fix:**

Audit records are independent.

---

## Loophole 9 — Two Super Admins appear

**Fix:**

Database-level uniqueness.

---

## Loophole 10 — Replay approval request

**Fix:**

Transactional state transition + row locking.

---

# 122. Security Loophole Review — Pass 2

A second review attacked the fixes themselves.

## Loophole 11 — RLS helper is SECURITY DEFINER but unsafe

A malicious search path could alter which function/table is used.

**Fix:**

Fixed search path + explicit schema qualification + restricted execution.

---

## Loophole 12 — Authorization checked before transaction

Membership could be revoked between authorization and mutation.

**Fix:**

Authorization and mutation occur in the same trusted transactional boundary where necessary.

---

## Loophole 13 — Cache leaks private data

A shared CDN cache could serve one user's data to another.

**Fix:**

Private admin responses are not publicly cacheable.

---

## Loophole 14 — Cache invalidation endpoint abused

An attacker could trigger expensive regeneration.

**Fix:**

Cache invalidation is internal/trusted only.

---

## Loophole 15 — Mass assignment

Client submits hidden fields such as `created_by`.

**Fix:**

Explicit mutation field allowlists.

---

## Loophole 16 — Public ID treated as authorization

UUIDs are difficult to guess but still not authorization.

**Fix:**

Every private resource requires explicit authorization.

---

## Loophole 17 — Worker becomes arbitrary execution engine

Client could inject job types.

**Fix:**

Workers accept only internally generated job records with allowlisted types.

---

## Loophole 18 — Media cleanup deletes newly referenced media

A stale cleanup candidate could be processed after a new reference is created.

**Fix:**

Worker rechecks live references immediately before deletion.

---

## Loophole 19 — Audit actor spoofing

Client supplies another admin's ID.

**Fix:**

Actor identity comes from trusted authentication context.

---

## Loophole 20 — Analytics endpoint becomes write amplifier

Attackers generate millions of analytics writes.

**Fix:**

Analytics is asynchronous and rate-controlled; raw analytics are primarily handled by PostHog.

---

# 123. Security Loophole Review — Pass 3

A final architecture-level review identified additional subtle risks.

## Loophole 21 — JWT role becomes stale

An admin's database membership is revoked, but an old JWT still contains an authorization claim.

**Fix:**

Critical authorization checks must consult current trusted authorization state rather than trusting stale client-visible role claims.

---

## Loophole 22 — Disabled admin keeps using an existing session

Authentication may remain valid even after administrative access is revoked.

**Fix:**

Authorization checks verify current `is_active` state.

---

## Loophole 23 — Organization membership changes during mutation

A user starts an edit while membership is revoked.

**Fix:**

Mutation authorization and state change occur atomically.

---

## Loophole 24 — Public cache serves a newly unpublished/deleted event

CDN cache may retain old content.

**Fix:**

Administrative mutations emit targeted cache invalidation and purge events.

Sensitive deletion operations must use a bounded maximum stale period.

---

## Loophole 25 — Search index exposes completed/private data

A search query could bypass public lifecycle filtering.

**Fix:**

Public search always applies public eligibility constraints at the database layer.

---

## Loophole 26 — `SECURITY DEFINER` function returns too much

Even if mutation authorization is correct, a function might return private fields.

**Fix:**

RPC return types are explicit and minimal.

---

## Loophole 27 — Function privileges survive refactoring

A previously public RPC remains executable after its purpose becomes privileged.

**Fix:**

Every migration changing function behavior must explicitly review:

* `GRANT EXECUTE`.
* `REVOKE EXECUTE`.
* Function owner.
* Security-definer state.

---

## Loophole 28 — R2 object key guessing

Even unpredictable keys are not sufficient if private objects are publicly readable.

**Fix:**

Private buckets/objects require authenticated infrastructure access.

---

## Loophole 29 — Uploaded malicious image/content

A file can have a valid image extension but contain malicious or unexpected content.

**Fix:**

Validate file signatures/content type and process media through a controlled pipeline where required.

---

## Loophole 30 — Audit logs become a data-exfiltration channel

An administrator could cause sensitive request payloads to be copied into audit JSON.

**Fix:**

Audit payloads use an explicit allowlist of fields.

Never automatically dump complete request bodies.

---

# 124. Security Loophole Review — Final Pass

The architecture is additionally checked against catastrophic failure modes.

## Catastrophic Case A — Service-role key reaches browser

**Result:** Architecture violation.

Required controls:

* CI secret scanning.
* Code review.
* Environment separation.
* Browser bundle inspection.
* No `VITE_*` privileged secrets.

---

## Catastrophic Case B — RLS accidentally disabled

**Result:** Deployment blocker.

CI must detect protected tables without RLS.

---

## Catastrophic Case C — New table has no RLS

**Result:** Deployment blocker if the table contains protected application data.

Database security tests must inspect new tables.

---

## Catastrophic Case D — New RPC accidentally executable by anon

**Result:** Deployment blocker for privileged RPCs.

Migration review must inspect function grants.

---

## Catastrophic Case E — Super Admin role inserted directly

**Result:** Only trusted server/database administrative process may perform role assignment.

Client INSERT/UPDATE access is denied.

---

## Catastrophic Case F — Public endpoint returns arbitrary database rows

**Result:** Prohibited.

Public APIs use explicit projections and query constraints.

---

## Catastrophic Case G — Production database used from local development

**Result:** Prohibited.

Environment configuration must use separate Supabase projects and credentials.

---

# 125. Security Definition of Done

Security is considered implemented only when:

* [ ] Email OTP authentication works.
* [ ] Google authentication does not exist.
* [ ] Password authentication does not exist.
* [ ] Student Website remains anonymous.
* [ ] Admin authorization is separate from authentication.
* [ ] Organizer ownership is enforced.
* [ ] Super Admin authorization is enforced.
* [ ] Single Super Admin invariant is enforced.
* [ ] RLS is enabled on protected tables.
* [ ] Anonymous policies are explicitly limited.
* [ ] RPC execution privileges are reviewed.
* [ ] Security-definer functions are hardened.
* [ ] Service-role credentials remain server-side.
* [ ] R2 uploads are authorized.
* [ ] Private R2 objects are private.
* [ ] External URLs are validated.
* [ ] Rich content is sanitized.
* [ ] Mass assignment is prevented.
* [ ] Rate limiting is active.
* [ ] Audit records are protected.
* [ ] Outbox is internal.
* [ ] Background jobs cannot be arbitrarily invoked.
* [ ] Public caches cannot contain private data.
* [ ] Secrets are excluded from Git.
* [ ] Production and development environments are isolated.
* [ ] Security tests exist for each role.
* [ ] Migration security checks exist.
* [ ] Backup security has been tested.
* [ ] Incident response procedures exist.

---

# 126. Final Security Architecture

The LPU Events security model is:

```text
                         INTERNET
                            │
                     ┌──────▼──────┐
                     │  Cloudflare │
                     │ WAF / DDoS  │
                     │ Rate Limit  │
                     └──────┬──────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
       Student Website              Admin Website
       Anonymous                     Email OTP
              │                           │
              │                    Supabase Auth
              │                           │
              │                    Authorization
              │                           │
              │               ┌───────────┴──────────┐
              │               │                      │
              │          Organizer              Super Admin
              │               │                      │
              └───────────────┴──────────┬───────────┘
                                         │
                                Backend / RPC Layer
                                         │
                              ┌──────────▼──────────┐
                              │    PostgreSQL       │
                              │                    │
                              │ RLS                │
                              │ Constraints        │
                              │ Transactions       │
                              │ Audit               │
                              │ Outbox              │
                              └──────────┬──────────┘
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                         Cloudflare R2          PostHog
                         Private/Public         Analytics
                         Media/Archive
```

The critical security principle is:

> **The browser is never trusted.**

The frontend can request an operation, but PostgreSQL/RLS and trusted backend code determine whether that operation is actually permitted.

Authentication proves identity.
Authorization determines what that identity is allowed to do.

The combination of database-level Row Level Security, input validation, strict API-level auditing, and transaction isolation ensures that no user can exceed their scope of access.

By keeping the Student Website entirely anonymous and enforcing organizer isolation at the PostgreSQL layer, the platform minimizes its attack surface and protects the integrity of LPU Events operational data at all times.

---
