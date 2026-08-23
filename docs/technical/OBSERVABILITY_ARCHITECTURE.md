# LPU Events — Production Observability, Analytics & Monitoring Architecture

This document specifies the authoritative production observability, telemetry, analytics, session recording, uptime monitoring, SEO infrastructure, and performance verification standards for **LPU Events**.

---

## 1. Observability Architecture Overview

The production architecture employs defense-in-depth observability across all layers:

```text
                                  LPU EVENTS
                                       |
                     +-----------------+-----------------+
                     |                                   |
             apps/student-web                     apps/admin-web
         (Public Event Discovery)             (Organizer & Super Admin)
                     |                                   |
            +--------+--------+                 +--------+--------+
            |        |        |                 |        |        |
         PostHog  Clarity  Sentry            PostHog  Clarity  Sentry
        (app:     (Standard (Error /        (app:     (Strict   (Error /
        student)  masking)  Tracing)        admin)    masking)  Tracing)
            |        |        |                 |        |        |
            +--------+--------+                 +--------+--------+
                     |                                   |
             SEO / Robots / GSC                  noindex / nofollow
                     |                                   |
                     +-----------------+-----------------+
                                       |
                              Cloudflare Pages & Edge
                         (WAF, DDoS, Bot Defense, Cache)
                                       |
                            +----------+----------+
                            |                     |
                     Supabase Backend        Cloudflare R2
                 (PostgreSQL, Auth, RPC)   (Media Storage)
                            |
                 +----------+----------+
                 |                     |
        Edge Functions (/health)  Outbox Worker
                 |                     |
              Sentry                Sentry
                 |
            Better Stack
      (Uptime & Incident Alerts)
```

---

## 2. Tooling Matrix & Data Responsibility

| Tool | Purpose | Monitored Surface | Permitted Data | Strictly Prohibited Data |
| :--- | :--- | :--- | :--- | :--- |
| **PostHog** | Product Analytics | Student Web & Admin Web | Event views, search terms, category filters, navigation, ad impressions/clicks, `Registration Link Click`, admin action names. | Passwords, OTP codes, auth tokens, session JWTs, service-role keys, PII. |
| **Microsoft Clarity** | Session Recordings & Heatmaps | Student Web & Admin Web | Rage clicks, dead clicks, scroll depth, interaction friction, UI element positions. | Any unmasked text/inputs on Admin (`data-clarity-mask="True"` enforced), credentials, tokens. |
| **Sentry** | Error & Performance Monitoring | Student Web, Admin Web, Edge Functions, Background Workers | Stack traces, error messages, component trees, safe route names, HTTP status codes, performance spans. | `Authorization` headers, cookies, Supabase keys, connection strings, database credentials, OTPs. |
| **Better Stack** | Uptime & Incident Alerting | Public Homepage, Edge `/health` endpoint, Admin app | HTTP status (200/503), response time (ms), timestamp. | Internal stack traces, server environment dumps, confidential query logs. |
| **Cloudflare** | CDN, WAF, Security & Cache | Edge Traffic & R2 Assets | Request volume, cache hit ratio, bandwidth, blocked threats, bot scores. | Decrypted private user payloads. |
| **Supabase** | DB Health, Connection Pooling, Auth | PostgreSQL & Auth Server | Active connections, replication lag, slow queries, auth success/failure rates. | Raw user credentials. |
| **Lighthouse CI**| Performance & CWV Budget | CI Pipeline / Build Outputs | LCP, CLS, INP, accessibility scores, best practices, SEO validation. | N/A (Build artifact audits). |

---

## 3. Product Analytics (PostHog)

Both web applications share a **single PostHog project** to consolidate licensing while maintaining strict application separation via the `app` super-property:

### Student Website
- Super property: `app: "student"`
- Tracked events:
  - `$pageview` (Home Discovery, Event Details)
  - `event_view` (event ID, name, category, pricing type)
  - `Registration Link Click` (outbound link click tracking with destination domain, avoiding claims of ticket completion)
  - `category_filter_selected`, `subcategory_filter_selected`, `schedule_filter_selected`
  - `advertisement_clicked`, `event_share_clicked`

### Admin Website
- Super property: `app: "admin"`
- Tracked events:
  - `auth_login_success`, `auth_logout`
  - `admin_action` (`create_event`, `edit_event`, `cancel_event`, `review_access_request`, etc.)

### Non-Blocking Resilience Rule
Analytics failures or blocked scripts (e.g. via browser adblockers) must never degrade core discovery or administrative workflows.

---

## 4. Microsoft Clarity Masking & Privacy

To protect user confidentiality:
1. **Student Website**:
   - Standard session recording with automatic input element masking.
