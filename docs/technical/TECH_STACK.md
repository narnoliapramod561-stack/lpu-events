# LPU Events — Technology Stack

**File:** `docs/technical/TECH_STACK.md`
**Status:** LOCKED
**Version:** 1.1
**Last Updated:** 14 August 2026

---

# 1. Purpose

This document defines the approved technology stack for the LPU Events project.

It is a **technology lock document**.

All development agents, including AI coding agents such as Antigravity, must follow this document when implementing the project.

The purpose is to prevent unnecessary framework changes, dependency churn, and architectural drift during development.

---

# 2. Technology Lock Rule

> **The technologies defined in this document are locked.**

AI agents and developers must not replace, migrate, or introduce an alternative core technology without explicit approval from the project owner.

If an implementation problem occurs:

1. First solve the problem using the existing stack.
2. If the existing stack genuinely cannot satisfy the requirement, explain the limitation.
3. Propose the alternative technology and the reason for changing.
4. Wait for explicit approval before changing the locked stack.

An AI agent must **never independently decide** to migrate the project from one core technology to another.

Examples of prohibited unapproved changes:

* React → Vue.
* React/Vite → Next.js.
* Vite → another build system.
* Supabase → another backend.
* PostgreSQL → MongoDB.
* npm → another package manager.
* Tailwind → another styling framework after styling architecture has been locked.
* Cloudflare R2 → another object-storage provider.

---

# 3. Architecture Model

LPU Events consists of:

```text
┌───────────────────────────┐
│      Student Website      │
│      React + Vite         │
└─────────────┬─────────────┘
              │
              │
              ▼
┌───────────────────────────┐
│         Supabase          │
│ PostgreSQL + Auth + APIs  │
└─────────────▲─────────────┘
              │
              │
┌─────────────┴─────────────┐
│       Admin Website       │
│      React + Vite         │
└───────────────────────────┘

              │
              ▼
┌───────────────────────────┐
│      Cloudflare R2        │
│       Media Storage       │
└───────────────────────────┘
```

The Student Website and Admin Website are two independent applications.

They are stored in one monorepo but are independently buildable and deployable.

---

# 4. Repository Architecture

The project uses a **single Git monorepo**.

```text
lpu-events/
├── apps/
│   ├── student-web/
│   └── admin-web/
│
├── packages/
│   └── shared/
│
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
│
├── docs/
│   ├── product/
│   └── technical/
│
├── scripts/
│
├── .env.example
├── .gitignore
├── package.json
├── compose.yaml
└── README.md
```

---

# 5. Language

## TypeScript

**Locked:** Yes

TypeScript is the primary programming language for:

* Student Website.
* Admin Website.
* Shared packages.
* Development scripts where practical.

JavaScript may only be used where necessary for configuration or tooling.

The application code should remain TypeScript-first.

---

# 6. Frontend Framework

## React

**Locked:** Yes

Both applications use React.

```text
apps/student-web → React
apps/admin-web   → React
```

React is used for:

* UI components.
* Application views.
* Client-side interaction.
* Forms.
* Event discovery interfaces.
* Admin interfaces.

No alternative frontend framework should be introduced.

---

# 7. Build Tool

## Vite

**Locked:** Yes

Both websites use Vite.

```text
Student Website → Vite
Admin Website   → Vite
```

Vite is responsible for:

* Development server.
* Module bundling.
* Production builds.
* Frontend environment configuration.

The project must not migrate to Next.js, Remix, Nuxt, Webpack-based custom architecture, or another application framework without explicit approval.

---

# 8. Rendering Model

The Student Website and Admin Website use **client-side React applications**.

Server-side rendering is not part of the initial architecture.

The project should not introduce SSR or a framework requiring SSR unless a documented product or performance requirement later justifies it.

For the current LPU Events requirements, Vite + React is sufficient.

---

# 9. Package Manager

## npm

**Locked:** Yes

npm is the project package manager.

The repository uses npm workspaces.

