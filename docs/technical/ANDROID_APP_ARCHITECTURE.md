# LPU Events Native Android App Architecture

**Status:** Proposed architecture for review  
**Repository:** `narnoliapramod561-stack/lpu-events`  
**Scope:** Student-facing native Android app; shared LPU Events production backend  
**Build environment:** Android Studio + Gradle  
**Cost target:** No new paid services; remain within existing free-tier quotas

## 1. Locked product and technology decisions

1. Build a real Android application in Kotlin with Jetpack Compose. Android Studio and Gradle are the development/build toolchain.
2. Do not use Expo, React Native, a WebView wrapper, or an embedded copy of the Student Website.
3. Supabase/PostgreSQL remains the only authoritative operational data store. The Admin Website remains the only administration surface; organizers continue creating and updating content there.
4. Do not introduce a second database, Firebase, Redis, MongoDB, a paid API gateway, or a separate authentication provider.
5. Public student browsing remains anonymous. Do not add student accounts, sign-in, bookings, ticketing, payment, ticket issuance, or verification to the app.
6. The app uses the same event lifecycle and registration rules as the Student Website: NONE, EXTERNAL, or INTERNAL. The app itself never books tickets or processes payments; an external booking URL is opened outside the app.
7. Public media continues to be delivered from Cloudflare R2 through the existing Cloudflare custom domain. Never serve public posters/banner images from Supabase Storage.
8. All app reads must be designed around explicit data and request budgets. No client-side polling or Supabase Realtime subscription for public discovery.

## 2. Recommended high-level architecture

PostgreSQL remains the source of truth. The app has an offline-first UI whose primary source is its local Room database; Room is a cache/projection, not an authority. Public, relatively stable content should be delivered through Cloudflare's CDN, while indexed search and filter queries remain uncached server queries.

The target public-data path is:

Admin Website
→ Supabase database transaction
→ resource version + transactional outbox
→ server-side public-content projection builder
→ versioned JSON snapshots in Cloudflare R2
→ Cloudflare CDN on a dedicated public-data hostname
→ Android app and Student Website

The app data path is:

Jetpack Compose screen
→ screen ViewModel (StateFlow)
→ domain/use-case layer where logic is reused
→ repository
→ Room DAO for immediate/cached results
→ snapshot CDN client or bounded Supabase query client
→ update Room
→ UI observes Room/StateFlow and updates

Media path:

Compose image
→ Coil image loader
→ memory cache
→ disk cache
→ Cloudflare R2 public image URL
→ Cloudflare CDN/R2

Admin reads and mutations remain on the existing authenticated Admin Website → Supabase path. Never put private/admin data into the public snapshot store or shared CDN cache.

### Why public snapshots are proposed

Supabase's free-tier egress is finite, while R2 has a free storage/operation allowance and free internet egress. Serving unchanged public JSON as CDN-cached R2 objects avoids sending repeated homepage, carousel, taxonomy and detail-page reads to Supabase. This does not introduce a new hosting vendor: it extends the existing Cloudflare R2 deployment.

Do not route every app read through a Cloudflare Worker. The current Workers Free plan has a 100,000-request/day limit shared with Pages Functions. Normal public content reads should be cacheable objects delivered directly by the CDN; Workers should not become a per-screen proxy. Use server-side processing only for snapshot generation, invalidation, and any narrowly scoped dynamic gateway that demonstrably fits the request budget.

Before implementing snapshots, audit the production Student Website's actual configured API hostname, response headers and Cloudflare cache status. Repository documentation describes an edge-cached read path, while the shared TypeScript client contains direct Supabase table/RPC calls. Do not assume that Cache-Control headers alone prove a request is being cached at Cloudflare. Reuse an existing proven edge-cached path if one already exists and meets the same quotas; do not create a duplicate system.

## 3. Android stack

