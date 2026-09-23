# 22 - Legacy Experience Migration Spec

**Status:** review-ready build plan  
**Legacy source:** retired application repository at `d4269a5`  
**Target source:** AutoDeck `main` at `1318d0d`  
**Target:** one AutoDeck Expo mobile app for customer and studio-staff roles, AutoDeck Admin on Next.js, one Firebase backend.

## 1. Migration rule

### Brand boundary

AutoDeck is the only brand in every target surface. No retired product name, wordmark, icon, package name, tenant identifier, seed label, analytics label, notification copy, deep link, app-store field or customer-visible migration message may carry forward. References in this document say “legacy source” only to identify where an implementation idea came from; they are not target copy.

legacy source app is the experience source, not the runtime architecture.

- **Port** means the design intent, semantic token or pure projection can move with little product change.
- **Adapt** means preserve the behavior but implement it through React Native, Expo Router and AutoDeck domain services.
- **Rebuild** means the legacy source app implementation depends on DOM, CSS, Next.js APIs or its old server model; specify the outcome and write a new AutoDeck implementation.
- **Keep** means AutoDeck already has the stronger implementation; restyle and integrate it rather than replacing it.

Do not copy legacy source app API routes, Firebase reads, lifecycle writes or server services into AutoDeck. Business state remains in AutoDeck Cloud Functions and shared domain types.

## 2. Target package shape

The current `apps/customer` and `apps/studio` Expo apps should converge into one distributable shell. Keep them functional until route migration is complete.

```text
apps/mobile/
  src/app/
    (auth)/                 shared sign-in and claim bootstrap
    (customer)/             home, garage, bookings, membership, profile
    (staff)/                today, bays, calendar, jobs, lookup, walk-in
  src/features/             role-owned feature screens and projections
  src/navigation/           role router, tabs, room transitions
  src/theme/                semantic themes and provider
packages/experience/
  tokens/                   platform-neutral semantic tokens
  projections/              pure customer/staff view-model builders
  copy/                     state language and labels
packages/ui/
  native/                   shared React Native primitives
  web/                      admin web equivalents where useful
apps/admin/src/experience/  admin-only dense layout primitives
```

Role routing must use verified Firebase claims. A customer claim opens the customer route group; studio opens the staff route group. Admin and superadmin remain on the web. No UI-only role switch may grant access.

## 3. Token migration

### 3.1 Color semantics

| legacy source app token    | Source value / role                | AutoDeck target               | Decision | Rule                                                                                   |
| -------------------------- | ---------------------------------- | ----------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `color.paper`              | `#08090A`, deepest dark ground     | `theme.colors.canvas`         | Port     | App background, never a generic card fill.                                             |
| `color.surface`            | `#15161A`, raised dark surface     | `theme.colors.surface`        | Port     | Cards and panes.                                                                       |
| `color.edge`               | white at 8%                        | `theme.colors.borderSubtle`   | Port     | One-pixel separators and quiet borders.                                                |
| `color.ink`                | `#EDEBE7`, primary dark-theme text | `theme.colors.textPrimary`    | Port     | Must meet 4.5:1 contrast.                                                              |
| `color.ink2`               | `#ADACA9`, secondary text          | `theme.colors.textSecondary`  | Port     | Labels and supporting copy.                                                            |
| `color.ink3`               | `#91918F`, tertiary text           | `theme.colors.textTertiary`   | Adapt    | Use only where contrast passes; otherwise promote to secondary.                        |
| `color.amber`              | `#E0A45C`, AutoDeck action/accent  | `theme.colors.accent`         | Port     | One primary accent, not decorative chrome.                                             |
| `color.amberHot`           | `#F0C48C`, bright accent           | `theme.colors.accentStrong`   | Port     | Focus, progress and selected emphasis.                                                 |
| `color.champagne`          | `#E8D9BE`, premium neutral         | `theme.colors.premium`        | Port     | Membership/protection, not every heading.                                              |
| `assent`                   | champagne                          | `theme.colors.success`        | Adapt    | legacy source app deliberately used a quiet premium success. Add icon/text redundancy. |
| `caution`                  | amber                              | `theme.colors.warning`        | Port     | Expiry and attention states.                                                           |
| `urgent`                   | `#E2705A`                          | `theme.colors.danger`         | Port     | Destructive/error only.                                                                |
| `lapsed`                   | `#8A8F96`                          | `theme.colors.inactive`       | Port     | Expired and unavailable states.                                                        |
| light-theme porcelain ramp | `#F7F7F6` through white            | `light.colors.canvas/surface` | Port     | Preserve warm white; do not fall back to pure system grey.                             |
| light-theme brown accent   | `#7A521E` family                   | `light.colors.accent`         | Adapt    | Validate against the orange AutoDeck brand before implementation.                      |