2. **Admin Website**:
   - Strict privacy mode: `maskAllText: true` enabled on client configuration.
   - Root body container annotated with `data-clarity-mask="True"`.
   - All email addresses, organizer remarks, access request details, and system IDs are redacted in heatmaps and video sessions.

---

## 5. Sentry Privacy & Scrubbing Standards

All Sentry clients (`@sentry/react` and `@sentry/node`) implement an automated `beforeSend` sanitization pipeline that strips:
- `Authorization` headers (`Bearer ...`)
- Supabase session tokens and JWTs (`sb-*-auth-token`, `apikey`)
- Database connection strings (`postgresql://...`)
- Passwords and one-time password (OTP) codes
- Supabase `service_role` secrets

---

## 6. Uptime Monitoring & Health Checks (Better Stack)

### Monitored Endpoints

| Target Name | Monitored URL | Probe Interval | Expected Response |
| :--- | :--- | :--- | :--- |
| **Student Web Homepage** | `https://lpuevents.live/` | 1 min | HTTP 200 |
| **Edge Health Check** | `https://<supabase-project>.functions.supabase.co/health` | 1 min | HTTP 200 `{"status":"healthy"}` |
| **Admin Web Portal** | `https://admin.lpuevents.live/` | 2 min | HTTP 200 |

### Health Check Endpoint Contract (`/functions/v1/health`)
- **Success (200 OK)**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-08-17T15:00:00.000Z",
    "latency_ms": 12,
    "services": {
      "edge_runtime": "healthy",
      "database": "healthy"
    }
  }
  ```
- **Degraded / Failure (503 Service Unavailable)**:
  ```json
  {
    "status": "unhealthy",
    "timestamp": "2026-08-17T15:00:00.000Z",
    "services": {
      "edge_runtime": "error",
      "database": "unreachable"
    }
  }
  ```

---

## 7. SEO & Search Engine Directives

### Student Website (Publicly Indexable)
- **Directives**: `index, follow, max-image-preview:large`
- **Robots.txt**: Accessible at `/robots.txt`, allows root crawling and references `https://lpuevents.live/sitemap.xml`.
- **Sitemap**: `/sitemap.xml` detailing canonical landing routes.
- **Dynamic SEO**: Document titles update dynamically on event view (`<Event Name> — LPU Events`).
- **Google Search Console**: Configurable verification token via `VITE_GOOGLE_SITE_VERIFICATION`.

### Admin Website (Strictly Non-Indexable)
- **Directives**: `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />`
- **Robots.txt**:
  ```text
  User-agent: *
  Disallow: /
  ```

---

## 8. Incident Response Runbook

When an anomaly or alert triggers, follow this prioritized triage path:

```text
                       Incident Alert Triggered
                                  │
                                  ▼
                     [Step 1: Check Better Stack]
                Identify whether Student, Admin, or DB is down
                                  │
                                  ▼
                       [Step 2: Check Sentry]
            Inspect recent uncaught frontend/backend exceptions
                                  │
                                  ▼
                     [Step 3: Check Cloudflare]
             Check Edge traffic spikes, WAF blocks, or CDN 5xxs
                                  │
                                  ▼
                      [Step 4: Check Supabase]
            Inspect active DB connections, CPU, and slow queries
                                  │
                                  ▼
                    [Step 5: Apply Mitigation]
       (Hotfix / Database Restart / CDN Purge / Rollback Deployment)
                                  │
                                  ▼
                   [Step 6: Verify in Telemetry]
              Ensure Better Stack returns 200 OK & Sentry clears
```

---

## 9. Manual Production Setup Checklist

The following actions must be performed in external provider dashboards prior to launching to production:

1. **PostHog**:
   - Create one project (e.g. `LPU Events Production`).
   - Copy Project API Key and set `VITE_POSTHOG_KEY`.
2. **Microsoft Clarity**:
   - Create project in [clarity.microsoft.com](https://clarity.microsoft.com).
   - Set `VITE_CLARITY_PROJECT_ID`.
3. **Sentry**:
   - Create Sentry Organization & Projects for `student-web`, `admin-web`, and `backend`.
   - Copy Client DSN to `VITE_SENTRY_DSN` and Server DSN to `SENTRY_DSN`.
4. **Better Stack**:
   - Configure HTTP Uptime Monitors for `https://lpuevents.live/` and Edge `/health`.
   - Link alert escalation to Discord / PagerDuty / Email.
5. **Google Search Console**:
   - Add Domain property for `lpuevents.live`.
   - Paste verification HTML meta code into `VITE_GOOGLE_SITE_VERIFICATION`.
   - Submit `https://lpuevents.live/sitemap.xml`.