The root lockfile must be committed to Git.

Developers must not switch package managers during implementation.

Do not introduce:

* Yarn.
* pnpm.
* Bun.

as an alternative project-wide package manager without explicit approval.

---

# 10. Node.js

Use a current **LTS Node.js release** compatible with the project's locked dependencies.

The exact Node.js major version must be pinned in the repository using a version declaration such as:

```text
.nvmrc
```

and/or the appropriate `package.json` `engines` field.

All developers and CI must use the same Node.js major version.

The Node version must be updated deliberately rather than automatically.

---

# 11. Monorepo Workspace

The root project uses **npm workspaces**.

Applications:

```text
apps/student-web
apps/admin-web
```

Shared package:

```text
packages/shared
```

The two applications remain independent.

The shared package should contain only genuinely reusable code.

Examples of appropriate shared code:

* TypeScript types.
* Shared validation schemas.
* Common constants.
* Event taxonomy.
* Shared utility functions.
* API contracts.

Do not force UI components into the shared package merely because the applications use React.

---

# 12. Styling

## Tailwind CSS

**Status:** Approved for the UI styling layer.

Tailwind should be used for application styling where appropriate.

However, the project should not become dependent on excessive utility-class complexity.

Reusable visual patterns should be extracted into components.

Global CSS should remain minimal and intentional.

The Student Website and Admin Website may have different visual systems even though both use the same underlying styling technology.

---

# 13. UI Component Architecture

Use React components with a component-based architecture.

Components should be organized by responsibility.

Recommended structure:

```text
components/
├── ui/
├── layout/
├── forms/
└── feature-specific/
```

Do not introduce a large third-party component framework unless there is a concrete requirement.

The project should prefer:

1. Native HTML where sufficient.
2. Small reusable components.
3. Accessible custom components where necessary.
4. A component library only when it provides meaningful value.

---

# 14. Routing

## React Router

**Locked:** Yes

Client-side routing will use React Router.

Student and Admin applications maintain independent route trees.

Example:

```text
Student Web
/
 /events
 /events/:id
 /search
 /profile
```

and:

```text
Admin Web
/
 /dashboard
 /events
 /events/:id
 /settings
```

Exact routes will be defined later in the application architecture.

---

# 15. Backend Platform

## Supabase

**Locked:** Yes

Supabase is the primary backend platform.

Supabase provides:

* PostgreSQL.
* Authentication.
* Database APIs.
* Row Level Security.
* Database functions/RPCs where appropriate.
* Local development environment.
* Supabase CLI.

Supabase is the operational backend and database platform.

---

# 16. Database

## PostgreSQL

**Locked:** Yes

PostgreSQL is the sole operational database.

PostgreSQL is the single source of truth for application data.

Do not introduce:

* MongoDB.
* MySQL.
* SQLite as a production database.
* Firebase database.
* Another operational database.

A local PostgreSQL instance is provided through the local Supabase environment.

---

# 17. Database Schema Management

Database schema changes must be managed through **Supabase migrations**.

Schema changes must not exist only as manual changes made through Supabase Studio.

Required workflow:

```text
Schema change
     ↓
Migration
     ↓
Local testing
     ↓
Git commit
     ↓
Staging
     ↓
Production
```

Migrations are part of the source code and must be committed to Git.

---

# 18. Database Security

## Row Level Security

**Locked:** Required

Production tables must use PostgreSQL Row Level Security where applicable.

Authorization must be enforced server-side.

Frontend checks are not considered sufficient authorization.

The final RLS architecture will be defined in:

`SECURITY_ARCHITECTURE.md`

---

# 19. Authentication

## Supabase Auth

**Locked:** Yes

Supabase Auth provides identity management.

Authentication and authorization remain separate concepts.

The final authentication methods and flows will be defined in the system architecture and security documents.

The Admin Website must use the dedicated admin authorization model.

Student authorization and Admin authorization must remain independent.

---

# 20. Authorization

