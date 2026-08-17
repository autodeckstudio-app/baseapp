# 17 — Open Decisions

These are decisions that must be made before or during implementation. Each has a recommendation, but the final call is the business owner's.

**Format:** Decision / Context / Options / Recommendation / Owner / Must decide by

---

## D-01: India Business Entity for App Store Accounts

**Decision:** Which India-registered legal entity name will appear on Apple App Store and Google Play Store listings?

**Context:** App Store and Play Store accounts must be registered under a business entity. The business name on the listing is permanent (or very difficult to change). It affects customer trust and brand recognition.

**Options:**
1. Existing operating entity (The Betel Store or current registered name) with "AutoDeck" as the app display name
2. New entity registered specifically for AutoDeck product

**Cost classification:**
- Apple Developer Program: $99/year (~₹8,300) — REQUIRES APPROVAL
- Google Play Developer: $25 one-time (~₹2,100) — REQUIRES APPROVAL

**Recommendation:** List under the existing operating entity with AutoDeck as the app display name. The display name is what customers see; the legal entity name appears only in App Store Connect and Play Console. No need to register a new entity for V1.

**Owner:** Business owner  
**Must decide by:** Before Phase 0 (before App Store accounts are opened)

---

## D-02: Brand Name & Domain Confirmation

**Decision:** Is "AutoDeck" the final, locked brand name?

**Context:** The brand name needs to be consistent across: App Store listing, domain (autodeck.in or autodeck.app), WhatsApp Business number display name, Firebase project names, Google Play Store, and all customer-facing materials. Changing the name after launch is expensive.

**Actions needed:**
- Verify `autodeck.in` (and/or `autodeck.app`) domain availability and register it
- Check App Store / Play Store for any existing "AutoDeck" apps (potential rejection risk)
- Check India trademark database (ipindia.gov.in) for conflicts

**Cost classification:** Domain registration — FREE TIER to minimal cost (~₹500-1,000/year depending on registrar).

**Recommendation:** Confirm and register the domain now. Check trademark conflicts before investing in design system.

**Owner:** Business owner  
**Must decide by:** Before Phase 0

---

## D-03: Firebase Region Selection

**Decision:** DECIDED — `asia-south1` (Mumbai, India).

**Context:** Firestore region is fixed at database creation and cannot be changed. AutoDeck's launch market is Ahmedabad, Gujarat, India. `asia-south1` (Mumbai) provides the lowest latency for Indian users and is the correct choice.

**Decision rationale:** India market → India region. AutoModz also uses `asia-south1`. No data residency reason to deviate.

**Owner:** Technical lead  
**Must decide by:** Decided. Implement at project creation.

---

## D-04: Monorepo vs Separate Repositories

**Decision:** Single Turborepo monorepo or separate repos for each app?

**Context:** AutoDeck has five development surfaces (customer app, studio app, admin web, Cloud Functions, shared packages). A monorepo enables shared types and utilities without publishing npm packages. Separate repos give independent CI and release cycles.

**Options:**
1. Turborepo monorepo (all in one repo) — recommended
2. Separate repos (customer, studio, admin, functions, shared) with published npm packages for shared types

**Recommendation:** Turborepo monorepo. The shared types between all surfaces are the primary driver. Type changes surface as errors in all consumers immediately. At this team size, repo-per-surface creates more coordination overhead than it solves.

**Owner:** Technical lead  
**Must decide by:** Before Phase 0 (repo structure is the first thing set up)

---

## D-05: React Native + Expo vs Flutter

**Decision:** React Native + Expo or Flutter for customer and studio mobile apps?

**Context:** This decision determines what language and framework all mobile engineers must know. It affects hiring. Once implemented, switching is costly.

**Options:**
1. React Native + Expo (TypeScript) — recommended
2. Flutter (Dart)

**Recommendation:** React Native + Expo. Primary reason: existing team is TypeScript-proficient from the AutoModz Next.js codebase. Expo SDK covers all required native capabilities (camera, notifications, location, secure storage). EAS gives production-grade build and OTA update pipeline.

**Flutter is not a wrong choice** — it has excellent performance and more consistent cross-platform rendering. If the hired mobile engineer has deep Flutter experience and minimal React Native experience, Flutter is worth reconsidering.

**Owner:** Business owner (in consultation with hired lead engineer)  
**Must decide by:** Before Phase 0 — hiring depends on this

---

## D-06: Studio App Primary Device

**Decision:** Is the Studio App primarily designed for iPad (tablet) or iPhone (phone)?