Build `darkTheme` and `lightTheme` as complete semantic objects. Components consume roles such as `textPrimary`, never raw hex values. Persist customer theme preference; staff devices may default dark but still honor accessibility settings.

### 3.2 Spacing, size and layout

| legacy source app                  |            Value | AutoDeck target                 | Decision                                                |
| ---------------------------------- | ---------------: | ------------------------------- | ------------------------------------------------------- |
| `BASE`                             |                4 | `space.unit`                    | Port                                                    |
| `hair` / `breath` / `line` / `gap` |  4 / 8 / 12 / 16 | `space.1` to `space.4`          | Port                                                    |
| `rest` / `movement`                |          48 / 96 | `space.section` / `space.scene` | Adapt to device size                                    |
| `INSET`                            |               24 | `layout.screenInset`            | Port, reduce only below 360px                           |
| `MEASURE`                          |              600 | `layout.readingMeasure`         | Keep for web/tablet; native phone uses full inset width |
| `TARGET_MIN`                       |               44 | `layout.minimumHitArea`         | Port as hard accessibility floor                        |
| `NAV_HEIGHT`                       |               49 | `navigation.tabBarHeight`       | Adapt to safe area and platform tab guidance            |
| compact/tablet/wide                | 320 / 768 / 1280 | responsive breakpoints          | Port for web; native uses window classes                |

### 3.3 Radius and elevation

| legacy source app                          | AutoDeck target      | Decision | Native implementation                                              |
| ------------------------------------------ | -------------------- | -------- | ------------------------------------------------------------------ |
| chip 12                                    | `radius.chip`        | Port     | `borderRadius: 12`                                                 |
| card 16                                    | `radius.card`        | Port     | Cards and list groups                                              |
| pane 20                                    | `radius.pane`        | Port     | Premium elevated regions                                           |
| sheet 24                                   | `radius.sheet`       | Port     | Bottom sheets and modals                                           |
| stage 32                                   | `radius.hero`        | Adapt    | Large image/header containers                                      |
| pill 9999                                  | `radius.pill`        | Port     | Status chips only                                                  |
| base/raised/float/nav/sheet/takeover/alert | semantic depth bands | Adapt    | Android elevation plus iOS shadow; no CSS-only z-index assumptions |

Elevation expresses hierarchy, not decoration. Keep one raised layer per screen and reserve takeover/alert for real modal states.

### 3.4 Typography

legacy source app roles become platform roles; font licensing and native availability must be confirmed before bundling.

| legacy source app role | Intent                                | AutoDeck target | Decision                                |
| ---------------------- | ------------------------------------- | --------------- | --------------------------------------- |
| display                | car/state hero statement              | `type.display`  | Port role; adapt size with Dynamic Type |
| title                  | screen/room title                     | `type.title`    | Port                                    |
| body                   | prose and actions                     | `type.body`     | Port                                    |
| data                   | registration, price, dates, telemetry | `type.data`     | Port; use tabular figures               |
| whisper                | provenance and quiet metadata         | `type.caption`  | Adapt; never below accessible minimum   |

Required behavior: Dynamic Type, font-scale testing to 200%, no fixed-height text containers, Hindi/Gujarati glyph evaluation before localization.

### 3.5 Motion and ambient treatment