Authorization is primarily enforced through:

* PostgreSQL RLS.
* Server-side validation.
* Database authorization logic.
* Application-level route protection where appropriate.

Client-side route protection is only a UX mechanism.

It must never be the sole authorization mechanism.

---

# 21. External Registration

LPU Events does **not** provide an internal registration or ticketing system.

The platform only stores the external registration destination associated with an event.

The Student Website redirects the student to that destination.

Therefore the technology stack does not include:

* Payment gateway.
* Ticketing system.
* Booking system.
* Reservation system.
* Ticket inventory.
* Ticket QR generation.
* Refund system.

---

# 22. Payment Technology

## None

There is intentionally no payment gateway in the LPU Events platform.

Do not install or configure:

* Razorpay SDK.
* Stripe SDK.
* PayPal SDK.
* UPI payment SDK.

If external registration requires payment, the external registration platform handles it.

---

# 23. Ticketing Technology

## None

LPU Events does not maintain a ticketing system.

There are no platform-owned:

* Tickets.
* QR tickets.
* Ticket numbers.
* Booking records.
* Payment records.
* Reservation records.

This is an intentional architectural constraint.

---

# 24. Object Storage

## Cloudflare R2

**Locked:** Yes

Cloudflare R2 is the primary object storage for LPU Events media.

R2 is the **only** mechanism for public media delivery to students.

Used for:

* Event posters.
* Advertisement banners.
* Sponsor logos.
* Event Memory images.
* Other approved platform media.

The database stores metadata/references rather than large media files.

### Why R2 (Not Supabase Storage)

R2 Internet egress is **free and unlimited**.

Supabase Storage egress counts against the 10 GB/month free-tier limit.

Therefore:

* All public images → R2 → Cloudflare Cache → Students.
* Supabase Storage (1 GB free) is reserved for internal/admin-only use only.

**Do not serve any public-facing image through Supabase Storage.**

Refer to `FREE_TIER_CAPACITY.md` Section 4.3 for R2 storage budget details.

---

# 25. Image Format

Preferred format:

**WebP**

Images should be optimized before or during upload.

The target optimized event/media image size is approximately:

**200–500 KB**

The system should support appropriate image variants for different UI contexts.

---

# 26. Local Media Development

The project should not introduce MinIO or another local S3 emulator unless a concrete requirement appears.

Development may use a dedicated development R2 bucket where appropriate.

Production and development media must remain separated.

---

# 27. Caching

The approved caching strategy is:

**Dependency-based, tag-driven caching with proactive cache warm-up.**

The caching architecture will be documented separately.

The system should support:

* Dependency tags.
* Field-aware invalidation.
* Batch invalidation.
* Stale-while-revalidate where appropriate.
* Single-flight regeneration.
* Proactive cache warming.
* Scheduled invalidation for time-dependent content.

---

# 28. Search

Search will initially use PostgreSQL-based search capabilities appropriate to the requirements.

Do not introduce Elasticsearch, OpenSearch, Algolia, Meilisearch, Typesense, or another dedicated search engine unless the project develops a concrete scalability requirement that PostgreSQL cannot reasonably satisfy.

The search architecture will be finalized separately.

---

# 29. State Management

Do not introduce a large global state-management library by default.

Preferred approach:

* React local state for local UI state.
* React context only for genuinely global lightweight state.
* Server/data state handled through the chosen data-fetching architecture.
* URL state for shareable search/filter state where appropriate.

Do not introduce Redux, Zustand, MobX, Jotai, or another global state library unless a documented requirement demonstrates that it is necessary.

---

# 30. Server/Data Fetching

The project should use a dedicated server/data-fetching approach only where it provides clear value.

Avoid duplicating server state into multiple client stores.

The exact data-fetching library, if one is required, will be selected during the system architecture phase based on actual application requirements.

Until then, do not add one merely because it is popular.

---

# 31. Form Handling

Forms should use:

* Native React form mechanisms where sufficient.
* A dedicated form library only when complex forms justify it.

The final form-library decision must be made before implementing the large Admin Website forms and then locked.

---

# 32. Validation

Use schema-based validation.

Validation schemas should be reusable between:

* Frontend.
* Backend/RPC boundaries where practical.
* Shared package.

Client-side validation is for usability.

Server/database validation remains authoritative.

The exact validation library will be finalized during technical architecture before large-scale implementation.

---

# 33. Testing

The project must eventually have:

### Unit tests

For:

* Utilities.
* Validation.
* Business rules.
* State transitions.

### Integration tests

For:

* Supabase interactions.
* Authorization.
* Database functions.
* Important workflows.

### End-to-end tests

For critical user journeys across:

* Student Website.
* Admin Website.

The exact testing libraries will be locked before implementation of major functionality.

Do not add multiple overlapping test frameworks unnecessarily.

---

# 34. Code Quality

The project uses:

* ESLint.
* TypeScript strict checking.
* npm scripts.

Formatting strategy should remain consistent across the repository.

Do not introduce multiple competing lint/format systems.

---

# 35. Docker

## Docker Desktop

**Locked:** Yes

Docker Desktop is the standard local container runtime for:

* macOS.
* Windows.

Supabase local development runs through Docker.

The project should not create unnecessary custom infrastructure containers.

---

# 36. Local Supabase

Supabase CLI manages the local Supabase environment.

Expected workflow:

```bash
supabase start
supabase status
supabase db reset
supabase stop
```

Both Mac and Windows must be able to reproduce the same local environment from the repository.

---

# 37. Development Environments

The project uses exactly three environments:

```text
LOCAL
STAGING
PRODUCTION
```

### Local

Developer machine.

Uses:

* Docker Desktop.
* Local Supabase.
* Development R2 resources.

### Staging

Remote production-like environment for integration testing.

### Production

Actual LPU Events environment.

Developers must not develop directly against production.

---

# 38. Deployment Model

Student Website and Admin Website are independently deployable applications.

```text
Student Web
apps/student-web
       ↓
Independent deployment

Admin Web
apps/admin-web
       ↓
Independent deployment
```

A monorepo does not imply a single deployment.

Changes to one application should not require rebuilding/redeploying the other unless a shared dependency requires it.

---

# 39. Hosting

The current approved frontend hosting architecture is:

**Cloudflare Pages (Free Tier)**

Student Website:

```text
apps/student-web
       ↓
Cloudflare Pages (Project A)
       ↓
Static SPA assets → Free, unlimited requests
```

Admin Website:

```text
apps/admin-web
       ↓
Cloudflare Pages (Project B)
       ↓
Static SPA assets → Free, unlimited requests
```

Each website should have its own Cloudflare Pages deployment/configuration.

### Free-Tier Hosting Constraints

**Static asset requests** on Cloudflare Pages are free and unlimited.

**Pages Functions** (server-side functions) count against the Cloudflare Workers Free plan:

* 100,000 requests/day (shared across all Workers and Pages Functions).

Therefore:

* The Student Website must be a **pure static SPA** — no Pages Functions.
* The Admin Website may use minimal Pages Functions for specific server-side needs (e.g., cache purge triggers).
* **Do not route student traffic through Pages Functions.**

Refer to `FREE_TIER_CAPACITY.md` Section 4.5 for the Workers/Functions budget.

---

# 40. Backend Hosting

Production backend:

**Supabase (Free Tier)**

Supabase remains the primary backend platform and PostgreSQL source of truth.

The Student Website does not call Supabase directly. Instead:

```text
Student → Cloudflare Edge Cache → Supabase (on cache miss only)
```

The Admin Website calls Supabase directly (low traffic, authenticated).

Refer to `FREE_TIER_CAPACITY.md` for all Supabase free-tier limits and sustainability analysis.

---

# 41. CI/CD

## GitHub Actions

**Locked:** Yes

GitHub Actions will eventually validate:

