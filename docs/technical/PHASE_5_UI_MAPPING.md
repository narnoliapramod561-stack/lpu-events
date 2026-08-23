# LPU Events — Phase 5 Student Website UI Mapping

**File:** `docs/technical/PHASE_5_UI_MAPPING.md`  
**Status:** COMPLETE  
**Auditor Identity:** Antigravity  
**Date:** 14 August 2026  

This document evaluates the existing UI structure in `copyui.jsx` and defines the mapping, modifications, and alignments required to match the canonical LPU Events Product Requirements Document (PRD).

---

## 1. UI Component Inventory & Study

| UI Section | Source Component in `copyui.jsx` | Elements and Local State | Mock Data Source |
| :--- | :--- | :--- | :--- |
| **Header / Navbar** | `Navbar` (lines 310–456) | Logo, Search bar with autocomplete suggestions, Light/Dark theme toggle. | `mockEvents` for autocomplete search. |
| **Hero / Carousel** | `HeroCarousel` (lines 458–740) | Slides showing Featured Events and Sponsored Advertisements. | `mockEvents` (filtered by `isFeatured`), `mockAds`. |
| **Happening Today** | `HappeningTodaySlider` (lines 742–905) | Stacks of event cards currently running today. | `mockEvents` (filtered by current date between `startDate` and `endDate`). |
| **Event Categories** | `CategoryFilter` (lines 1030–1140) | Event Schedule filter pill list + Category/Subcategory buttons. | `categories` and `schoolGroups` taxonomy. |
| **Event's Hub** | `EventGrid` (lines 1302–1383) | Main grid of events + inline advertisement injections. | `mockEvents`, `mockAds`. |
| **Footer** | Footer (lines 1614–1643) | LPU Events branding info, Explore links, Help links, and Legal links. | Hardcoded text. |

---

## 2. Canonical Product Requirements Mapping & Gap Analysis

### 2.1 UI Modifications to Satisfy Pricing Constraints (CRITICAL)
> [!IMPORTANT]
> **Hard Product Rule:** Event cards and grids MUST NOT display pricing labels (e.g., `₹499`, `Free`) or booking CTA texts.
* **Discrepancy in `copyui.jsx`**:
  - `EventCard` (lines 1210–1227) displays `{event.price}` and has a `"Book Ticket"` button.
  - `HeroCarousel` (line 672) displays `{currentSlide.price}` next to the slide button.
* **Hardening Correction**:
  - Remove all price label displays from the homepage grids, carousel, and Happening Today sections.
  - Change all card-level CTA buttons from `"Book Ticket"` or `"Register Now"` to **`"View Details"`**.
  - All pricing and registration formats will be displayed exclusively on the **Event Details** view/modal.

### 2.2 Registration & Booking Boundary
> [!IMPORTANT]
> **Hard Product Rule:** No internal ticketing, reservations, payments, or checkout flows exist.
* **Discrepancy in `copyui.jsx`**:
  - The CTA buttons say `"Book Ticket"`, implying a checkout workflow.
* **Hardening Correction**:
  - Clicking `"View Details"` navigates to or opens the Event Details view.
  - The Event Details view displays the organizer-provided external registration info.
  - Clicking the primary registration CTA on the Event Details view performs a clean window redirect (`window.open(external_registration_url, '_blank')`) to the external destination.

### 2.3 Events Hub & Past Events
* **Discrepancy in `copyui.jsx`**:
  - `App` has no separate Past Events section. It only displays all events in a single grid.
  - Limits and Show More increments are hardcoded in the local state.
* **Hardening Correction**:
  - **Events Hub**: Initially queries the configured number of published events (default 10). "Show More" loads additional events (default 5).
  - **Past Events**: Introduce a dedicated Past Events section. An event is classified as "Past" if and only if `end_at < now()` (where `now()` is the current client timestamp). Implement a "Show More" button for Past Events.

### 2.4 Event Details View
* **Discrepancy in `copyui.jsx`**:
  - `copyui.jsx` does not contain an Event Details view. It only outputs the main homepage grid.
* **Hardening Correction**:
  - Build a beautiful, responsive Event Details view/modal matching the styling conventions (blur cards, gradient borders, Outward typography) of the homepage.
  - Include: Banner, Event name, Category/Subcategory, Date/Time, Venue Name, About the Event (rendered from sections), Organizer info, Registration pricing details (Free/Paid), Registration format (Individual/Team), and the Redirect CTA button.

---

## 3. Existing UI vs PRD Exceptions

### EXISTING UI — REQUIRES PRODUCT DECISION
* **School Category Drawer Groupings** (`schoolGroups`, lines 29–75): `copyui.jsx` implements a complex multi-column list grouping LPU schools by department (Engineering, Arts, Business, Allied Health) when the "Schools" category is selected. 
  * *Status*: Retained to preserve the existing UI styling faithfully, but mapped to direct taxonomy category matches.

### PRD REQUIREMENT — UI MISSING
* **Past Events Section**: `copyui.jsx` is missing a past events list.
  * *Status*: Added as a new section below the Events Hub.
* **Event Details View**: `copyui.jsx` has no details page.
  * *Status*: Implemented as a detailed modal/view in the portal.