**Context:** The studio environment typically has a shared tablet mounted in the workspace for operational use. But advisors doing pickup/drop may need a phone. The primary device choice significantly affects the UI layout.

**Options:**
1. iPad as primary (tablet layout), iPhone as secondary (phone layout)
2. iPhone as primary (phone layout)
3. Both equally (responsive layout for both)

**Recommendation:** iPad as primary device for in-studio use (job queue, job card, bay board work better on a larger screen), iPhone as the field device (pickup/drop status). Build tablet-first and ensure phone layout works. Responsive approach via Expo's platform detection.

**Owner:** Business owner (based on actual studio workflow)  
**Must decide by:** Before Phase 1c (Studio App design phase)

---

## D-07: Primary Payment Gateway

**Decision:** DECIDED — Razorpay.

**Context:** AutoDeck is India-market. Razorpay is the India-standard payment gateway. Supports UPI, cards, net banking, UPI AutoPay (for membership recurring), and Payment Links (V1 payment flow). See ADR-013.

**Cost classification:** TRANSACTION FEE — 2% + 18% GST. No setup fee. No monthly subscription. Sandbox: FREE.

**Production activation requires:** India-registered business entity with Indian bank account — REQUIRES APPROVAL.

**Owner:** Business owner  
**Must decide by:** Before Phase 2 (payments) — sandbox usable from Phase 0

---

## D-08: BNPL / EMI for India

**Decision:** Which BNPL or EMI option for high-value services in India?

**Context:** PPF and ceramic coating services (₹50,000–₹2,20,000) benefit from EMI options to reduce purchase friction. India's dominant BNPL/EMI options are available natively through Razorpay — no separate provider integration needed.

**India BNPL/EMI options via Razorpay:**
| Option | Notes |
|---|---|
| Bank EMI (HDFC, ICICI, Axis, SBI) | Available via Razorpay; bank handles the EMI |
| Simpl | Pay later; small transaction BNPL |
| LazyPay | BNPL up to ₹1L |
| ZestMoney | Wound down 2023 — unavailable |

**Recommendation:** Enable Razorpay-native EMI options in V2 (no separate integration). Tabby and Tamara are UAE/GCC products — not available in India.

**Owner:** Business owner  
**Must decide by:** Before Phase 2 (payments) — no action required in V1

---

## D-09: WhatsApp Business API Provider

**Decision:** Meta Cloud API directly (recommended) vs BSP middleware (AiSensy, Wati, Interakt).

**Context:** WhatsApp is the non-optional customer communication channel for India. Meta Cloud API is free to set up; cost is per-message (~₹0.115/utility message). BSPs add a subscription fee on top.

**Options:**
1. Meta Cloud API directly — FREE setup; USAGE COST only; full control; requires Meta Business Account + phone verification + template approval
2. AiSensy — ₹1,499/month + per-message cost — SUBSCRIPTION — REQUIRES APPROVAL
3. Wati — ₹2,499/month — SUBSCRIPTION — REQUIRES APPROVAL
4. Interakt — ₹2,499/month — SUBSCRIPTION — REQUIRES APPROVAL

**Recommendation:** Meta Cloud API directly. At AutoModz's V1 volume (10-20 jobs/day), meta API is straightforward and has zero monthly fee. BSPs are not justified until messaging volume creates management overhead.

**Note:** Register message templates at least 6-8 weeks before launch regardless of provider choice — Meta approval takes time.

**Owner:** Technical lead (feasibility) + Business owner (cost)  
**Must decide by:** Before Phase 1b (booking confirmation is the first WhatsApp message)

---

## D-10: AutoDeck Membership Pricing (India, INR)

**Decision:** What are AutoDeck's membership tiers, prices in INR, names, and inclusions?

**Context:** AutoModz has Silver/Gold/Platinum at ₹1,499–5,999/month. These will be the starting reference point for AutoDeck V1 membership pricing. The tier names, price points, wash inclusions, and discount percentages are business decisions. They affect the data model and booking engine.

**Inputs to consider:**
- Current operating costs (wash service cost per session at the Ahmedabad studio)
- Number of washes a customer realistically uses per month
- Competitive pricing in Ahmedabad premium detailing market
- AutoModz existing membership pricing (reference, not binding)

**Recommendation template (starting point for discussion):**
| Tier | Price | Washes | Discount |
|---|---|---|---|
| Silver | ₹1,499/month | 4 washes | 10% on other services |
| Gold | ₹2,999/month | 8 washes | 15% on other services |
| Platinum | ₹5,999/month | 16 washes | 20% on other services |

These numbers are illustrative. Business owner must set final pricing. Prices are admin-configurable in the service catalogue — no code change required to adjust them.

