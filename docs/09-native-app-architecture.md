# 09 — Native App Architecture

**Scope:** Customer iOS/Android app and Studio iOS/Android app.  
**Stack decision:** React Native + Expo (see ADR-001).

---

## 9.1 Technology Decision: React Native + Expo

**Why React Native + Expo over Flutter:**

| Factor | React Native + Expo | Flutter |
|---|---|---|
| Language | TypeScript (shared with admin, functions) | Dart (separate learning curve) |
| Team fit | High — existing JS/TS codebase | Requires Dart onboarding |
| OTA updates | EAS Update (no store review for JS changes) | Shorebird (third-party, less mature) |
| Expo SDK | Camera, notifications, secure storage, maps out of box | Equivalent plugins exist |
| Firebase | @react-native-firebase or Firestore SDK | FlutterFire — both well-maintained |
| App Store submission | EAS Submit | Standard flutter build |
| New Architecture | JSI bridge (near-native performance) | Own rendering engine (excellent) |
| iOS/Android parity | Good (some platform differences) | Excellent (own renderer) |

**Decision:** React Native + Expo. Primary rationale: TypeScript is shared across all five project surfaces (customer app, studio app, admin web, Cloud Functions, shared packages). Flutter would require maintaining Dart alongside TypeScript for no meaningful product advantage at this scale.

**Escape hatch:** Expo's bare workflow allows ejecting from managed workflow if a native module requires it. This is not anticipated but available.

---

## 9.2 Monorepo Structure

```
autodeck/                          (Turborepo root)
├── apps/
│   ├── customer/                  Expo app — customer-facing
│   │   ├── app/                   expo-router file-based routes
│   │   ├── components/            screen-specific components
│   │   ├── hooks/                 app-specific hooks
│   │   ├── store/                 Zustand stores (local UI state)
│   │   ├── app.config.ts          EAS environment-aware config
│   │   └── eas.json
│   ├── studio/                    Expo app — studio operations
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── app.config.ts
│   │   └── eas.json
│   └── admin/                     Next.js 15 web app
├── packages/
│   ├── shared-types/              TypeScript interfaces (domain entities)
│   ├── shared-utils/              Pure utility functions (pricing, formatting)
│   ├── ui/                        Shared RN primitive components (optional)
│   └── firebase-config/           Firebase config per environment
├── functions/                     Firebase Cloud Functions
│   ├── src/
│   │   ├── booking/
│   │   ├── payments/
│   │   ├── membership/
│   │   ├── notifications/
│   │   ├── middleware/            auth, rate-limit, validation
│   │   └── triggers/              Firestore triggers
│   └── package.json
└── turbo.json
```

---

## 9.3 Customer App

### Navigation Structure (expo-router)

```
app/
├── (auth)/
│   ├── index.tsx              Login — phone OTP entry
│   ├── verify.tsx             OTP verification
│   └── welcome/
│       ├── index.tsx          Step 1: name
│       ├── vehicle.tsx        Step 2: first vehicle
│       └── done.tsx           Step 3: welcome complete
│
├── (app)/                     Authenticated root (tab layout)
│   ├── _layout.tsx            Tab bar: Home / Garage / Book / History / You
│   │
│   ├── index.tsx              Home — vehicle state hub
│   │
│   ├── garage/
│   │   ├── index.tsx          All vehicles
│   │   ├── [vehicleId]/
│   │   │   ├── index.tsx      Vehicle detail (protections, history, photos)
│   │   │   ├── passport.tsx   Full service passport / history
│   │   │   └── protection/
│   │   │       └── [id].tsx   Protection / warranty detail
│   │   └── add.tsx            Add new vehicle
│   │
│   ├── book/
│   │   ├── index.tsx          Service browser (categories)
│   │   ├── [serviceId]/
│   │   │   ├── index.tsx      Service detail + scope selector
│   │   │   └── schedule.tsx   Date/time picker
│   │   ├── pickup.tsx         Pickup address (if requested)
│   │   ├── review.tsx         Booking review + price breakdown
│   │   └── confirm.tsx        Confirmation / success
│   │
│   ├── history/
│   │   ├── index.tsx          All completed jobs
│   │   └── [jobId]/
│   │       ├── index.tsx      Job detail (status rail, photos, invoice)
│   │       └── invoice.tsx    Invoice view
│   │
│   └── you/
│       ├── index.tsx          Profile + settings
│       ├── membership.tsx     Membership status + join flow
│       ├── notifications.tsx  Notification preferences
│       └── delete.tsx         Account deletion flow
│
├── booking/
│   └── [bookingId]/
│       ├── index.tsx          Booking detail (live status)
│       └── manage.tsx         Reschedule / cancel
│
├── approval/
│   └── [approvalId].tsx       Mid-job approval request
│
├── payment/
│   └── [jobId].tsx            Payment screen (V1: Razorpay Payment Link redirect)
│
└── invoice/
    └── [token].tsx            Public invoice (unauthenticated shareable link)
```

