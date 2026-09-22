# 11 — Design System Direction

**Status:** Direction document. No final designs. These principles must guide the eventual design phase.  
**Not:** Figma files, final colour hex codes, final typeface selection, final component specs.  
**Purpose:** Align the product, engineering, and design teams on what AutoDeck should feel like before a single frame is designed.

---

## 11.1 Brand Positioning

AutoDeck is a premium automotive service platform. Launch market: Ahmedabad, Gujarat, India.

**Character:**
- **Precise** — like engineering tolerances, not rounding errors. Exact prices, exact times, exact coverage terms.
- **Confident** — quiet authority. Not promotional, not noisy. The product knows what it does.
- **Trustworthy** — reliability is the core promise. The customer is handing over a valuable asset.
- **Technical** — respects the customer's intelligence. Shows detail when it matters (warranty terms, product specs) without hiding behind vague assurances.
- **Warm** — professional, not cold. Service-oriented. The studio cares about the car.

**Not:**
- Not GoMechanic: high-contrast promotional red/green, discount-first, noisy service grid
- Not a generic booking app (Calendly, Acuity): sterile white, functional but characterless
- Not a finance app: not data-dense tables first, not enterprise-grey
- Not over-designed: no excessive micro-animations, no skeuomorphic surfaces, no gradient-heavy "luxury fintech" aesthetic

**Closest functional references (NOT visual copy):**
- Tesla app — data-forward, vehicle as the hero, purposeful whitespace, confident dark UI
- Apple Wallet — certificate/card metaphors, trust through precision
- Linear app — professional tool with a strong design voice; details are correct everywhere

The car is always the subject. Every screen should make the customer feel that their car is in expert hands and that they have complete visibility and control.

---

## 11.2 Colour Strategy

**Direction (not final palette):**