| Concern | Choice | Reason |
|---|---|---|
| Language | Kotlin | First-class Android language and coroutine support |
| UI | Jetpack Compose + Material 3 | Native UI, adaptive layout and accessibility |
| Navigation | Navigation Compose | Native back-stack/deep-link model |
| Presentation | ViewModel + StateFlow + unidirectional data flow | Predictable screen state and lifecycle handling |
| Persistent data | Room | Indexed structured local cache and offline rendering |
| Small preferences | DataStore | Theme and local app preferences, not event collections |
| HTTP | OkHttp + Retrofit (or one equivalent typed client) | Explicit cache policy, timeouts, request cancellation and testability |
| JSON | Kotlin Serialization | Typed, schema-versioned snapshot parsing |
| Images | Coil 3 | Compose integration, memory/disk caching and image sizing |
| Pagination | Paging 3 where data volume warrants it | Controlled loading and no giant in-memory lists |
| Background work | WorkManager only for justified deferred work | No polling loop; no unnecessary periodic jobs |
| Dependency injection | Hilt, or a small manual graph if dependency count stays low | Testable repository wiring without service locators |
| Build | Android Studio, Gradle Kotlin DSL, version catalog | Reproducible local release builds |
| Tests | JUnit, coroutine tests, Room tests, MockWebServer and Compose UI tests | Verify data and offline behavior at each layer |

Use stable dependency versions and a Gradle version catalog. Do not add libraries for features the product does not need. Avoid introducing a framework just to mirror the web package structure.

## 4. Suggested code organization

Begin with a small number of clear Gradle modules. Split modules only when the boundary reduces coupling or allows reliable independent testing.

- **:app** — application, navigation graph, Android entry points, build variants and app lifecycle.
- **:core:model** — platform-neutral Kotlin models and result/error types.
- **:core:network** — CDN snapshot API, Supabase query API, JSON parsing and network policies.
- **:core:database** — Room entities, DAOs, migrations and cache metadata.
- **:core:data** — repositories and synchronization/cache coordination.
- **:core:designsystem** — theme, typography, color, reusable native components and loading/error states.
- **:feature:home** — carousel and home sections.
- **:feature:explore** — event hub, categories, filtering and search.
- **:feature:eventdetail** — event details, organizer-defined content sections and external registration links.
- **:feature:memories** — Event Memories, if included in the first release.

Within each feature, keep UI state/events separate from data retrieval. Composables render immutable state and emit user actions; they do not call the network or Room directly. ViewModels do not contain SQL or HTTP details. Repositories own the data-source decision and caching rules.

## 5. Cache architecture

Use layered caching with explicit authority and expiration semantics.

### Layer A — Cloudflare CDN and R2

Create a dedicated public snapshot bucket in the existing Cloudflare account, with a read-only custom domain such as data.lpuevents.live. Exact bucket/domain names are deployment decisions and must be confirmed against the existing R2 account before provisioning.

- Public clients can GET approved snapshot objects only.
- Snapshot writes are server-side only. R2 credentials must never be embedded in the APK, Student Website, or Admin Website.
- Store JSON with Content-Type: application/json and explicit Cache-Control metadata.
- Use immutable, versioned object names for snapshot payloads. A new payload must not overwrite an immutable object.
- Use a small mutable manifest/current pointer with short CDN TTL. On publish, update the immutable payload first and publish the pointer last.
- Use targeted cache purge for mutable pointer URLs where practical. Expiration remains the fallback if invalidation fails.
- CDN and R2 caches are disposable. PostgreSQL is still authoritative.

Recommended object families:
- Current manifest, containing schema version, generation timestamp and resource versions.
- Precomputed homepage payload, including carousel and configured public sections.
- Compact unfiltered event index / event-card projections.
- Individual public event-detail projections.
- Taxonomy snapshot (categories and subcategories).
- Public ads, sponsors and memories projections.
- Chunked past-event projections, partitioned by a predictable time range if the dataset grows.

Do not duplicate large image binaries inside JSON snapshots; include CDN image URLs and the small metadata required by the UI. Avoid one enormous all-history payload. Keep object schemas versioned and bounded in size.

### Layer B — HTTP cache in the Android client

