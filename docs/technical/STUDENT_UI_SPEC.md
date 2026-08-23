# LPU Events — Student Website UI Specification

**File:** `docs/technical/STUDENT_UI_SPEC.md`  
**Status:** LOCKED — Student Website UI Baseline  
**Version:** 1.0  
**Date:** 14 August 2026

---

# 1. Purpose

This document defines the complete UI and UX behavior of the LPU Events Student Website.

The Student Website is a public event-discovery platform.

It is intentionally separate from the Admin Website.

The Student Website does **not** provide:

- Ticket booking.
- Ticket reservation.
- Seat selection.
- Payment processing.
- Refunds.
- Ticket generation.
- QR-code generation.
- Ticket verification.
- Organizer scanning.
- Student accounts.
- Student authentication.

If an event requires registration, the Student Website redirects the student to the organizer-provided external registration URL.

---

# 2. Product Boundary

The Student Website has one primary responsibility:

> Help students discover LPU events and reach the appropriate external registration destination.

The architecture is:

```text
Student
   ↓
Student Website
   ↓
Discover Event
   ↓
View Event Details
   ↓
Click Register / External Registration
   ↓
Organizer's External Platform
```

LPU Events does not own the external registration transaction.

---

# 3. Applications

There are two separate websites:

```text
Student Website
Admin Website
```

This document applies only to:

```text
apps/student-web
```

The Admin Website has its own UI specification.

---

# 4. Authentication

The Student Website does not require authentication.

There is:

* No student login.
* No student signup.
* No student OTP.
* No Google Sign-In.
* No student profile account.

The student may browse public content anonymously.

---

# 5. Primary User Goals

The interface must allow a student to:

1. Discover upcoming events.
2. See what is happening today.
3. Search for an event.
4. Filter events.
5. Browse categories.
6. Open an event.
7. Understand when and where it occurs.
8. Read event information.
9. Identify whether registration is required.
10. Open the organizer's external registration page.

---

# 6. Primary Navigation

The Student Website should provide simple navigation.

Primary destinations:

```text
Home
Events
Categories
Past Events
```

The exact navigation presentation may adapt to viewport size.

The interface must not expose Admin navigation.

---

# 7. Route Structure

Recommended public routes:

```text
/
 /events
 /events/:eventId
 /categories
 /categories/:categoryKey
 /past-events
 /search
```

Additional routes may be introduced only when justified by product requirements.

---

# 8. Invalid Event ID

If an event ID does not exist:

```text
404 Event Not Found
```

The page should provide a useful path back to:

* Homepage.
* Events Hub.
* Search.

Do not expose database errors.

---

# 9. Deleted Event

If an event is deleted after the student has loaded an old link:

```text
Event unavailable
```

The Student Website must not display stale event information as if it were still active after receiving an authoritative not-found response.

---

# 10. Homepage

The homepage contains:

```text
Header
Hero Carousel
Advertisement
Happening Today
Filter Bar
Events Hub
Additional public sections as configured
```

The layout is responsive.

---

# 11. Header

The homepage includes:

```text
LPU Events Logo
Search
Notifications
Dark / Light Mode
Profile Area
```

Because students are anonymous:

### Profile Area

The profile area must not imply a student account system.

If a profile/settings interface is eventually required, it must be explicitly specified as a separate feature.

For the current baseline, the profile area is a presentation/navigation element only and must not introduce authentication.

---

# 12. Logo

The LPU Events logo must link to:

```text
/
```

The logo must have accessible alternative text.

---

# 13. Search

Search is available from the main header.

The search interface must support:

* Event name search.
* Case-insensitive matching.
* Partial matching.
* Safe normalization of whitespace.
* Relevant filtering.

Search must not expose private or non-published events.

---

# 14. Search Behavior

Recommended interaction:

```text
User enters query
      ↓
Debounce
      ↓
Normalize query
      ↓
Request search
      ↓
Display results
```