**Deep link scheme:** `autodeck://` maps to the same route structure.

Examples:
- `autodeck://booking/abc123` → booking detail
- `autodeck://approval/def456` → approval request
- `autodeck://payment/ghi789` → payment screen

All notification taps must deep-link to the relevant screen.

### State Management

**React Query** for all server state:
- Queries: bookings, jobs, vehicles, membership, services, notifications
- Real-time: wrap Firestore `onSnapshot` listeners as React Query subscriptions for live job status
- Cache: React Query cache + Firestore offline persistence as backing store
- Mutations: Cloud Function calls via React Query `useMutation`

**Zustand** for local UI state only:
- Active modal state
- Booking flow in-progress form state
- Notification badge count
- App theme preference

**No Redux.** Too heavy. React Query + Zustand is sufficient.

### Key Screens

**Home (vehicle state hub)**

The home screen is not a dashboard — it is a living representation of the customer's relationship with the studio right now.

States:
- No vehicle added → prompt to add vehicle
- No active service → show vehicle card + "Book a Service" CTA + membership status
- Booking confirmed (waiting) → booking card with countdown to scheduled date
- Vehicle in studio → live job tracking rail (status, current stage, estimated completion, photos from studio)
- Vehicle ready for delivery → prominent "Your car is ready" with CTA
- Multiple vehicles → vehicle switcher at top

**Vehicle Detail**

- Primary photo hero
- Specs (make, model, year, registration, colour)
- Protection badges: PPF shield / Ceramic badge / Insurance active / FastTag / PUC valid
- Service history timeline (last 3 jobs, "View all" link)
- Warranty cards (tap to expand certificate detail)
- Photo gallery (before/after from past services)

**Service Browser**

- Category grid (PPF, Ceramic Coating, Car Wash, Detailing, Other)
- Service cards within category: name, brand (if applicable), price from ₹X, duration, warranty period
- Service detail: full description, what's included, before/after examples, FAQ
- Scope selector: full body / bonnet only / partial / custom (service-dependent)
- Add-on selector
- Price updates live as scope/add-ons change (client-side preview from catalogue)

**Booking Flow**

Step 1: Service + scope (comes from browser)
Step 2: Vehicle selector (if customer has multiple vehicles)
Step 3: Date + time slot picker (calls availability Cloud Function)
Step 4: Pickup / drop toggle (address entry if enabled)
Step 5: Review: service, scope, vehicle, date/time, price breakdown, T&Cs
Step 6: Confirm → Cloud Function creates booking → success screen with booking reference

**Live Job Tracking**

- Status rail: VEHICLE RECEIVED → IN PROGRESS → QUALITY CHECK → READY FOR DELIVERY → DELIVERED
- Current stage highlighted with animation
- Stage photos from studio (pushed via Firestore real-time listener)
- Estimated completion date/time
- "Contact studio" button (WhatsApp deep link or in-app message)
- Approval request banner (if pending) → taps to approval screen

**Approval Request**