**Owner:** Business owner  
**Must decide by:** Before Phase 2 (membership feature)

---

## D-11: Service Catalogue for AutoDeck Launch

**Decision:** What services does AutoDeck launch with, at what INR prices?

**Context:** AutoModz has INR-priced PPF, ceramic, washing, and coating services. AutoDeck V1 will be seeded with the same service catalogue (INR pricing) as AutoModz, adjusted to match the studio's current operational offerings and pricing.

**Key questions:**
- Which PPF brands will AutoDeck carry? (LLumar, Garware, XPEL, 3M — same as AutoModz or different?)
- Which ceramic coating products? (Kovalent, Graphene Matrix, Borophene, Ceramic Pro, IGL?)
- Will washing be offered at the same INR pricing as AutoModz from day one?
- Are there services the studio wants to add that aren't in AutoModz?

**Note:** Service catalogue prices are mutable (admin can change them). But warranty templates attached to services are snapshotted at job completion — so pricing decisions affect future warranty records.

**Owner:** Business owner  
**Must decide by:** Before Phase 1b (service catalogue must be seeded before customer booking)

---

## D-12: Pickup/Drop — Self-Operated or Third-Party

**Decision:** Will AutoDeck operate its own pickup/drop (employed/contracted drivers) or use a third-party logistics service?

**Context:** AutoModz appears to do its own pickup/drop. At scale, this is operationally complex. Third-party logistics services could handle this but add integration complexity and cost.

**Options:**
1. Self-operated (studio staff or dedicated driver) — full control, complexity at scale
2. Third-party logistics API (e.g., Porter, Dunzo, or local logistics) — outsourced, easier to scale, less control
3. No pickup/drop at Phase 1 — customer brings car to studio (simplest to launch)

**Recommendation:** Start with option 3 (customer-drop-off only) at Phase 1. Add self-operated pickup in Phase 2. Evaluate third-party logistics at Phase 4 when operational volume justifies it.

**Owner:** Business owner  
**Must decide by:** Before Phase 1b (booking flow must know if pickup/drop is offered)

---

## D-13: Car Marketplace — Include in AutoDeck?

**Decision:** Does AutoDeck include a used car buy/sell marketplace?

**Context:** AutoModz has a car marketplace feature (buy/sell listings, leads, sell requests). It's a separate business model from automotive service. GoMechanic does not have a marketplace. This feature adds significant scope and product complexity.

**Recommendation:** EXCLUDE from AutoDeck at launch. Focus the product on what it is: a premium automotive service platform. Car buying/selling is a separate market (OLX, Cars24, CarDekho — all dominant in India). AutoDeck cannot compete meaningfully here and it dilutes the product focus.

**Owner:** Business owner  
**Must decide by:** Before Phase 1 (affects scope)

---

## D-14: Regional Language Localization — Which Phase?

**Decision:** When does Hindi/Gujarati localization ship?

**Context:** AutoDeck launches in Ahmedabad, Gujarat — a market where Gujarati and Hindi are the dominant local languages. However, the premium automotive service segment is largely English-comfortable. English-first launch is standard for Indian premium tech products.

**Options:**
1. V1 (launch in English only) — fastest; sufficient for premium segment
2. V2 (English + Gujarati) — adds local market depth; LTR, no layout changes needed
3. V3 (English + Hindi + Gujarati) — widest reach

**Recommendation:** V1 English-only. V2 or V3 for Gujarati/Hindi when customer feedback indicates demand. Arabic RTL is NOT planned for AutoDeck — this is an India-market product.

**Owner:** Business owner  
**Must decide by:** Before Phase 1 (informs design system — English-only means no RTL planning needed)

---

## D-15: In-App Membership Payment vs External

**Decision:** Should membership payment happen inside the iOS app (risking Apple IAP requirement) or via external payment flow?

**Context:** Apple requires that any digital subscription available in the app be purchasable via Apple In-App Purchase (IAP), with Apple taking 15-30%.

For AutoDeck membership at ~₹2,999/month, Apple's 30% cut = ~₹900/month per subscriber lost.

**V1 position:** V1 uses Razorpay Payment Links sent via WhatsApp — payment happens in the browser, not the app. This avoids the IAP question entirely in V1.

**V2 position (when in-app payment is added):**
1. Use Apple IAP for iOS membership (compliant, expensive: 15-30% cut)
2. Payment outside the app (admin activates membership; customer pays via Razorpay link on web) — iOS app shows membership status and "contact us" but not the buy button
3. Implement Razorpay in-app and see if App Store Review flags it (grey area; carries rejection risk)