The UI must not send a request for every keystroke.

---

# 15. Search Debounce

The debounce duration must be configurable through the application configuration.

A reasonable initial value is:

```text
300 ms
```

The implementation must prevent overlapping stale requests from replacing newer search results.

---

# 16. Search Request Race Protection

Example:

```text
User searches:
"hack"

then immediately:
"hackathon"
```

If the `hack` response arrives after `hackathon`, it must not overwrite the newer result.

Use:

* Request cancellation, or
* Request sequence IDs, or
* Equivalent race protection.

---

# 17. Search Empty State

If no results exist:

```text
No events found
```

Provide useful guidance such as:

```text
Try a different keyword or remove filters.
```

Do not show a blank page.

---

# 18. Search Error State

If search fails:

```text
Unable to load search results.
```

Provide a retry action.

Do not display raw API/database errors.

---

# 19. Notifications

The current Student Website does not require a student notification backend.

Therefore notifications must not imply:

* Personalized notification storage.
* Read/unread notification accounts.
* Authenticated notification history.

If the visual header includes a notification icon, its behavior must be explicitly defined before implementation.

No fake notification system should be implemented merely to fill the UI.

---

# 20. Theme

The Student Website supports:

```text
Light Mode
Dark Mode
```

The theme must:

* Respect the user's system preference initially.
* Allow manual switching.
* Persist the preference locally.
* Avoid causing a visible flash between themes where practical.

Theme preference is local UI state and is not stored in PostgreSQL.

---

# 21. Hero Carousel

The homepage may contain a hero carousel.

The carousel is a presentation component.

It does not own advertisement analytics.

Carousel configuration comes from the backend.

---

# 22. Carousel Rules

Carousel items may contain configured public content such as:

* Events.
* Memories.
* Promotional content.
* Other approved carousel content defined by the Admin Website.

The carousel must display only currently eligible items.

---

# 23. Carousel Rotation

The carousel must:

* Support manual navigation.
* Support automatic rotation where enabled.
* Pause automatic movement when the user interacts.
* Respect reduced-motion preferences.
* Not rotate excessively quickly.

---

# 24. Carousel Accessibility

Users must be able to:

* Identify the current slide.
* Move forward/backward.
* Pause automatic movement where applicable.
* Navigate without relying on color alone.

Keyboard interaction must be supported.

---

# 25. Advertisement Bar

Advertisements are separate from the Homepage Carousel.

The advertisement system may appear in configured positions:

```text
homepage_top
homepage_feed
event_top
event_bottom
```

The Student Website only renders advertisements that are currently active and eligible.

---

# 26. Advertisement Click

Clicking an advertisement navigates to its configured external destination.

The destination is obtained from the trusted advertisement record.

The browser must not construct an arbitrary redirect URL from user input.

---

# 27. Advertisement Expiry

If an advertisement expires:

```text
end_at <= current time
```

it must not be displayed in newly generated content.

Existing cached representations are invalidated through the caching architecture.

---

# 28. Homepage Feed Advertisements

Advertisements may appear among event cards.

Super Admin configures the interval.

Example:

```text
After every 5 event cards
```

The placement rule must remain consistent throughout the feed.

---

# 29. Feed Insertion Example

If:

```text
event_interval = 5
```

the conceptual sequence is:

```text
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

The exact implementation must not duplicate advertisements unintentionally when additional events are loaded.

---

# 30. Show More

The Events Hub initially displays a configurable number of event cards.

Default:

```text
10 events
```

Each Show More action loads:

```text
5 additional events
```

The initial count and increment are configurable by Super Admin.

---

# 31. Show More Loading

When Show More is clicked:

```text
Button
   ↓
Loading state
   ↓
Fetch next batch
   ↓