- Studio has requested approval for additional work
- Clear: what extra work, why, price impact (+₹X), time impact (+X hours)
- Photos from studio (showing the issue)
- APPROVE / REJECT buttons (prominent, accessible)
- Countdown timer if studio set an expiry

**Payment Screen (V1)**

- Order summary (cannot be edited — server-computed amount)
- V1: "Pay via WhatsApp" — Cloud Function creates Razorpay Payment Link → customer pays in browser (UPI/card/net banking)
- V2+: in-app Razorpay payment sheet (card, UPI, net banking); UPI AutoPay for membership
- Success: confirmation animation → navigate to booking detail

**Warranty Certificate**

- Premium visual: dark card with product logo, coverage badge
- Fields: service date, product (brand + series), installer, coverage type, start date, expiry date, terms
- Download PDF button
- QR code (optional) linking to a verifiable URL

### Camera & Photos

- `expo-camera` — vehicle condition capture at pickup (customer-initiated)
- `expo-image-picker` — select from photo library for vehicle registration
- All photos: compressed to max 1800px wide, 85% JPEG quality before upload
- Upload: request signed URL from Cloud Function → PUT to Firebase Storage → Cloud Function triggers thumbnail generation
- Private photos: accessible via signed download URLs (1-hour expiry)

### Push Notifications (expo-notifications)

Permission prompt: shown after booking confirmation (highest acceptance context — not on first app launch).

**Notification → deep link mapping:**

| Event | Notification | Deep link |
|---|---|---|
| Booking confirmed | "Your booking for [service] on [date] is confirmed" | autodeck://booking/{id} |
| Pickup scheduled | "We'll collect your [car] at [time] tomorrow" | autodeck://booking/{id} |
| Vehicle received | "[Car] is now in the studio" | autodeck://booking/{id} |
| Job in progress | "Work has started on your [car]" | autodeck://booking/{id} |
| Approval needed | "Studio needs your approval — tap to review" | autodeck://approval/{id} |
| Vehicle ready | "Your [car] is ready for delivery!" | autodeck://booking/{id} |
| Payment due | "Payment of ₹[X] due for your service" | autodeck://payment/{jobId} |
| Invoice ready | "Your invoice is ready to view" | autodeck://history/{jobId}/invoice |

Quiet mode: customer can suppress all non-critical notifications. APPROVAL_NEEDED and VEHICLE_READY always delivered regardless.

### Offline Support

Firestore offline persistence enabled for:
- Own vehicles (always cached)
- Own bookings (last 30 days)
- Active job status + photos
- Service catalogue (for browsing offline)

Behaviour when offline:
- Cached data shown with "last updated" indicator
- Booking creation and payment are disabled (require network — show explanation)
- Status viewing and photo gallery work from cache

### Secure Storage

| Data | Storage |
|---|---|
| Firebase ID token | Managed by Firebase Auth SDK (secure iOS keychain / Android keystore) |
| User preferences | expo-secure-store (encrypted) |
| Nothing sensitive | AsyncStorage (unencrypted — only for non-sensitive UI state) |

Biometric lock: optional, configured in app settings. If enabled, FaceID/fingerprint required to open app and to confirm payments.

---

## 9.4 Studio App

### Target Device

- **Primary: iPad** (landscape or portrait) — mounted in studio or carried by advisor
- **Secondary: iPhone** — field use for pickup/drop operations
- Single shared device per studio (shared-device model)
- Authentication: underlying Firebase Auth per employee account, plus optional PIN for quick session switching on shared device

### Navigation Structure (expo-router)