Use a bounded OkHttp disk HTTP cache for CDN JSON responses where appropriate. Respect server Cache-Control and ETag. Do not configure an HTTP cache that makes private responses public or caches mutation responses. The Room database remains the principal structured-data cache; HTTP cache reduces redundant transfers.

Separate CDN and Supabase cache policies. Indexed search/filter responses must not be shared at the CDN layer.

### Layer C — Room persistent database

Room stores normalized event/category content and the last accepted snapshot generation. Suggested tables:

- events — public event card fields, status, category/subcategory IDs, schedule, venue, registration mode, external URL, media URL, content version and last sync time.
- event_content_sections — event ID, organizer-defined heading, content payload, sort order and schema/content version.
- categories and subcategories — taxonomy metadata and order.
- home_sections — the current snapshot sections and ordering/references.
- ads, sponsors and memories — only public fields required for display.
- resource_sync_state — resource name, manifest version, fetched time, schema version, last success and error classification.
- snapshot_metadata — current schema version and snapshot generation timestamp.

Use foreign keys where meaningful, indexes on event ID, category/subcategory, start/end timestamps and status, and explicit Room migrations. Do not store secrets or credentials in Room. Do not store each search/filter combination as a persistent query-result cache; cached event entities may still be reused by normal database queries.

The UI should observe Room via Flow. On launch, display usable cached content immediately, then refresh from the network and update Room. Offline content must be visibly marked as potentially stale. A failure to refresh must not erase a previously valid cache.

### Layer D — In-memory cache and request coalescing

Keep an in-memory representation of the current manifest/home state for the active process. Deduplicate simultaneous requests for the same snapshot or event detail so recomposing/opening multiple screens does not fire duplicate network calls. Cancel obsolete search/filter requests when a newer request replaces them.

This layer is short-lived and disposable. Do not build a second general-purpose state database or cache framework when Room and a repository suffice.

## 6. Freshness and refresh policy

Use resource-specific policies instead of a single global TTL.

| Resource | Shared CDN policy | Android refresh behavior |
|---|---|---|
| Current manifest/pointer | Short TTL, target 60 seconds with bounded stale-while-revalidate | Check on cold start; on foreground only when last check is older than about 10–15 minutes; manual refresh bypasses local freshness |
| Versioned homepage payload | Immutable, long-lived (up to one year) | Fetch only when manifest version changes |
| Versioned taxonomy | Immutable, long-lived | Fetch only when manifest version changes |
| Versioned event index/page | Immutable, long-lived | Update local records only when version changes |
| Current event-detail pointer | Short TTL and targeted invalidation | Refresh on detail open if its pointer is stale; use cached detail while loading |
| Versioned event detail | Immutable, long-lived | Fetch only on version change or cache miss |
| Public images with immutable media keys | Long-lived, immutable | Coil memory/disk cache; display sized variants |
| Supabase search/filter queries | No shared CDN cache | Debounced, bounded, cancellable queries; use indexed server queries online |
| User-independent UI preferences | Not applicable | DataStore/local state only |

These are initial engineering targets, not immutable settings. Adjust them only after measured freshness, request and egress data. Never allow stale content forever. A cache miss or cache deletion must not break the ability to fetch authoritative content.

Do not poll resource versions from the app. The app reads the current manifest when its refresh policy says it is due. Do not establish permanent Supabase Realtime connections for public discovery.

## 7. Publish, invalidation and cache-warming flow

1. An organizer creates, edits, publishes, completes or cancels an event through the existing Admin Website.
2. PostgreSQL commits the data mutation, resource-version updates and transactional outbox event together.
3. A server-side outbox processor claims pending events and groups them by affected cache dependency to prevent duplicate rebuilds.
4. It derives affected resources using old and new values: event detail, unfiltered feed/index, relevant category data, home sections, carousel/featured sections, ad placements and date buckets.
5. It builds sanitized public projections using explicit eligibility rules. Unpublished/deleted/cancelled content and all private/admin fields are excluded.
6. It writes new immutable JSON objects to R2 and validates successful writes.
7. It updates mutable manifest/current pointers last, then purges the affected pointer URLs if configured.
8. It marks outbox events processed. Failed work is retryable with exponential backoff and a visible failure state.
9. Cache warming focuses on high-traffic homepage data and the most recently published/changed event, not every possible filter combination.