Append results
```

Existing event cards must remain visible.

Do not replace the entire list with a loading skeleton.

---

# 32. Double Click Protection

Repeated Show More clicks while a request is active must not generate duplicate requests.

The button should be temporarily disabled or the request otherwise deduplicated.

---

# 33. End of Events

When no more events are available:

```text
No more events
```

The Show More control should disappear or become inactive.

Do not continue making requests that are guaranteed to return nothing.

---

# 34. Pagination Strategy

The Student Website should use cursor/keyset pagination where practical.

Avoid deep offset pagination for large event collections.

The API contract determines the exact pagination format.

---

# 35. Event Ordering

Upcoming event lists should use deterministic ordering.

Primary ordering:

```text
start_at ASC
```

A stable secondary ordering should be used to prevent inconsistent pagination when two events share the same start time.

Example:

```text
start_at ASC
id ASC
```

---

# 36. Happening Today

The homepage includes:

```text
Happening Today
```

An event belongs in this section according to the platform's business timezone:

```text
Asia/Kolkata
```

The browser's local timezone must not determine the classification.

---

# 37. Happening Today Boundaries

The UI must handle:

* Events starting today.
* Events ending today.
* Events spanning midnight.
* Events that started earlier today but are still running.

The final inclusion logic is defined by the backend.

The frontend must not independently reimplement conflicting date classification logic.

---

# 38. Tomorrow

The Tomorrow section uses the same business timezone:

```text
Asia/Kolkata
```

The frontend receives already-qualified results from the backend.

---

# 39. This Week

The This Week section uses the platform's defined business-week logic.

The Student Website must not use the browser's locale to redefine the week.

---

# 40. Past Events

Past events are displayed separately.

The Past Events section supports Show More behavior.

The default and incremental counts follow the same configurable system unless the Admin Website explicitly configures separate values.

---

# 41. Past Event Definition

Past/completed status comes from the backend lifecycle.

The frontend must not permanently mark events as completed based only on its local clock.

---

# 42. Event Card

Every event card should communicate the essential information quickly.

Recommended fields:

```text
Banner / Image
Event Name
Date
Time
Venue
Category
Registration status/type where applicable
```

Do not overload cards with long descriptions.

---

# 43. Event Card Interaction

Clicking an event card opens:

```text
/events/:eventId
```

The entire card may be clickable, but interactive child controls must remain independently usable.

---

# 44. Event Card Accessibility

Cards must have:

* Keyboard accessibility.
* Visible focus state.
* Semantic link/button behavior.
* Meaningful accessible names.

Avoid clickable `<div>` elements when a semantic `<a>` is appropriate.

---

# 45. Event Image

If a banner exists:

```text
display banner
```

If no banner exists:

```text
display approved fallback
```

Broken image URLs must not result in an ugly browser broken-image state.

---

# 46. Event Detail Page

The event detail page contains:

```text
Event Banner
Event Name
Date
Time
Venue
Advertisement Bar
About the Event
Registration Action
Additional Event Cards
```

---

# 47. Event Detail Header

The primary event information should be visually prominent.

At minimum:

```text
Event Name
Date
Time
Venue
```

The student should understand the basic event information without reading the entire description.

---

# 48. About the Event

The About section displays the structured event content defined by the backend.

Content must be safely rendered.

Untrusted HTML must never be inserted directly.

---

# 49. External Registration

If:

```text
registration_mode = EXTERNAL
```

the page displays a clear registration action.

Example label:

```text
Register Now
```

The button opens the organizer-provided external registration destination.

---

# 50. No Internal Registration

The Student Website must never display a fake internal checkout.

There must be no UI for:

```text
Select ticket
Choose seat
Pay
Confirm booking
Download ticket
```

---

# 51. Free Events

 A free event may still use external registration.

Therefore:

```text
FREE
```

does not mean:

```text
No registration required
```

The registration mode determines the registration action.

---

# 52. Paid Events

A paid event may be marked:

```text
PAID
```

but the Student Website does not process the payment.

The student is redirected to the organizer's external platform.

---

# 53. Missing External URL

If the backend incorrectly returns:

```text
registration_mode = EXTERNAL
external_registration_url = null
```

the UI must not generate a broken link.

Display an appropriate unavailable state.

This condition should also be treated as a backend/data-integrity error.

---

# 54. External Link Safety

External links must:

* Use an allowed URL scheme.
* Be visually recognizable as external where appropriate.
* Never execute JavaScript.
* Use safe new-tab behavior if opened in a new tab.

---

# 55. Additional Event Cards

The event detail page may show additional event cards.

These must be based on public event data.

The current event should not unnecessarily appear as its own recommendation.

---

# 56. Related Event Logic

Related events may be selected using:

1. Same category.
2. Same subcategory.
3. Similar timing.
4. Other backend-defined relevance rules.

The frontend must not invent its own recommendation algorithm.

---

# 57. Category Navigation

Students can browse categories and subcategories.

Category data comes from the public taxonomy.

Inactive taxonomy items should not be shown as selectable public filters.

---

# 58. Filters

The Events Hub supports filtering according to available product filters.

Possible filters include:

```text
Category
Subcategory
Date
Event type
Pricing
```

Only filters explicitly supported by the API should be implemented.

---

# 59. Filter Dependency

Subcategory selection depends on category.

Example:

```text
Category = Technology
```

should show only subcategories belonging to Technology.

A stale/invalid subcategory selection must be cleared when its parent category changes.

---

# 60. Filter Application

Filter state must be deterministic.

Changing filters should:

* Reset pagination.
* Cancel obsolete requests.
* Fetch the correct result set.
* Preserve unrelated UI state.

---

# 61. Filter URL State

Where useful, filters should be represented in the URL.

Example:

```text
/events?category=technology&date=today
```

This enables:

* Shareable filtered pages.
* Browser back/forward behavior.
* Refresh persistence.

Only validated filter values may be accepted.

---

# 62. Invalid Filters

Unknown category/subcategory/filter values must not produce server errors.

The UI should either:

* Ignore invalid values.
* Normalize them.
* Display a safe empty state.

---

# 63. Loading States

Every network-driven section must have an intentional loading state.

Examples:

```text
Skeleton cards
Skeleton hero
Skeleton event detail
```

Avoid showing a completely blank page during normal loading.

---

# 64. Initial Page Loading

The homepage should prioritize above-the-fold content.

Recommended priority:

```text
Header
Hero
Happening Today / primary event content
```

Lower-priority sections may load progressively.

---

# 65. Partial Failure

A failure in one homepage section must not destroy the entire homepage.

Example:

```text
Sponsors API fails
```

The page should still display:

```text
Hero
Events
Categories
```

The failed section may display:

```text
Unable to load this section.
```

or be omitted where appropriate.

---

# 66. Event Detail Partial Failure

If the event itself loads but related events fail:

```text
Event details remain visible.
```

Do not replace the entire page with an error screen.

---

# 67. Global Failure

If the primary event API is unavailable:

```text
Unable to load events.
Try again.
```

Provide retry functionality.

---

# 68. Error Messages

Never expose:

```text
PostgreSQL error
Supabase error object
Stack trace
Cloudflare internal error
```

to students.

Use human-readable messages.

---

# 69. Empty Homepage

If there are no upcoming events:

```text
No upcoming events right now.
```

The homepage should remain useful through other public content where available.

---

# 70. Empty Category

If a category contains no events:

```text
No events found in this category.
```

Provide navigation back to all events/categories.

---

# 71. Responsive Design

The Student Website must support:

```text
Mobile
Tablet
Desktop
Large desktop
```

The layout must adapt rather than simply shrink desktop content.

---

# 72. Mobile Header

On smaller screens:

* Navigation may collapse.
* Search may become a dedicated interaction.
* Carousel height must remain controlled.
* Event cards should remain readable.
* Touch targets must be sufficiently large.

---

# 73. Mobile Event Cards

Avoid dense horizontal layouts that force unreadable text.

Cards should prioritize:

```text
Image
Name
Date
Time
Venue
```

---

# 74. Touch Targets

Interactive controls should provide comfortable touch targets.

Do not place tiny adjacent controls that are difficult to tap.

---

# 75. Accessibility

The Student Website must target WCAG 2.2 AA principles where practical.

Required:

* Keyboard navigation.
* Visible focus.
* Semantic HTML.
* Accessible names.
* Appropriate heading hierarchy.
* Sufficient color contrast.
* Alt text.
* Reduced-motion support.
* Accessible forms/search.
* Screen-reader-compatible state changes.

---

# 76. Reduced Motion

If the user requests reduced motion:

* Disable unnecessary carousel animation.
* Reduce transition effects.
* Avoid aggressive skeleton animation.
* Preserve functionality.

---

# 77. Typography

Typography must prioritize:

* Readability.
* Hierarchy.
* Responsive scaling.
* Consistent spacing.

Do not use excessive font sizes merely to create a "premium" appearance.

---

# 78. Visual Design

The Student Website should feel:

* Modern.
* Clean.
* Event-focused.
* Fast.
* Premium without being visually noisy.

Avoid:

* Excessive gradients.
* Excessive glowing effects.
* Excessive animation.
* Dense cards.
* Decorative elements that compete with event information.

---

# 79. Performance Budget

The Student Website should prioritize:

* Fast first render.
* Small initial JavaScript payload.
* Optimized images.
* Lazy loading below-the-fold media.
* CDN delivery.
* Cache reuse.

Do not load all events merely because the database contains them.

---

# 80. Image Performance

Images should support:

* Responsive dimensions.
* Appropriate compression.
* Modern formats where practical.
* Lazy loading for below-the-fold content.
* Explicit dimensions to reduce layout shift.

---

# 81. Layout Stability

Images and major components must reserve space before content loads.

Avoid cumulative layout shifts caused by:

* Images without dimensions.
* Late-loading advertisements.
* Fonts unexpectedly changing layout.
* Carousel resizing.

---

# 82. SEO

Public event pages should be indexable where appropriate.

Event detail pages should provide:

* Meaningful title.
* Description.
* Canonical URL.
* Structured metadata where appropriate.
* Open Graph metadata.
* Appropriate robots directives.

---

# 83. Event SEO

Event pages should use event-specific metadata:

```text
Event Name
Date
Venue
Description
```

Only public/published events should be exposed to search engines.

---

# 84. Deleted Event SEO

If an event is permanently removed:

* Return an appropriate not-found response.
* Remove it from generated public metadata.
* Avoid generating stale sitemap entries.

---

# 85. Sitemap

The public site may generate a sitemap containing:

* Homepage.
* Public event pages.
* Public category pages.
* Other indexable public pages.

Do not include:

* Admin pages.
* Private routes.
* Deleted events.
* Non-public resources.

---

# 86. Analytics

The Student Website uses the shared PostHog project defined by the platform architecture.

The persistent application property is:

```text
app = "student"
```

---

# 87. Analytics Events

Relevant analytics may include:

```text
page_view
event_view
event_search
filter_applied
event_registration_click
advertisement_click
carousel_interaction
show_more_events
theme_changed
```

Analytics must not contain unnecessary personal information.

---

# 88. Event Registration Analytics

The platform may record:

```text
event_registration_click
```

when the student clicks the external registration action.

This does not mean LPU Events owns the resulting registration.

---

# 89. Advertisement Analytics

Advertisement analytics remain separate from carousel behavior.

A carousel interaction must not automatically be counted as an advertisement click.

Only an actual advertisement interaction should produce the advertisement click event.

---

# 90. Analytics Failure

Analytics failure must never block the Student Website.

If PostHog is unavailable:

```text
Website continues functioning.
```

---

# 91. Privacy

The Student Website should minimize data collection.

Do not require:

* Student name.
* Student email.
* Student ID.
* Phone number.

for ordinary event browsing.

---

# 92. External Registration Privacy Boundary

Once the student clicks an external registration URL:

```text
LPU Events
      ↓