| legacy source app primitive | Values                                      | AutoDeck target         | Decision                                                 |
| --------------------------- | ------------------------------------------- | ----------------------- | -------------------------------------------------------- |
| tick / move / scene / morph | 120 / 280 / 480 / 620ms                     | shared durations        | Port                                                     |
| ease / exit                 | cubic curves                                | Reanimated easing       | Port                                                     |
| spring                      | stiffness 420, damping 38, mass 1           | Reanimated spring       | Adapt and device-test                                    |
| hero settle                 | 1.06 scale, 480ms                           | image entrance          | Adapt; avoid costly full-screen scale on low-end Android |
| parallax / tilt / sweep     | 0.82, 8°, 2.4s                              | optional premium motion | Rebuild; disable by reduced motion and low-power policy  |
| live/breath loops           | 2.6s / 2s                                   | active-state pulse      | Adapt; never imply activity that is not live             |
| reduced motion              | transforms off, opacity allowed, duration 0 | accessibility contract  | Port as mandatory                                        |
| ambient drift and glass     | drift 6, 32s, blur 24, saturate 1.6         | background atmosphere   | Rebuild sparingly; use static fallback on Android        |

No animation may delay the primary action, hide network latency or mask stale data. Motion tests cover reduced motion and navigation interruption.

## 4. Primitive and component map

| legacy source app component                                                | AutoDeck equivalent                    | Decision                      | Notes                                                                            |
| -------------------------------------------------------------------------- | -------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| `Screen`                                                                   | `ExperienceScreen`                     | Adapt                         | Safe area, theme ground, scroll ownership and offline banner slot.               |
| `Surface`                                                                  | existing `Card` + semantic variants    | Adapt                         | Extend current shared UI instead of parallel cards.                              |
| `Glass` / `Pane`                                                           | `Pane` variants plain/warm/cool/lit    | Rebuild                       | Native translucent surface with opaque fallback; admin uses CSS backdrop filter. |
| `Heading` / `Text`                                                         | existing text primitives               | Adapt                         | Add semantic roles and scaling; remove raw sizes from screens.                   |
| `Button` tiers                                                             | shared `Button` primary/forward/quiet  | Adapt                         | Current button remains; add tiers and loading/disabled contract.                 |
| `IconButton`                                                               | shared `IconButton`                    | Keep + style                  | Enforce 44px hit target and accessible labels.                                   |
| `Badge` / `StatusChip`                                                     | existing `StatusBadge` family          | Adapt                         | One cross-surface status-tone map.                                               |
| `Divider`                                                                  | `Divider`                              | Port                          | Hairline aware of pixel density.                                                 |
| `BottomSheet`                                                              | native bottom sheet primitive          | Rebuild                       | Focus, keyboard and back-button behavior; do not emulate with a web modal.       |
| `Modal`                                                                    | native modal primitive                 | Adapt                         | Confirm destructive and payment-adjacent actions explicitly.                     |
| `Toast`                                                                    | `ToastProvider`                        | Rebuild                       | Announce through screen reader; no success toast before server confirmation.     |
| `Skeleton` / `Loading`                                                     | existing loading states                | Adapt                         | Match final geometry and avoid shimmer under reduced motion.                     |
| `OfflineNote` / `useOnline`                                                | connectivity banner + stale policy     | Rebuild                       | Network state alone is not truth; label last-updated state.                      |
| `Timeline`                                                                 | shared job/visit timeline              | Port projection, rebuild view | Map only canonical AutoDeck job states.                                          |
| `ProgressRing` / `Dial`                                                    | `StateDial`                            | Adapt                         | Use for meaningful protection/visit progress, never decoration.                  |
| `Hero`                                                                     | `VehicleHero`                          | Rebuild                       | Native image loading, crop, placeholder and provenance states.                   |
| `Gallery` / `Photograph`                                                   | `VehicleMedia`                         | Adapt                         | Port absent/loading/ready/failed state machine and captions.                     |
| `Expansion`                                                                | accordion/disclosure                   | Adapt                         | Keep state in route or local UI as appropriate.                                  |
| `Desk`                                                                     | admin command/detail drawer            | Rebuild for web only          | Not a mobile customer primitive.                                                 |
| `Ambient`                                                                  | `AmbientBackdrop`                      | Rebuild optional              | Static fallback and performance budget required.                                 |
| `LiveRefresh`                                                              | query invalidation/subscription policy | Rebuild                       | Prefer Firestore listeners; bounded polling only where necessary.                |
| OS `Label`, `Statement`, `Rail`, `Meter`, `Row`, `Value`, `Action`, `Stat` | domain composition primitives          | Port semantics                | Implement in `packages/experience`, backed by shared base UI.                    |
| `Notice` seen-state                                                        | notification/notice service            | Rebuild                       | Persist server-side for cross-device consistency.                                |