**Base:** Near-black or deep navy as the primary surface colour. Not pure black (#000000) — too harsh. A very dark blue-grey or warm-tinted near-black gives depth without harshness. This anchors the premium feel.

**Accent:** A single brand colour — restrained, not loud. Suggested direction: a metallic or mineral-adjacent tone. Options to explore: slate blue, gunmetal, or a deep automotive colour (e.g., the specific blue of a PPF film edge, the depth of ceramic gloss). NOT red (too automotive-generic), NOT electric blue (too tech-startup). One accent colour only — never two competing accents.

**Semantic colours (standard, not brand):**
- Success / Active / Protected: green (standard — do not override with brand colour)
- Warning / Pending / Attention: amber
- Error / Critical / Overdue: red
- Informational: blue-grey

**Surfaces:**
- Background: off-white or very light warm grey (not pure white — too clinical)
- Cards: white or +2% lighter than background
- Elevated: subtle shadow (no heavy drop shadows — looks dated)

**Dark mode:** First-class, not an afterthought. Dark mode surfaces should feel rich, not flat grey. Near-black → dark card → elevated dark. Automotive apps are commonly used in dark environments (underground car parks, workshop settings, evening use). Dark mode should be the default for the Studio App.

**Colour usage rules:**
- Accent colour used sparingly: primary CTA buttons, active states, key data highlights
- Never use accent colour for decorative purposes
- Status colours must be consistent across every screen in every app (legacy source app's biggest design failure was status colours differing per screen)

---

## 11.3 Typography Direction

**Primary typeface:** Modern geometric sans-serif. Candidates: Geist (open-source, excellent for product UI), Inter (widely proven, slightly generic), or a licensed option (Söhne, GT America) if budget allows. Decision: evaluate at design phase.

**Secondary typeface (V2+):** Hindi/Gujarati locale support may require a Devanagari/Gujarati typeface companion. Candidates: Noto Sans Devanagari, Hind (Google Fonts, open-source). Not required in V1 (English-only launch). Deferred to V2 when regional language support is added.

**Type scale (5 levels — strict):**

| Level | Use | Size (mobile) | Size (web) | Weight |
|---|---|---|---|---|
| Display | Hero text, large callouts | 32-40sp | 48-64px | Semibold |
| Heading | Screen titles, card titles | 20-24sp | 28-36px | Semibold |
| Subheading | Section labels, list group headers | 16-18sp | 20-24px | Medium |
| Body | Primary content, descriptions | 14-16sp | 14-16px | Regular |
| Caption | Metadata, timestamps, fine print | 12sp | 12-13px | Regular |

**Tabular figures:** Required on all numeric content (prices, counts, dates, durations). Proportional figures cause alignment drift in tables and lists — unacceptable for a product built on price precision.

**Line height:** Comfortable (1.4-1.6 for body text). Not tight. Premium products have breathing room.

---

## 11.4 Spacing & Layout System

**Base unit:** 8pt (4pt for micro-spacing between tightly related elements).

**Spacing tokens:**
```
xs   =  4pt
sm   =  8pt
md   = 16pt
lg   = 24pt
xl   = 32pt
2xl  = 48pt
3xl  = 64pt
```

All component padding, margin, and gap values must be multiples of 4. All section padding values must be multiples of 8.

**Mobile layout:** 4-column grid, 16pt page margin, 8pt gutter. Cards are full-width or half-width — no 3-column cramming on phone.

**Tablet (studio app):** 12-column grid on iPad landscape. Job card + job list in split view.

**Admin web:** 12-column grid, 24pt page margin. Right panel for detail/edit (no full-page navigation for records).

**Component density:** Comfortable. Not compact (data-dense enterprise tables everywhere), not spacious (too much scroll for operational staff). Premium apps have breathing room in customer-facing surfaces; studio and admin interfaces can be slightly denser (more information per screen).

---

## 11.5 Component Architecture

**Four layers:**

### Layer 1: Design Tokens
Platform-specific implementations of colour, typography, spacing, border radius, shadow, and animation values.
- CSS custom properties for admin web
- React Native StyleSheet constants for mobile apps
- Exported in W3C Design Token Community Group format for Figma sync

### Layer 2: Primitive Components
Unstyled or lightly styled atoms. Identical semantics across web and mobile.
- Button (primary, secondary, destructive, ghost)
- Input, Textarea, Select
- Badge, Chip
- Avatar
- Card
- Divider
- Spinner, Skeleton

### Layer 3: Domain Components
Business-specific components that encode product logic in their appearance.

Key domain components to design first (they appear everywhere and set the product's visual language):

**StatusRail** — the visual representation of booking/job status progression
- Horizontal on mobile (scrollable if many steps)
- Vertical on admin web (more space for labels and timestamps)
- Must be legible in both light and dark mode
- Current step: highlighted with accent colour; completed steps: filled; future steps: unfilled

**VehicleCard** — the primary way a vehicle is represented
- Primary photo hero (required — no photo → placeholder with car silhouette)
- Registration number (prominent — the identifier staff use)
- Make, model, year
- Active protection badges (PPF / Ceramic / Insurance) as small chips
- Last service date

**ServiceCard** — how a service is presented to customers
- Service photo (showing actual work quality)
- Name, brief description
- Starting price (₹X)
- Duration estimate
- Warranty badge (e.g., "5-year warranty")
- Popular tag if applicable

**WarrantyCertificate** — one of the most important trust artifacts in the product
- Premium dark card (certificate-like, not a generic card)
- Product brand logo (XPEL, LLumar, Garware, Ceramic Pro etc.)
- Coverage type badge (PPF / Ceramic / Service)
- Customer name, vehicle, registration
- Service date, installer name
- Expiry date (prominently displayed)
- Coverage description (exact terms, not vague)
- Download PDF button
- A visual "seal" element (subtle) to communicate authenticity

**BayGrid (studio app)** — live operational view
- Grid of cards, one per bay
- Bay name + type icon
- If occupied: customer name, vehicle plate, service in progress, time elapsed, status badge
- If free: "Available" with next scheduled job
- Colour states: available (neutral), occupied (accent), quality check (amber), ready (green), blocked (red)

**ApprovalCard** — urgent decision UI
- Must communicate urgency without being panic-inducing
- Clear: what extra work is being requested, why, exact price impact, exact time impact
- Photos from studio (showing the issue)
- APPROVE / REJECT as equal-weight primary buttons (green / red)
- Timer if studio set expiry

**JobPhotoGallery** — the core quality-proof surface
- Stage tabs: Intake / In Progress / Quality Check / Complete
- Swipe or tap through photos within each stage
- Before/after comparison: pinch-to-compare or swipe comparison for intake vs complete photos
- Full-screen zoom
- Timestamp per photo

### Layer 4: Page Templates
- Full-screen modal (booking flow, onboarding)
- Tabbed detail page (vehicle detail, customer 360)
- Split view (admin list + detail panel)
- Dashboard (grid of metric cards + activity feed)

---

## 11.6 Navigation Architecture

### Customer App (bottom tab bar)

```
[ Home ] [ Garage ] [ Book ] [ History ] [ You ]
```

- **Home** — vehicle state hub (the most important screen)
- **Garage** — all vehicles; tap into vehicle detail → passport, protections
- **Book** — service browser; leads into booking flow (modal overlay)
- **History** — completed jobs; tap into job detail with photos, invoice, warranty
- **You** — profile, membership, notification preferences, settings

Tab bar visible on all top-level screens. Hidden inside booking flow, onboarding, and payment (full-screen flows).

Modal sheets for: approval request, payment, warranty certificate detail, booking confirmation — these feel like interruptions that demand attention without losing place in the underlying screen.

### Studio App (bottom tab bar on iPhone / sidebar on iPad)

```
[ Queue ] [ Walk-in ] [ Bays ] [ Inventory ] [ Me ]
```

On iPad landscape: left sidebar (collapsible) + main content area. Job card opens in the main content area (not as a modal) — more usable for detailed operational work.

### Admin Web (left sidebar)

```
Dashboard
Bookings
  ├── Calendar
  └── List
Jobs
Customers
Vehicles
Employees
Memberships
Services
Inventory
Invoices
Reports
  ├── Revenue
  ├── Jobs
  ├── Membership
  └── Inventory
Audit Log
Settings
  ├── Studio
  ├── Bays
  └── Account
```

Top bar: global search (cmd+K shortcut), notification bell (pending approvals, activations, low stock), user menu (logout, account).

Breadcrumbs for all sub-navigation.

---

## 11.7 Motion Principles

Motion is functional, not decorative.

**Rules:**
1. Motion must communicate something (state change, direction, relationship)
2. Never animate for the sake of visual flair
3. Reduce motion media query must be respected (essential for accessibility)
4. No parallax effects
5. No physics simulations (spring animations where the UI bounces around)

**Duration guidelines:**
- UI feedback (button tap, toggle): 100-150ms
- Screen transitions: 250-300ms
- Status rail progress: 400-500ms (shows advancement through stages)
- Celebratory moments (booking confirmed, job complete): 500-600ms (a single tasteful animation)

**Specific animations to design:**
- StatusRail: when a status advances, the filled bar grows left-to-right (direction conveys progress)
- Booking confirmation: a brief success moment — not a confetti explosion, just a clean completion animation
- WarrantyCertificate: subtle entrance animation (slide up from bottom of screen)
- Loading states: skeleton placeholders everywhere — no spinners in content areas

---

## 11.8 Photography & Visual Content Strategy

**Vehicle photography:**
- Clean background (white or very light grey)
- High-contrast, properly exposed
- Before/after pairs must be shot from identical angles and distances
- Before/after is a hero product feature — it must be done properly, not as an afterthought

**Service photography:**
- Show actual work quality (the PPF film edge alignment, the ceramic gloss, the detail work)
- Shot in the studio — real environment, real work
- Not stock photos. Not competitor photos.
- Lighting: studio lighting that shows surface quality (ceramic gloss, PPF clarity)

**Studio photography:**
- The workspace should look premium: clean, organized, well-lit, professional
- Cars in bays at various stages
- Equipment and products (LLumar, XPEL film rolls, Ceramic Pro bottles) shown naturally

**Customer-uploaded photos (vehicle registration, condition documentation):**
- UI must guide customers to take usable photos (angle guidance, lighting tip)
- Accept any quality (it's documentation, not marketing)

**Icons:**
- Line icons — consistent stroke weight
- No mixed icon styles (some filled, some outlined) — pick one and be consistent
- Custom icons for domain-specific concepts (PPF shield, ceramic sphere, bay)
- Standard icons: Lucide or Phosphor (both have React Native and web packages)

---

## 11.9 Accessibility Requirements

**Standard:** WCAG 2.1 AA minimum across all three apps.

**Colour contrast:**
- Body text on background: 4.5:1 minimum
- Large text (20sp+): 3:1 minimum
- UI components and graphics: 3:1 minimum
- Never use colour as the only differentiator (status must use text label + colour + icon, not colour alone)

**Touch targets:**
- Minimum 44×44pt on all interactive elements (Apple HIG standard)
- Destructive actions (cancel, reject, delete): extra spacing around buttons to prevent accidental activation

**Screen readers:**
- VoiceOver (iOS) and TalkBack (Android) compatible
- All images have descriptive alt text (or marked decorative)
- Custom components have appropriate accessibility roles and labels
- Dynamic content changes announced via accessibility live regions

**Localization (V2+):**
- V1: English only. No RTL requirement.
- V2: Hindi and/or Gujarati optional (LTR; no layout changes required)
- V3+: RTL if Arabic localization is ever prioritized (significant layout effort; deferred)

**Dynamic type / font scaling:**
- All text sizes respond to system font size setting
- Layouts must not break at ×2 font scale (test this early, not at the end)

---

## 11.10 Dark Mode

**Dark mode is first-class.**

**Strategy:**
- Customer app: follows system setting by default, with manual override in app settings
- Studio app: dark mode as default (workshop environments, task lighting, evening operations)
- Admin web: user preference, persisted to account settings

**Token design:**
Every colour token has a light and a dark value. Components reference tokens, never hardcoded colours.

```
// Correct
backgroundColor: colors.surface.primary  // → white in light, #1C1C1E in dark

// Wrong
backgroundColor: '#FFFFFF'
```

**Dark mode pitfalls to avoid:**
- Do not simply invert colours — dark mode needs its own considered palette
- Images (vehicle photos, service photos) should not have dark mode tinting applied
- Warranty certificates should be rendered in a fixed "certificate" theme regardless of dark mode (a warranty certificate is a document, not a UI surface)
- Status colours must be calibrated for dark backgrounds (lighter, more saturated variants)

---

## 11.11 Design Tooling

**Figma** for all design work:
- Variables plugin for design token management (colour, spacing, typography tokens)
- Component library in Figma mirrors the code component hierarchy
- Auto Layout for all components (no fixed-size mockups)
- Variants for all states (default, hover, pressed, disabled, dark mode)

**Storybook** for component documentation:
- Every component documented with all variants and states
- Visual regression testing (Chromatic or similar)
- Accessibility checks (axe-core integration)

**Design token pipeline:**
- Figma Variables → exported to W3C Design Token format → imported to:
  - CSS custom properties (admin web / Tailwind theme extension)
  - React Native StyleSheet constants (mobile apps)
- Single source of truth: Figma. Code tokens are generated, not hand-written.

**Design-engineering handoff:**
- No Zeplin or separate spec tools — Figma dev mode is sufficient
- Components are built from Figma as the spec; any visual deviation is a bug to fix
- Design review step before each phase ships (not just before launch)