* Installation.
* TypeScript.
* Linting.
* Tests.
* Student Website build.
* Admin Website build.
* Database migration validation.

Deployment workflows may be added after the application architecture is finalized.

Do not create an unnecessarily complex CI/CD pipeline before it is needed.

---

# 42. Source Control

## Git + GitHub

**Locked:** Yes

GitHub is the source-control platform.

The project uses:

* One monorepo.
* `main` for stable production-ready code.
* `dev` for integration development.
* Short-lived feature/fix branches where appropriate.

The exact branch protection rules will be defined later.

---

# 43. Development Synchronization

Mac and Windows must synchronize through GitHub.

Do not use:

* iCloud.
* OneDrive.
* Dropbox.
* Shared filesystem synchronization.

The development source of truth is Git.

---

# 44. Environment Secrets

Secrets must never be committed.

Use:

```text
.env.example
```

as the committed template.

Actual:

```text
.env
.env.local
```

and equivalent secret files must remain ignored.

Production secrets must be managed through the deployment/platform secret-management facilities.

---

# 45. Analytics

## PostHog

**Locked:** Yes

Use a **single shared PostHog project** for both websites.

Both applications use the same PostHog project key and host.

Each event must include:

```text
app: "student"
```

for Student Website events and:

```text
app: "admin"
```

for Admin Website events.

This allows both applications to remain in one analytics project while maintaining application-level separation.

---

# 46. Logging

Application logs should use the platform's supported logging mechanisms initially.

Do not introduce a dedicated logging platform unless operational requirements justify it.

Long-term operational log retention should be considered separately from default platform retention.

---

# 47. Background Processing

Background jobs should use the simplest appropriate mechanism within the approved Supabase/Cloudflare architecture.

Do not introduce a dedicated message broker unless required.

Background responsibilities may include:

* Event lifecycle maintenance.
* Cache invalidation.
* Cache warming.
* Notifications.
* Cleanup.
* Analytics aggregation.
* Other scheduled maintenance.

Exact mechanisms will be finalized in `SYSTEM_ARCHITECTURE.md`.

---

# 48. API / Backend Logic

Business-critical atomic operations should be implemented close to PostgreSQL when transactional consistency is required.

PostgreSQL functions/RPCs may handle:

* Atomic state transitions.
* Authorization-sensitive database operations.
* Atomic updates.
* Related data changes that must occur in one transaction.

Supabase Edge Functions may handle:

* External integrations.
* Orchestration.
* Operations requiring non-database services.

The exact division of responsibility will be documented in the system architecture.

---

# 49. External Services

The project should minimize third-party services.

Approved core external services:

| Service          | Purpose                     |
| ---------------- | --------------------------- |
| GitHub           | Source control + CI         |
| Supabase         | Backend + PostgreSQL + Auth |
| Cloudflare Pages | Website hosting             |
| Cloudflare R2    | Media storage               |
| PostHog          | Analytics                   |
| Docker           | Local development           |
| Supabase CLI     | Local backend development   |

Additional services require explicit justification.

---

# 50. Prohibited Technology Drift

Unless explicitly approved, agents must not introduce:

* Next.js.
* Vue.
* Angular.
* Svelte.
* MongoDB.
* MySQL.
* Firebase.
* Redis.
* Kafka.
* Elasticsearch.
* Algolia.
* Kubernetes.
* MinIO.
* Another frontend build system.
* Another package manager.
* Another hosting platform.
* Another analytics platform.

This list exists primarily to prevent unnecessary architectural drift.

It does not prohibit a future technology addition when a genuine requirement is documented and explicitly approved.

---

# 51. Dependency Philosophy

Prefer a small dependency footprint.

Before adding a dependency, determine whether the requirement can reasonably be solved with:

1. Existing project dependencies.
2. Native browser APIs.
3. React.
4. TypeScript.
5. PostgreSQL/Supabase.
6. Existing shared utilities.