## 5. Navigation and chrome

### 5.1 Mobile role shell

legacy source app `CustomerChrome`, `BottomNavigation`, `Menu`, `RoomTransition` and `RoomTheme` become one Expo Router shell.

- **Customer tabs:** Home, Garage, Bookings, You. Notifications open from the header; catalogue/booking is a modal or nested route, not a permanent fifth tab.
- **Staff tabs:** Today, Bays, Calendar, Lookup, Account. Job, inspection and walk-in routes are nested details.
- Resolve the route group once verified claims load. Do not flash customer screens to staff or vice versa.
- Deep links first verify authentication, role and resource authorization, then open the destination or a safe fallback.
- Preserve back-stack meaning across room transitions. A visual morph never substitutes for route history.
- `Palette`/command menu is deferred on customer mobile. A keyboard-first command palette may be rebuilt for admin web later.

### 5.2 Admin chrome

**Owner directive (23 Sep 2026):** the legacy source app is the UI/UX reference for the whole of AutoDeck, Admin included. Admin adopts the legacy design language and models its shell and screens on the legacy source's own admin and workspace screens, rebranded as AutoDeck. The brand boundary in section 1 still applies in full: no legacy name, wordmark, icon or copy ships.

**Source:** `app/admin/layout.tsx`, `app/admin/*`, `components/workspace/*`, `components/system/Desk.tsx`, `design/*`.

- **One staff shell, two operating modes.** Port the legacy shell model: **Studio** mode runs today's work (Studio Board, Schedule, Bookings, Attendance, Gallery, walk-in); **Office** mode runs the business (Dashboard, Customers, Memberships, Quotes, Papers, Invoices, Expenses, Daily Close, Inventory, Reports, Employees, Services/Settings). Grouped sidebar with the same group labels, a Studio/Office mode switch, and role-filtered items. Mobile-width admin uses the same drawer pattern as the legacy shell.
- **Design language.** Same dark studio ground, single warm accent and its cool reflection, four state tones, glass panes over the ground, mono "data" face for numbers, plates and codes, and the legacy radius/elevation/spacing scales. Values come from `packages/experience` tokens (section 3), not re-derived per screen.
- **Workspaces.** Job and booking detail follow `JobWorkspace`/`BookingWorkspace`: a primary work surface with `StudioDrawer`/`TechnicianDrawer` side drawers, `OpsTimeline`, `ApprovalSection`, `ScopeEditor`, `BayStrip` and `UpiSettlement`, rebuilt on AutoDeck services and Cloud Functions.
- **Behaviour carried over.** Scroll position remembered per route within one workflow, keyboard-reachable navigation, primary actions in the accent button style, and quick search/add from the shell.
- **Screens without an AutoDeck backend yet** (attendance, expenses, inventory, office dashboard, papers verification, daily close, gallery) are functionality gaps. Each needs AutoDeck domain types, rules and callables before its screen ships; no placeholder destinations, matching the legacy rule.

## 6. Personalization flow map

### 6.1 Greeting

**Source:** `components/os/Greeting.tsx`, customer name from `toWelcome`/profile.  
**Decision:** Port copy behavior, rebuild native component.