External Platform
```

The external platform's privacy policy governs subsequent data processing.

The LPU Events UI must not imply that the registration transaction occurs inside LPU Events.

---

# 93. Cache Integration

Public Student Website data follows `CACHING_ARCHITECTURE.md`.

Cacheable:

* Public event lists.
* Event details.
* Categories.
* Advertisements.
* Carousel.
* Sponsors.
* Memories.
* Search with short TTL.

Never publicly cache:

* Admin data.
* Authentication state.
* User-specific information.

---

# 94. Resource Version Synchronization

The Student Website may use resource versions such as:

```text
events_version
categories_version
ads_version
sponsors_version
carousel_version
memories_version
featured_version
```

If unchanged:

```text
No unnecessary download.
```

If changed:

```text
Refresh affected resource.
```

---

# 95. Stale Resource Protection

If a response has an older resource version than the client already holds, the client must not blindly overwrite newer local state.

Use version/sequence comparison.

---

# 96. Concurrent Resource Requests

If multiple requests for the same resource are active:

* Prefer request deduplication.
* Cancel obsolete requests.
* Do not allow older responses to overwrite newer state.

---

# 97. Date Rollover

At the platform's date boundary:

```text
Asia/Kolkata
```

the UI must refresh date-sensitive sections.

The frontend must not rely solely on the browser remaining open and automatically understanding the new day.

The synchronization/cache layer handles the authoritative refresh.

---

# 98. External Registration Failure

LPU Events cannot guarantee the external platform is operational.

If the browser cannot reach the external destination:

```text
The external registration service may be unavailable.
```

Do not display an LPU Events payment/booking failure message.

---

# 99. No Ticketing UI

The following UI elements are explicitly prohibited:

```text
Book Ticket
Reserve Ticket
Choose Seat
Pay Now
Payment Status
My Tickets
Download Ticket
QR Code
Check In
Refund
Cancellation of Ticket
```

unless the product architecture is explicitly changed in a future approved specification.

---

# 100. No Student Account UI

The following are not part of the current Student Website:

```text
My Profile
My Bookings
My Tickets
My Payments
My Registrations
Saved Events
Personal Notification History
```

Do not implement these as placeholders.

---

# 101. Security Boundary

The Student Website is an untrusted public client.

It must never:

* Write directly to protected tables.
* Execute privileged RPCs.
* Receive service-role credentials.
* Receive R2 private credentials.
* Modify resource versions.
* Modify cache invalidation state.
* Modify audit logs.

---

# 102. API Boundary

The frontend consumes only the API contracts defined in:

```text
docs/technical/API_CONTRACTS.md
```

Do not invent direct database operations in UI code.

---

# 103. Data Validation

The frontend may validate for UX.

The backend remains authoritative.

Example:

```text
Frontend validation
      +