A dependency should be added when it provides meaningful functionality, reliability, maintainability, or security—not merely because it is popular.

---

# 52. AI Development Rules

AI coding agents working on this repository must:

1. Read `TECH_STACK.md` before implementation.
2. Follow the locked technologies.
3. Read relevant PRDs before implementing product functionality.
4. Read `SYSTEM_ARCHITECTURE.md` once it exists.
5. Avoid introducing alternative frameworks.
6. Avoid adding dependencies without justification.
7. Avoid changing database architecture without approval.
8. Avoid modifying unrelated modules.
9. Preserve existing project conventions.
10. Report architectural conflicts instead of silently resolving them through technology changes.

---

# 53. Change-Control Rule

Any proposed change to a **locked core technology** requires explicit approval.

A proposal must include:

* Current technology.
* Proposed replacement.
* Reason.
* Problem being solved.
* Alternatives considered.
* Migration impact.
* Development impact.
* Deployment impact.
* Risks.

No technology migration should happen merely because an AI agent considers another framework more convenient.

---

# 54. Current Locked Stack

| Layer             | Technology            | Status      |
| ----------------- | --------------------- | ----------- |
| Language          | TypeScript            | 🔒 Locked   |
| Frontend          | React                 | 🔒 Locked   |
| Build tool        | Vite                  | 🔒 Locked   |
| Package manager   | npm                   | 🔒 Locked   |
| Monorepo          | npm Workspaces        | 🔒 Locked   |
| Styling           | Tailwind CSS          | 🔒 Locked   |
| Routing           | React Router          | 🔒 Locked   |
| Backend           | Supabase              | 🔒 Locked   |
| Database          | PostgreSQL            | 🔒 Locked   |
| Auth              | Supabase Auth         | 🔒 Locked   |
| Database security | PostgreSQL RLS        | 🔒 Required |
| Object storage    | Cloudflare R2         | 🔒 Locked   |
| Frontend hosting  | Cloudflare Pages      | 🔒 Locked   |
| Analytics         | PostHog               | 🔒 Locked   |
| Containers        | Docker                | 🔒 Locked   |
| Local backend     | Supabase CLI + Docker | 🔒 Locked   |
| Source control    | Git + GitHub          | 🔒 Locked   |
| CI                | GitHub Actions        | 🔒 Locked   |

---

# 55. Decisions Intentionally Deferred

The following should **not** be chosen casually during implementation and must be finalized in the technical architecture before the corresponding feature is built:

* Exact form library.
* Exact data-fetching library.
* Exact testing framework(s).
* Exact UI component library, if any.
* Exact error-monitoring solution, if needed.
* Exact background-job mechanism.
* Exact API/RPC conventions.
* Exact cache implementation.
* Exact database schema.
* Exact RLS policies.
* Exact deployment pipeline configuration.

Deferring these decisions is intentional.

They should be selected based on the actual architecture rather than added automatically.

---

# 56. Final Technology Contract

The approved LPU Events technology foundation is:

```text
React
+
TypeScript
+
Vite
+
npm Workspaces
+
Tailwind CSS
+
React Router
+
Supabase
+
PostgreSQL
+
Supabase Auth
+
PostgreSQL RLS
+
Cloudflare R2
+
Cloudflare Pages
+
PostHog
+
Docker
+
GitHub
+
GitHub Actions
```

This stack is now the **baseline technology contract for LPU Events**.

Any future technology change must be deliberate, documented, and explicitly approved.

---

# 57. Implementation Rule

No major application implementation should begin until the following documents are available:

1. `TECH_STACK.md` — this document.
2. `SYSTEM_ARCHITECTURE.md`
3. `DATABASE_SCHEMA.md`
4. `API_CONTRACTS.md`
5. `SECURITY_ARCHITECTURE.md`
6. Relevant Student/Admin UI specifications.
7. Master Implementation Checklist.

Once these are approved, development can proceed task-by-task without repeatedly reopening foundational technology decisions.