Time-dependent content also needs a scheduled rollover job in the existing backend orchestration. Evaluate today/tomorrow/this-week boundaries in Asia/Kolkata and advertisement start/end windows. Store event timestamps as UTC instants, but calculate display buckets using the configured India timezone.

Do not launch a second independent scheduler/queue product. Reuse the existing transactional outbox and backend job mechanism after confirming which processor is actually deployed. If no production processor exists, implement one on the existing free-tier Supabase/Cloudflare infrastructure and test retries before relying on it.

## 8. Search, filtering and event pagination

Preserve the existing product/API contract:

- Public event cards show event information and “View Details”; do not add pricing labels to event cards.
- Use “Book Ticket” only when an external booking URL exists. Open the sanitized external URL using Android Custom Tabs or the system browser.
- Preserve organizer-defined event detail sections in their stored order.
- Initial unfiltered Event Hub behavior remains configurable by Super Admin (currently 10 initially, then 5 more per action, unless changed by platform configuration).
- Past events use bounded loading and “Show More” behavior.
- Filters use indexed fields and constrained response projections.
- Search uses the existing indexed PostgreSQL search RPC where verified. Do not add Elasticsearch, Algolia or a separate search vendor.

For search/filter traffic:
- Debounce typing by approximately 300–400 ms.
- Start network search after a short minimum query length (initial target: 2 characters), then tune from observed request volume.
- Cancel the previous request when a new query is submitted.
- Select only fields needed for result cards; never use select-all on hot public endpoints.
- Cap result page size (initial target: 10–20), validate parameters server-side and avoid unbounded offsets/deep pagination.
- Do not cache search results at the shared CDN. Coalesce identical in-flight requests, but do not create persistent server-side caches for arbitrary filter combinations.
- Use Room data for immediate/offline display where available; refresh from the indexed query when online and display a stale/offline indicator when authoritative results cannot be refreshed.
- Do not silently represent a local, incomplete cache as the complete result set.

## 9. Free-tier budget and guardrails

Free-tier limits apply to the whole platform, not just the Android app. The app and Student Website share usage; Admin Website operations consume the same Supabase project quotas where applicable.

| Service/resource | Current free-plan planning envelope | Architectural rule |
|---|---|---|
| Supabase database | 500 MB database size per project | Monitor monthly; keep media and large payloads outside PostgreSQL |
| Supabase egress | Pricing distinguishes uncached and cached egress allowances (currently 5 GB each on the listed Free plan) | Use R2/CDN for public snapshots and images; track each egress metric separately |
| Supabase file storage | 1 GB | No public event-image delivery from Supabase Storage |
| Supabase Edge Functions | 500,000 invocations/month | Use for required server-side work only; no polling per app/device |
| Supabase Auth | 50,000 MAU | Student app has no student login, so it must not generate student auth sessions |
| Supabase Realtime | 2 million messages/month and 200 peak connections | No Realtime connection for public student browsing |
| Cloudflare R2 | 10 GB-month storage, 1 million Class A operations and 10 million Class B operations; internet egress free | Compact snapshots; cache at Cloudflare edge; avoid unnecessary object rewrites |
| Cloudflare Workers Free | 100,000 requests/day and 10 ms CPU time per invocation | Do not route normal snapshot, poster or image reads through a Worker |
| Cloudflare Pages static assets | Static asset requests/bandwidth are free under the documented Free plan | Keep the Student and Admin websites static; do not add a Pages Function per view |
| PostHog Analytics | 1 million analytics events/month on the current listed free allowance, shared with existing applications in the same project | Send a small whitelist of business events; reserve headroom for web and admin traffic |

The quotas above must be reconfirmed against the live account dashboard before release. Vendor plans change, and the actual organization settings are not visible from repository documentation alone.