- Input is a server-backed preferred first name, sanitized and optional.
- Time-of-day greeting is local-device presentation only; it never affects business state.
- Empty name falls back to a neutral greeting, never “undefined”.
- Greeting appears once on Home, not on every route.
- Respect reduced motion and do not type/animate the name character by character.

### 6.2 Active-vehicle home

**Source:** `HomeScreen`, `homeStateCopy`, `toHome`, ownership projection.  
**Decision:** Port the projection idea; rebuild against AutoDeck services.

Create a pure `projectCustomerHome` function with:

```ts
interface CustomerHomeModel {
  customer: { firstName?: string };
  activeVehicle?: VehicleSummary;
  heroState:
    | "empty"
    | "idle"
    | "booked"
    | "inService"
    | "awaitingApproval"
    | "paymentDue"
    | "ready";
  primaryAction: ActionModel;
  liveVisit?: LiveVisitSummary;
  protections: ProtectionSummary[];
  membership?: MembershipSummary;
  recentHistory: HistorySummary[];
  lastUpdatedAt: Date;
}
```

Priority must be deterministic: approval requiring response > payment due > active service > upcoming booking > protection attention > ordinary care. The backend remains authoritative; the projection never invents lifecycle state.

Active vehicle selection persists in customer preferences and falls back to the most recently active owned vehicle. Every resource query still checks ownership server-side.

### 6.3 Welcome flow

**Source:** steps `hello`, `rooms`, `record`, `notifications`, `car`.  
**Decision:** Adapt.

Target sequence:

1. **Hello:** name and AutoDeck promise.
2. **Your garage:** explain vehicle-first model.
3. **Your record:** explain service history, invoices and warranties.
4. **Notifications:** ask only after value is explained; “Not now” must work.
5. **Add a car:** required only before booking, not before exploring.

Persist `welcomeVersion` and completion server-side so copy can evolve without replaying onboarding. Ask push permission only from a user gesture. Staff accounts never enter customer welcome.

### 6.4 Garage

**Source:** `GarageScreen`.  
**Decision:** Adapt information architecture, keep AutoDeck vehicle CRUD.

- One lead vehicle with photography and state; remaining vehicles in a compact list.
- Add/edit uses AutoDeck `createVehicle`/`updateVehicle`; no direct Firestore writes.
- Registration number is normalized and displayed consistently.
- Empty, loading, failed and offline states are first-class.
- Selecting a vehicle sets active context and opens Vehicle Room.

### 6.5 Vehicle Room

**Source:** `VehicleRoom`, `VehicleScreen`, photograph renderer.  
**Decision:** Rebuild native screen; port hierarchy.

Sections: hero photo and identity; current state; protections/warranties; upcoming booking or active visit; service history; documents; media moments. Do not make unavailable data look broken. Each protection shows provenance, start/end or remaining basis and an action only when the backend supports it.

### 6.6 Live visit timeline

**Source:** `LiveVisitScreen`, `Timeline`, moment projection.  
**Decision:** Port pure projection where status mapping agrees; rebuild screen.

Canonical mapping must come from AutoDeck `JobStatus` and `statusHistory`. Show reached/current/upcoming states, timestamped media and approval/payment interruptions. The current stage comes from the job record, not array position or optimistic UI. Firestore listener updates the screen; reconnect shows last-updated time until fresh data arrives.

### 6.7 Photography and moments

**Source:** `Photograph`, `projectMoments`, month grouping.  
**Decision:** Port the four-state media contract and pure grouping; adapt storage URLs.

- States: absent, loading, ready, failed.
- Captions retain arrival/in-care/completed meaning.
- Signed URLs refresh through AutoDeck services; stale URLs are not stored as permanent identity.
- Customer sees only media authorized for that job and vehicle.

## 7. Admin experience adoption

Admin is rebuilt to the legacy admin reference (section 5.2) in this order:

1. `packages/experience` web tokens (CSS variables) for ground, ink, accent, state tones, typography roles, radius and elevation, shared with mobile.
2. Staff shell: grouped sidebar, Studio/Office mode switch, role filtering, drawer on narrow widths, AutoDeck mark in place of the legacy mark.
3. Shared web primitives mirroring `components/system`: Glass/Surface panes, Button tiers, StatusChip/Badge, Timeline, Desk/drawer, Modal, Toast, Skeleton, OfflineNote.
4. Studio mode screens: Studio Board, Schedule, Bookings, walk-in, then job and booking workspaces with drawers.
5. Office mode screens that already have AutoDeck backends: Customers, Memberships, Quotes, Invoices, Reports, Employees, Services.
6. Office screens that need new backends (Attendance, Expenses, Inventory, Daily Close, Papers, Gallery, Office dashboard), each behind its own backend change.

Glass, glow and ambient treatment follow the legacy admin's own restraint: panes and accent light on chrome, cards and headers; tables, forms and money figures stay flat, high-contrast and scannable. Motion respects reduced-motion and never delays an operational action.

## 8. Backend additions required for the experience

| Need                       | Existing support             | Required change                                                                         |
| -------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| Active vehicle             | vehicle ownership exists     | customer preference field and callable update                                           |
| Theme preference           | none                         | profile preference schema and update callable                                           |
| Welcome completion/version | profile setup exists         | persist `welcomeVersion` and notification decision                                      |
| Home projection            | data exists across services  | client projection first; consider aggregated read only if query cost/latency demands it |
| Media moments              | inspections/job photos exist | authorized media summary and signed-URL refresh                                         |
| Live visit                 | job/status history exists    | stable listener query and explicit last-updated timestamp                               |
| Notice seen-state          | notifications exist          | server-side read/seen update, cross-device                                              |
| One mobile shell           | auth packages exist          | claim bootstrap and shared role route guard                                             |

Every new write is a callable or server route with auth, tenant and ownership checks. Do not open direct-write holes for preferences or navigation convenience.

## 9. Delivery sequence

### P1-A - Foundations

- Add `packages/experience` and complete semantic dark/light tokens.
- Add theme provider, reduced-motion provider and cross-platform status-tone map.
- Add visual fixture screens and token contrast tests.
- Define the one-mobile-shell migration path without deleting existing apps.

### P1-B - Personalization state

- Add preferences and welcome version to profile types/schemas/functions/rules.
- Implement active vehicle selection and `projectCustomerHome` with unit tests.
- Add query/listener hooks with stale and error states.

### P1-C - Signature customer screens

- Welcome and greeting.
- Vehicle-first Home.
- Garage and Vehicle Room.
- Live Visit timeline and media moments.

### P1-D - One mobile app

- Move customer and staff routes into shared role groups.
- Add deep-link and claim-transition tests.
- Run customer/staff journeys on iOS and Android before removing old shells.

### P1-E - Admin rebuild to the legacy admin reference

- Ship the staff shell with Studio/Office modes and shared web tokens.
- Rebuild Studio mode screens and job/booking workspaces to the legacy layouts.
- Restyle existing Office screens; add missing Office modules only with their backends.

## 10. Acceptance gates

- Dark and light themes pass text/icon contrast checks.
- Dynamic Type at 200% has no clipped actions or data loss.
- Reduced motion removes transforms and loops.
- Android low-end performance holds 55+ FPS on Home and Vehicle Room transitions.
- Home priority projection has table-driven tests for every competing state.
- Role routing never shows customer data to staff or staff routes to customers before claims resolve.
- Offline/stale UI states when the last confirmed server update occurred.
- Live Visit status matches canonical backend history after reconnect.
- Garage and vehicle detail cannot read another customer’s resource.
- Admin matches the legacy admin shell, navigation groups and workspace layouts side by side, with AutoDeck branding only, and retains keyboard navigation, visible focus and table scanability.
- One full staging journey passes on both mobile roles and admin web.

## 11. Explicit non-goals for this migration

- Copying legacy source app API routes or direct Firebase access.
- Recreating every glow, blur or animation regardless of performance.
- Putting Admin inside the mobile app.
- Marketplace, sell-car, referrals or payroll work.
- Renaming canonical AutoDeck lifecycle states to fit old UI copy.