**Recommendation:** V1: no action needed (external payment flow avoids IAP). V2: evaluate with legal/business input before implementing in-app payment for memberships.

**Owner:** Business owner (financial impact)  
**Must decide by:** Before Phase 2 (membership feature)

---

## D-16: AutoModz Sunset Timeline

**Decision:** When does AutoModz stop taking new bookings? When do existing customers migrate?

**Context:** AutoModz is a separate product that should continue serving existing customers until AutoDeck is ready. The sunset timeline affects:
- Migration script investment (build now vs later vs not at all)
- Support burden (two products to operate simultaneously)
- Customer communication

**Options:**
1. AutoModz sunsets when AutoDeck Phase 2 ships (aggressive — puts pressure on migration)
2. AutoModz sunsets 6 months after AutoDeck public launch (conservative — gives customers time to migrate)
3. AutoModz continues as a separate PWA product (no sunset — two products in parallel indefinitely)

**Recommendation:** Option 2 if AutoDeck replaces AutoModz for the same customer base. Option 3 if AutoModz is eventually sold or licensed as a separate product.

**Owner:** Business owner  
**Must decide by:** Before Phase 3 (migration planning)

---

## D-17: Multi-Studio Architecture — Day One or Phase 4?

**Decision:** Should the architecture support multiple studios from day one, or be optimized for a single studio initially?

**Context:** The recommended architecture already includes `studioId` on all relevant Firestore documents. Multi-studio support is therefore architecturally available from day one. The question is whether to invest in the admin UI for multi-studio management in Phase 1 or defer to Phase 4.

**Recommendation:** Architect for multi-studio (studioId everywhere — already the recommendation) but operate as single-studio in Phase 1-3 admin UI. Add multi-studio admin UI in Phase 4 only if a second studio is planned.

**Owner:** Business owner (is expansion to multiple studios on the roadmap?)  
**Must decide by:** Before Phase 0 (architecture decision — already reflected in the recommended architecture)

---

## D-18: Warranty Certificate Format

**Decision:** Is the warranty certificate a PDF (generated at job completion) or an in-app digital view only?

**Context:** A physical or PDF warranty certificate is what customers of premium PPF/ceramic coating services expect. They want something they can print, save, share, and reference for insurance claims. An in-app-only view is less credible.

**Options:**
1. PDF generated at job completion (stored in Firebase Storage, downloadable, emailed)
2. In-app digital view only (no PDF, no email)
3. Both (in-app view + PDF download)

**Recommendation:** Option 3 (both). The PDF is essential for premium positioning. The in-app view is convenient for quick reference. These are complementary, not competing.

**Owner:** Business owner  
**Must decide by:** Before Phase 3 (warranty feature)

---

## D-19: Employee App vs Browser for Studio Operations

**Decision:** Should studio staff use the native Studio App (iOS/Android) or a tablet-optimized admin web browser interface?

**Context:** Building a dedicated Studio App (Expo, React Native) is the recommended approach and provides: offline support, camera integration, native push notifications, better UX for operational staff. However, it doubles the mobile development scope.

The alternative — a tablet-optimized admin web interface accessed via Safari/Chrome on iPad — is faster to build but less capable (no offline, limited camera access in browser, no native push).

**Options:**
1. Dedicated native Studio App (recommended)
2. Tablet-optimized admin web (browser on iPad/tablet)
3. Phase 1: browser; Phase 3: native app

**Recommendation:** Dedicated native Studio App. The offline support and native camera workflow are not optional for a studio environment with inconsistent WiFi. Build it properly from Phase 1c.

**Owner:** Business owner (budget/timeline) + Technical lead  
**Must decide by:** Before Phase 1c (studio operations phase)

---

## D-20: Analytics Provider

**Decision:** Firebase Analytics only, or add a dedicated product analytics tool?

**Context:** Firebase Analytics with BigQuery export handles basic event tracking. For deeper product analytics (funnel analysis, user cohorts, A/B testing, conversion attribution), a dedicated tool is better.

**Options:**
1. Firebase Analytics + BigQuery only (free, sufficient for Phase 1-3)
2. Mixpanel (funnel, retention, cohort analysis — ~$25-100/month at startup scale)
3. Amplitude (similar to Mixpanel, slightly better pricing at low volume)
4. PostHog (open-source, self-hostable, generous free tier)

**Recommendation:** Firebase Analytics only for Phase 1-3. Add Mixpanel or PostHog in Phase 4 when product decisions require conversion funnel data.

**Owner:** Business owner  
**Must decide by:** Before Phase 4 (can be decided later; does not block earlier phases)