Backend validation
      +
Database constraints
```

A malicious browser can bypass frontend validation.

Therefore UI validation is never a security control.

---

# 104. Navigation During Loading

If a student opens an event while data is loading and then navigates elsewhere:

* Cancel obsolete requests where practical.
* Do not update an unmounted/stale view.
* Preserve correct route state.

---

# 105. Browser Back/Forward

The interface should correctly preserve:

* Search query.
* Filters.
* Pagination state where practical.
* Theme preference.

Back navigation must not unexpectedly reset the entire discovery experience.

---

# 106. Deep Links

Every public event detail URL should work directly.

Example:

```text
/events/{eventId}
```

A student should not need to open the homepage first.

---

# 107. Refresh Behavior

Refreshing a public event page must:

* Reload authoritative public data.
* Preserve theme preference.
* Handle deleted/updated events correctly.
* Not require authentication.

---

# 108. Network Recovery

When connectivity returns after a failure:

* Retry failed public requests.
* Refresh stale resources where appropriate.
* Avoid repeatedly hammering the API.

---

# 109. Slow Network

The UI should remain understandable on slow networks.

Use:

* Skeletons.
* Progressive rendering.
* Image lazy loading.
* Retry controls.
* Avoid unnecessarily blocking unrelated sections.

---

# 110. Offline State

If offline behavior is implemented:

```text
Offline
```

must not be confused with:

```text
Live current data
```

Clearly indicate when displayed information may be stale.

---

# 111. Component Architecture

Components should be organized around product responsibilities.

Example:

```text
components/
├── layout/
├── header/
├── search/
├── carousel/
├── advertisements/
├── events/
├── filters/
├── categories/
├── memories/
├── sponsors/
└── common/
```

The exact directory structure may evolve without changing product behavior.

---

# 112. State Ownership

Prefer local state for local UI concerns.

Examples:

```text
Theme → local persistence
Carousel position → component state
Search input → search state
Filters → URL/page state
Server event data → server/API state
```

Do not place every piece of state into one global store.

---

# 113. Server State

Server state must be treated separately from UI state.

Examples:

```text
Events
Categories
Advertisements
Sponsors
Carousel
Memories
```

should use a consistent server-state/data-fetching strategy.

Do not duplicate the same server resource independently in many unrelated components.

---

# 114. Duplicate Requests

The application should avoid:

```text
Header requests categories
Filter requests categories
Homepage requests categories
```

independently when a shared request/cache can safely provide the same resource.

---

# 115. UI Error Boundary

Unexpected React errors should be contained.

A component failure should not unnecessarily crash the entire application.

Provide a safe recovery mechanism.

---

# 116. Accessibility Error States

Error and loading changes must be understandable to screen readers.

Use appropriate live-region/state semantics where needed.

---

# 117. Security Review — UI Loophole Pass 1

Initial UI review identified:

## Loophole A — Student Website accidentally becomes ticketing system

**Fix:** Explicitly prohibit all internal ticket/payment UI.

## Loophole B — Student profile implies authentication

**Fix:** No student account model.

## Loophole C — Frontend determines event lifecycle

**Fix:** Backend is authoritative.

## Loophole D — Search response race

**Fix:** Request cancellation/sequence protection.

## Loophole E — Show More double-click

**Fix:** Request deduplication/loading lock.

## Loophole F — Expired advertisement remains visible

**Fix:** Backend eligibility + cache invalidation.

---

# 118. Security Review — UI Loophole Pass 2

## Loophole G — Event moved between categories

**Fix:** Backend results + resource synchronization prevent stale category state.

## Loophole H — Deleted event remains open

**Fix:** Authoritative detail request determines availability.

## Loophole I — Student opens private event URL

**Fix:** Public API returns only publicly eligible events.

## Loophole J — External URL manipulation

**Fix:** Destination comes from trusted event/advertisement data.

## Loophole K — Rich-text XSS

**Fix:** Sanitization and safe rendering.

## Loophole L — Public cache contains private response

**Fix:** Student Website only consumes explicitly public representations.

---

# 119. UX Review — Loophole Pass 3

## Loophole M — Midnight changes Today

**Fix:** Asia/Kolkata date rollover and resource refresh.

## Loophole N — Partial homepage failure destroys entire page

**Fix:** Independent section loading/error boundaries.

## Loophole O — Advertisement insertion duplicates after Show More

**Fix:** Placement calculated from global feed position, not each batch independently.

## Loophole P — Old search response overwrites new search

**Fix:** Request sequence/cancellation.

## Loophole Q — Event image causes layout shift

**Fix:** Reserved media dimensions.

## Loophole R — Infinite Show More requests

**Fix:** Cursor/end-of-results state.

---

# 120. Final UI Review

The final architecture must preserve these invariants:

```text
Public discovery
        ↓