Set internal warnings at 50% of each monthly quota, with a stricter red threshold around 70–75%. Preserve headroom rather than designing to 99% utilization. Track Supabase egress, DB size, Edge Function invocation count, R2 storage/operations, Cloudflare Worker request count and PostHog event volume. Do not enable a paid plan or automatic upgrade as a response to quota alerts.

Where a free service has a hard limit, degrade safely: serve cached public content, slow or disable nonessential analytics, avoid background refresh, and show clear retry behavior for search. Never switch to a paid provider automatically. Quota monitoring cannot prevent abuse of every publicly exposed anonymous endpoint; public read permissions must remain narrowly scoped, rate limits must be tested, and the expected traffic envelope must be validated with staging/load tests.

## 10. Security boundaries

- The Supabase anon/publishable key is client-visible by design. Treat it as public; protect data with RLS and least-privilege grants.
- Never embed the Supabase service-role key, R2 secret access key, Cloudflare API token, private API credentials or database credentials in the APK or any frontend build.
- The snapshot builder is server-side and must use explicit public-projection queries and eligibility tests; do not assume RLS will constrain privileged service-role reads.
- The snapshot bucket may be publicly readable only for approved public JSON objects. There must be no public write/list capability.
- Never place admin, organizer-membership, audit, access-request, private media metadata, outbox or background-job data in a public snapshot.
- Use HTTPS only. Disallow cleartext network traffic in release builds.
- Validate all URLs before opening external destinations and allow only safe schemes such as https/http.
- The public app does not need persistent authentication tokens, user identities or a student profile.
- Strip tokens, full request headers, private payloads and personally identifiable data from telemetry.

## 11. Telemetry without exhausting free limits

- Continue using the existing PostHog project, with persistent app property value student-android. Do not create a new paid analytics project.
- Capture only defined product events: app opened, event viewed, search submitted, filter selected, category opened, registration link clicked, and ad click/impression where measurement is required.
- Disable noisy automatic event capture initially; never emit events on every recomposition or repeated list render.
- Deduplicate ad impressions by a documented visibility rule and session/time window.
- Keep the combined Student Website, Admin Website and Android event volume comfortably below the shared monthly allowance. Alert at 50%; sample or disable nonessential events if needed.
- Add Sentry Android crash/error reporting only after confirming the existing plan's remaining quota. Start with crash/error reporting and conservative performance sampling; do not enable replay or high-volume traces by default.
- Microsoft Clarity has a native Android SDK, but mobile capture should be an explicit later decision after privacy/consent, data masking, network budget and plan allowance are reviewed. It is not required for the app's core operation.
- Keep Better Stack monitoring on a small number of high-value endpoints; do not ping backend health from each device.

## 12. Native UI and performance requirements

- Use adaptive Compose layouts for small, medium and large phone screens and tablets; do not encode one fixed device width.
- Use LazyColumn/LazyRow with stable item keys; avoid rendering the entire catalogue at once.
- Use image-size variants and Coil disk/memory cache; do not download full-size posters into card thumbnails.
- Use placeholders and explicit loading, empty, offline, stale and error states. A failed fetch must not turn a populated cache into an empty screen.
- Implement native back navigation, deep links to event details, accessible content descriptions, dynamic font scaling, dark/light theme behavior and correct Android system-bar insets.
- Optimize release builds with R8 and a Baseline Profile after core journeys are stable. Measure cold start, homepage rendering, event-card scroll jank, image decode time and network requests on low/mid-range devices.
- No forced splash delay, no needless blocking animation, no WebView as a rendering shortcut.

## 13. Testing and release gates

Before public distribution, require:

1. Unit tests for resource-version comparison, response models, URL validation, cache freshness and invalidation dependency calculations.
2. Room DAO and migration tests, including upgrades from previous schema versions.
3. Contract tests for snapshot schema versions, eligibility filtering and malformed/partial JSON.
4. API tests for RLS, search limits, bounded queries and error mapping.
5. Offline/slow-network tests: cold start with an existing cache, opening a cached event, cache refresh failure, manual retry and stale indicators.
6. Duplicate-request tests proving one in-flight snapshot request is shared across concurrent observers.
7. UI tests for small widths, large font sizes, rotation/resume, deep links, bottom navigation and long event descriptions.
8. Load and quota tests using realistic combined web + app request patterns. Verify R2/CDN cache-hit behavior and confirm Supabase egress is within budget.
9. Release security check proving no service-role/R2/Cloudflare secrets are in the APK or source bundle.
10. Physical-device validation on a low/mid-range Android phone plus at least one emulator before generating the release APK/AAB.

Android builds should happen locally in Android Studio initially. Keep CI to Kotlin/static checks and unit tests unless an Android emulator workflow has a justified free-minute budget. Direct APK distribution can be used for zero-fee pilot testing; Google Play/Apple distribution fees are outside the software-stack budget.

## 14. Implementation phases

**Phase 0 — Verify the real deployment path.** Inspect the Student Website production base URL, Cloudflare DNS/routes/cache rules, public response headers and cache-hit ratios. Reconcile direct Supabase calls in the shared client with the documented edge-cache intent. Verify which outbox worker is running in production. Do not duplicate a cache layer that already works.

**Phase 1 — Establish a tested public content projection.** If no usable CDN cache is already deployed, implement a versioned R2 JSON snapshot read model driven by the existing transactional outbox. Validate public eligibility, manifest publication order, targeted invalidation, retries and fallback TTLs. Route the Student Website and Android app to the same approved public read path over time so platform-wide Supabase egress is actually reduced.

**Phase 2 — Android foundation.** Create the native project in the existing monorepo using Android Studio/Gradle, establish Kotlin models, Room schema/migrations, API clients, repository boundaries, DI and build flavors.

**Phase 3 — Core discovery.** Build native Home, Explore, event detail, categories, media rendering, external registration actions, native navigation and cache-first loading.

**Phase 4 — Reliability.** Add bounded search/filter requests, offline/error handling, URL validation, analytics budget controls, crash monitoring and performance baselines.

**Phase 5 — Quota and release validation.** Run combined website/app load tests, review service dashboards, test cache invalidation and expiry, verify no paid dependency is enabled, and produce a release build.

## 15. Acceptance criteria

The architecture is acceptable for the first release only if:

- The app is a native Kotlin/Compose Android app built and debugged in Android Studio; there is no Expo, React Native or WebView wrapper.
- Admin-published changes reach the app through the documented version/invalidation path without rebuilding or manually republishing the APK.
- PostgreSQL is the only authoritative database and the Admin Website remains the content-management surface.
- The homepage and event detail can render from Room cache without waiting for the network; offline/stale states are explicit.
- Repeated opens of unchanged public content do not repeatedly read that content from Supabase.
- Every public data transfer has a bounded response shape; search/filter requests are debounced, cancellable and paginated.
- Search results and arbitrary filter combinations are not publicly cached at the shared CDN.
- Public images use the existing R2/Cloudflare path and have bounded image sizes.
- No public read flow is routed through a Worker unless measured request usage fits within the quota with adequate headroom.
- RLS and public snapshot eligibility tests prove that private/unpublished/admin data cannot leak.
- Platform-wide quota dashboards and 50% alerts exist before broader rollout.
- No new paid service or automatic paid upgrade is required for build, test and pilot distribution.

## References

- Existing LPU Events architecture docs: docs/technical/CACHING_ARCHITECTURE.md, docs/technical/FREE_TIER_CAPACITY.md, docs/technical/API_CONTRACTS.md and docs/technical/TECH_STACK.md.
- Android architecture recommendations: https://developer.android.com/topic/architecture/recommendations
- Room: https://developer.android.com/training/data-storage/room
- Paging from network and database: https://developer.android.com/topic/libraries/architecture/paging/v3-network-db
- Compose performance: https://developer.android.com/develop/ui/compose/performance
- Supabase pricing: https://supabase.com/pricing
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- PostHog pricing: https://posthog.com/pricing
