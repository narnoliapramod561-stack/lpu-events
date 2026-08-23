# LPU Events — Phase 5 Student Website UI Integration

**File:** `docs/technical/PHASE_5_STUDENT_WEBSITE_INTEGRATION.md`  
**Status:** COMPLETE  
**Final Status:** `READY FOR PHASE 6`  
**Date:** 14 August 2026  

---

## 1. Context & `copyui.jsx` Location

We located `copyui.jsx` in the parent directory of the monorepo at [`../copyui.jsx`](file:///Users/subhamkumar/Desktop/lpu1/copyui.jsx). This file contains the pre-existing visual theme, responsive layout, Framer Motion animations, Lucide icons, and grid interactions for the LPU Events Student Discovery Website.

---

## 2. Refactored React Components

To ensure code maintainability and typescript safety, we refactored the template into modular React components under [`apps/student-web/src/components/`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/apps/student-web/src/components/):
* [`Navbar.tsx`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/apps/student-web/src/components/Navbar.tsx): Handles logo layout, search suggestions with backend trigram query autocomplete, and light/dark theme toggles.
* [`HeroCarousel.tsx`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/apps/student-web/src/components/HeroCarousel.tsx): Cycles through featured events and sponsored advertisements using Framer Motion. Removed ticket pricing elements and mapped CTAs to `"View Details"`.
* [`HappeningTodaySlider.tsx`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/apps/student-web/src/components/HappeningTodaySlider.tsx): Stacks event cards running today. Removed pricing labels.
* [`CategoryFilter.tsx`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/apps/student-web/src/components/CategoryFilter.tsx): Filters by Event Schedule date (Today, Tomorrow, This Week, Upcoming) or Category taxonomy. Grouped LPU school lists are displayed for the "Schools" category.
* [`EventGrid.tsx`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/apps/student-web/src/components/EventGrid.tsx): Main grid rendering `EventCard` and `AdBannerCard`. Changed card-level CTAs to `"View Details"`. Removed all ticket/pricing text labels.
* [`EventDetailsModal.tsx`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/apps/student-web/src/components/EventDetailsModal.tsx): Overlay modal displaying event details, structured description sections (Timeline, Rules, etc.), registration format and participation-fee information, and external registration CTA.

---

## 3. Real Data Integration

We bound the frontend states to the typed `lpuClient` (initialized in [`apps/student-web/src/supabase.ts`](file:///Users/subhamkumar/Desktop/lpu1/lpu-events/apps/student-web/src/supabase.ts)):
* **Taxonomies**: `lpuClient.fetchCategories` loads categories and subcategories on mount.
* **Featured Feed**: `lpuClient.fetchHomepageCarousel` and `lpuClient.fetchFeaturedEvents` supply the carousel slides.
* **Discovery Feed**: `lpuClient.fetchEventFeed` queries upcoming published events, applying category and subcategory filters.
* **Search**: `lpuClient.searchEvents` calls the database prefix-first matching RPC, powering suggestion lists.
* **Ads & Carousel**: `lpuClient.fetchActiveAdvertisements` loads banners and cards.
* **Memories**: `lpuClient.fetchEventMemories` loads published memory cards.
* **Sponsors**: `lpuClient.fetchSponsors` loads active sponsors.
* **Configurable Settings**: `lpuClient.fetchGlobalSettings` loads initial page limit (default 10), increment size (default 5), and ad intervals (default 6) configured by Super Admins.

---

## 4. Locked Boundaries & Hard Rules Verification

### 4.1 Card Pricing Constraint (CRITICAL)
* **Rule**: Card grids and list carousels must not display pricing.
* **Fix**: Removed `{event.price}` and pricing tags from `EventCard`, `HappeningTodaySlider`, and `HeroCarousel` slides. All registration format and participation-fee details are displayed exclusively in the `EventDetailsModal`.

### 4.2 Ticketing & Booking Boundary (CRITICAL)
* **Rule**: No internal payments, booking, inventory reservations, or ticket generation.
* **Fix**: Changed all CTA text labels to `"View Details"`. Clicking `"View Details"` opens the modal showing external registration rules. Clicking the main button on the modal redirects the student externally using a standard anchor tab redirect (`window.open(event.external_registration_url, "_blank")`).

### 4.3 Student Auth Isolation
* **Rule**: No signup/login controls, profiles, or cookies.
* **Fix**: The student portal contains no auth hooks or state. All endpoints execute under the public `anon` role, filtered by active published RLS policies.

### 4.4 Past Events Selection
* **Rule**: Events are classified as past solely based on `end_at < now()`.
* **Fix**: Programmed past events listing section by calling `fetchEventFeed({ show_past: true })` which queries database records using `lt('end_at', now)`.

---

## 5. Caching & Cdn Efficiencies

* **Requests minimization**: Data is cached and queries are triggered only when search values or active categories change.
* **Response caching**: Avoids aggression. No polling or websocket subscriptions are used.

---

## 6. Verification Results

* Supabase migrations test suite reset: `npx supabase db reset` -> **Exited with code 0** (Success).
* TypeScript typecheck: `npm run typecheck` -> **Exited with code 0** (Success).
* Production builds compile: `npm run build:student && npm run build:admin` -> **Exited with code 0** (Success).
* Tailwind styling compilation: Compiled using Vite 5 plugin `@tailwindcss/vite` -> **Built successfully**.