No student authentication
        ↓
No internal booking
        ↓
No internal payment
        ↓
External registration only
```

and:

```text
Backend
   ↓
Authoritative event state
   ↓
Student UI
```

The frontend must never become the authority for event lifecycle, registration eligibility, or access control.

---

# 121. Student Website Definition of Done

The Student Website UI is complete only when:

* [ ] Homepage implemented.
* [ ] Header implemented.
* [ ] Search implemented.
* [ ] Theme switching implemented.
* [ ] Hero carousel implemented.
* [ ] Advertisement positions implemented.
* [ ] Happening Today implemented.
* [ ] Filters implemented.
* [ ] Events Hub implemented.
* [ ] Configurable initial event count implemented.
* [ ] Show More implemented.
* [ ] Past Events implemented.
* [ ] Event cards implemented.
* [ ] Event detail page implemented.
* [ ] External registration implemented.
* [ ] No internal ticket/payment UI exists.
* [ ] Category/subcategory navigation works.
* [ ] Loading states exist.
* [ ] Empty states exist.
* [ ] Error states exist.
* [ ] Responsive behavior verified.
* [ ] Accessibility verified.
* [ ] SEO verified.
* [ ] Analytics integrated.
* [ ] Public caching integrated.
* [ ] Resource-version synchronization integrated.
* [ ] Date rollover behavior verified.
* [ ] External-link behavior verified.
* [ ] Security review completed.

---

# 122. Manual Verification Requirements

After implementation, the developer must manually verify at minimum:

### Homepage

* Hero works.
* Advertisements appear in correct positions.
* Today section is correct.
* Event cards load correctly.
* Show More adds the correct number of cards.
* Ads do not duplicate after Show More.

### Search

* Case-insensitive search.
* Partial search.
* Empty results.
* Search request race behavior.
* Filter combinations.

### Event Detail

* Correct event information.
* Correct banner.
* About content renders safely.
* External registration link works.
* Missing external URL does not produce a broken action.
* Deleted event produces correct unavailable state.

### Responsive

Verify:

* Mobile.
* Tablet.
* Desktop.

### Theme

Verify:

* Light.
* Dark.
* Refresh persistence.
* System preference.

### Accessibility

Verify:

* Keyboard navigation.
* Focus visibility.
* Screen-reader labels.
* Reduced motion.
* Contrast.

---

# 123. Final Student Website Architecture

```text
                         STUDENT
                            │
                            ▼
                    Student Website
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
       Discover           Search          Categories
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                            ▼
                       Event Detail
                            │
                  registration required?
                       /            \
                     NO              YES
                     │                │
                     ▼                ▼
                 View Event      External URL
                                      │
                                      ▼
                              Organizer Platform
```

LPU Events ends its registration responsibility at the external-link boundary.

---

# 124. Final Rules

The following rules are non-negotiable unless this document is explicitly changed:

1. Student Website is public.
2. Student Website does not require authentication.
3. Student Website has no student account system.
4. Student Website has no internal ticket booking.
5. Student Website has no internal payment processing.
6. Registration happens externally.
7. Public content comes from authoritative backend APIs.
8. Frontend validation is not security.
9. Public data may be cached.
10. Private data must not enter public caches.
11. Event lifecycle is backend-controlled.
12. Date classification uses Asia/Kolkata.
13. Advertisement placement follows server configuration.
14. Show More must not duplicate or skip events.
15. Search must be race-safe.
16. Partial section failures must not destroy the entire homepage.
17. Analytics failure must never block the website.
18. External registration failure is not treated as an LPU Events booking failure.
19. No feature should silently introduce authentication or ticketing.
20. Any new public feature must define its API, cache, security, accessibility, and failure behavior.

---

# 125. Status

**STUDENT_UI_SPEC.md is the canonical UI/UX baseline for the LPU Events Student Website.**

Implementation must conform to this specification.

Any feature that is not defined here must be treated as a new product requirement rather than being invented during implementation.