```
app/
├── (auth)/
│   ├── index.tsx              Employee login (phone OTP or email)
│   └── pin.tsx                Quick PIN entry (for shared-device session resume)
│
└── (app)/
    ├── _layout.tsx            Tab bar (phone) / sidebar (tablet)
    │                          Tabs: Queue / Walk-in / Bays / Inventory / Me
    │
    ├── queue/
    │   ├── index.tsx          Today's job queue (sorted by time/bay/status)
    │   └── [jobId]/
    │       ├── index.tsx      Job card
    │       ├── photos.tsx     Photo capture per stage
    │       ├── approval.tsx   Create approval request
    │       ├── payment.tsx    Record payment
    │       └── invoice.tsx    Generate + send invoice
    │
    ├── walkin/
    │   ├── index.tsx          Walk-in registration flow (step 1: phone lookup)
    │   ├── vehicle.tsx        Vehicle entry / confirmation
    │   ├── service.tsx        Service selection + bay assignment
    │   └── confirm.tsx        Confirm walk-in job creation
    │
    ├── bays/
    │   └── index.tsx          Bay board — live grid of all bays + current job
    │
    ├── inventory/
    │   ├── index.tsx          Stock levels + low-stock alerts
    │   ├── [itemId].tsx       Item detail + consumption log
    │   └── record.tsx         Record consumption against a job
    │
    └── me/
        ├── index.tsx          My profile, attendance status
        ├── checkin.tsx        Check in / check out
        └── settings.tsx       App settings
```

**Tablet (iPad) layout:** Left sidebar replaces bottom tab bar. Job card opens as a right panel (split view) rather than full-screen modal.

### Key Screens

**Job Queue**

- Grouped by: Today's bookings + Active walk-ins
- Each row: customer name, vehicle, service, bay, scheduled time, status badge
- Status colour coding: consistent across entire app (unlike legacy source app where status colours differed per screen)
- Sort order: scheduled time ascending; completed jobs move to bottom
- Pull-to-refresh; real-time Firestore listener for status changes

**Job Card**

The central operational screen. Divided into sections:

1. Header: customer, vehicle (plate), service, bay assigned
2. Status rail: advance button for each valid next status
3. Photos: capture by stage (Intake / In Progress / Quality Check / Complete)
4. Approval: "Request customer approval" CTA if additional work needed
5. Payment: payment status; "Record payment" / "Send payment request" options
6. Invoice: "Generate invoice" button; PDF preview; "Send to customer" (WhatsApp/email)
7. Notes: internal notes (not visible to customer)
8. History: full status history with timestamps and actor names

**Status advancement** validates legal transitions server-side. A detailer cannot mark QUALITY_CHECK without first being IN_PROGRESS.

**Bay Board**

- Grid: one card per bay
- Card shows: bay name, current job (customer + service + status), time in bay, next job scheduled
- Empty bay: shown as available (green)
- Colour: occupied (blue), quality check (amber), ready for delivery (green), blocked/maintenance (red)
- Tap to open job card for that bay

**Walk-in Flow**

Step 1: Phone number entry → search existing customers  
Step 2a (existing): confirm customer + select vehicle or add new vehicle  
Step 2b (new): enter name + vehicle details  
Step 3: Service selection (from catalogue)  
Step 4: Bay selection (from available bays — studio chooses)  
Step 5: Review + create job  

Walk-in jobs skip the booking engine slot allocation — bay is selected directly by studio.

**Camera — Studio Use Cases**

- Intake inspection: capture vehicle condition on arrival (dents, scratches, existing damage)
- In-progress: work photos at each stage
- Quality check: final inspection photos
- Complete: before/after comparison set

Each photo tagged with: vehicleId, jobId, stage, employeeId, timestamp. Uploaded to Firebase Storage via Cloud Function signed URL.

**Payment Collection**

- Cash/UPI QR: studio records amount + payment method + reference → Cloud Function marks paid (manual)
- Razorpay Payment Link (V1 primary): Cloud Function creates payment link → sends to customer via WhatsApp → customer pays in browser → Razorpay webhook confirms → status updates automatically
- Multi-payment: job can have partial payments (deposit + balance at delivery)

### Offline Support

Studio operates in a workshop environment — WiFi may be intermittent.

- Job queue cached offline (Firestore offline persistence)
- Job cards readable offline (all job data cached)
- Photo capture works offline; queued for upload on reconnect
- Status advances queued offline (stored locally), applied when connection restored
- Payment recording works offline; synced on reconnect

**Conflict resolution:** Status advances use a "latest event wins" merge strategy. Photos are append-only — no conflict possible. If two employees advance the same job simultaneously, last write wins (acceptable at studio scale).

---

## 9.5 Shared Packages

### packages/shared-types

Single source of truth for all TypeScript interfaces. Consumed by customer app, studio app, admin web, and Cloud Functions.

```typescript
// Example — all domain entities defined here
export interface Booking { ... }
export interface ServiceJob { ... }
export interface Vehicle { ... }
export interface ServiceCatalogue { ... }
export type BookingStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'expired'
export type JobStatus = 'vehicle_received' | 'in_progress' | 'quality_check' | 'ready_for_delivery' | 'delivered' | 'void'
```

Changes to this package are surfaced as TypeScript errors in all consumers immediately.

### packages/shared-utils

Pure utility functions with no side effects:

```typescript
computePrice(input): PriceBreakdown
formatDuration(minutes: number): string           // "2h 30m"
computeEstimatedEnd(start, durationMin, hours)    // multi-day aware
isValidTransition(from: JobStatus, to: JobStatus): boolean
formatINR(amount: number): string                  // "₹12,500"
formatCurrency(amount: number, currency: string): string  // generic, tenant-configurable
getStatusLabel(status: JobStatus, lang: 'en' | 'hi' | 'gu'): string
```

---

## 9.6 Build & Distribution

### EAS Configuration

```json
// eas.json (customer app — identical pattern for studio)
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "APP_ENV": "development" }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "env": { "APP_ENV": "staging" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "APP_ENV": "production" }
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "...", "ascAppId": "...", "appleTeamId": "..." },
      "android": { "serviceAccountKeyPath": "./play-store-key.json", "track": "internal" }
    }
  }
}
```

### Environment Management

`app.config.ts` reads `APP_ENV` to select Firebase project:
- `development` → autodeck-dev Firebase project
- `staging` → autodeck-staging Firebase project
- `production` → autodeck-prod Firebase project

No `.env` files committed. All secrets stored in EAS Secrets.

### OTA Updates (EAS Update)

Eligible for OTA (no store review):
- Bug fixes in TypeScript/JavaScript
- UI text changes
- New screens (JS-only)
- Notification content changes

Requires store submission:
- New native module
- New app permission
- Binary/SDK version bump
- App icon change

Rollout strategy: 10% → 50% → 100% with 24h monitoring window between stages.

---

## 9.7 Performance Requirements

| Metric | Target |
|---|---|
| Cold app launch | < 2 seconds (mid-range device) |
| Home screen first paint | < 1 second (from Firestore cache) |
| Booking flow end-to-end | < 60 seconds |
| Availability query response | < 800ms (Cloud Function) |
| Photo upload (5MB) | < 10 seconds (India 4G connection) |
| Push notification delivery | < 30 seconds from event trigger |
| UI animations | 60fps on iPhone 12+ / equivalent Android |

Firestore offline persistence ensures the home screen loads from cache even before network response — critical for perceived performance.

---

## 9.8 Accessibility

- Dynamic Type (iOS) + font scale (Android): all text uses system font scaling
- VoiceOver / TalkBack: all interactive elements have accessible labels
- Colour contrast: WCAG AA (4.5:1 body text, 3:1 large text)
- Tap targets: minimum 44×44pt on all interactive elements
- Error states: text + icon, not colour alone
- RTL (Arabic): full layout mirroring when language = Arabic
  - Directional icons must flip (back arrow, chevrons, progress rails)
  - Text alignment flips
  - Tab bar order reverses

---

## 9.9 React Native New Architecture

Both apps target React Native New Architecture (Hermes + JSI):
- No JS bridge for synchronous native calls (better animation performance)
- Concurrent React features (Suspense, Transitions)
- Expo SDK 52+ has full New Architecture support

This is the default for new Expo projects — no special configuration needed.
