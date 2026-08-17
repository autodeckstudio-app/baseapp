# 18 — India Market & Payment Architecture

**Launch market:** Ahmedabad, Gujarat, India.  
**Currency:** INR (₹). **Timezone:** Asia/Kolkata (IST, UTC+5:30).  
**Firebase region:** `asia-south1` (Mumbai).

---

## 18.1 Indian Automotive Service Market

### Current Landscape (Ahmedabad)

**CarzSpa** is the most relevant direct competitor:
- 125+ franchise studios across 75+ cities; 4+ locations in Ahmedabad
- Services: detailing, ceramic coating (own brand "CrystalShield"), PPF ("Aegis" brand, self-healing)
- **Booking model: WhatsApp + phone callback only** — no real-time native app, no live tracking, no digital warranty

**GoMechanic** (post-fraud recovery):
- ₹210 Cr revenue FY2023-24; EBITDA-positive Q1 FY2024-25
- 1,000+ service centres, 50+ cities
- Services: periodic maintenance, detailing, ceramic/PPF, AC, suspension, tyres, EV
- Payment: UPI, cards, net banking, cash; membership (GoMechanic Miles)
- Booking: app-based, upfront fixed pricing, pickup/drop, live tracking
- **Functional reference only** — do not copy design, brand, or implementation

**Pitstop**: Bengaluru-focused, ₹18K revenue March 2025 — not a meaningful competitor.

### The Market Gap AutoDeck Is Entering

Most Indian premium detailing/PPF/ceramic studios (including CarzSpa-level operators) manage operations via:
- WhatsApp groups for booking
- Phone calls for status updates
- Paper job cards
- Manual UPI at handover
- No digital warranty certificate
- No live tracking for customers

**AutoDeck enters this gap** — a proper operational system for premium studios, with a customer app that communicates trust through visibility.

### India-Specific Customer Expectations

- WhatsApp is the primary communication channel — more important than email or SMS
- UPI is the dominant payment method; even large amounts (₹85,000 PPF) paid via UPI
- Phone number is the universal identity — customers expect OTP-based login, not Google SSO
- Hindi/Gujarati language support is important for the Ahmedabad market (English-first launch acceptable)
- Before/after documentation is important for premium services — customers share these on Instagram
- Service history and warranty documentation are underserved needs — this is a genuine differentiator

---

## 18.2 GoMechanic as Functional Reference

**What to study (functional only):**
- Upfront fixed pricing → eliminates trust friction
- Digital inspection at vehicle collection → protects both parties
- Live status tracking in app → reduces customer anxiety
- Pickup/drop with pre-inspection → operational best practice
- Membership subscription → increases LTV
- Service Buddy (advisor model) — **do not copy customer-facing identity; use studio brand internally**
- Digital service report + invoice

**What GoMechanic does that AutoDeck will not copy:**
- Mass-market positioning (AutoDeck is premium)
- Commission-based partner model (AutoDeck is B2B SaaS, not marketplace)
- Aggregate garage network (AutoDeck serves individual premium studios)
- GoMechanic branding, colours, visual language

**What GoMechanic doesn't do that AutoDeck should:**
- Premium certificate-style warranty documentation
- Vehicle passport (living history view per car)
- Before/after photo gallery for customer
- Multi-tenant SaaS (studio manages their own instance)

---

## 18.3 Payment Infrastructure

### Primary: Razorpay

**Why Razorpay:**
- Standard for Indian SaaS/fintech; excellent developer documentation
- Supports UPI, cards, net banking, UPI AutoPay (recurring), payment links
- No setup fee, no monthly fee — pure TRANSACTION FEE
- Payment Links: studio sends a trackable payment URL via WhatsApp; customer pays without installing anything
- Subscriptions/recurring billing: supports UPI AutoPay for membership recurring charges

**Fees (as of 2026):**
| Method | Fee |
|---|---|
| UPI (gateway) | 2% + 18% GST |
| Cards & net banking | 2% + 18% GST |
| EMI / Pay Later | 3% + 18% GST |
| International cards | 3% + 18% GST |
| UPI (direct bank) | Zero MDR (government mandate) |

Note: Direct UPI (QR code, VPA) has zero MDR — but these lack trackable payment confirmation for AutoDeck's workflow. Use Razorpay-routed UPI for tracked payment links.

**Cost classification:** TRANSACTION FEE only. No subscription, no minimum.

### Payment Links (Critical for India V1)

The core payment workflow for Indian studio operations today is: **send UPI QR or payment link via WhatsApp → customer pays → studio verbally confirms**.

AutoDeck upgrades this to: **Cloud Function creates Razorpay payment link → sends via WhatsApp → customer pays via any UPI/card → Razorpay webhook confirms → job status updated automatically**.

This is the V1 payment flow. No in-app card entry needed in V1.

### UPI AutoPay (Membership Recurring)

Razorpay supports UPI AutoPay (NACH mandate) for subscriptions:
- Customer authorizes a monthly mandate once (via their UPI app)
- Razorpay charges automatically on the billing date
- No card required — works for customers without cards
- This is the correct recurring payment mechanism for AutoDeck membership in India

### BNPL / EMI (V2+)

Razorpay natively integrates:
- HDFC/ICICI/Axis bank EMI
- Simpl (buy-now-pay-later)
- LazyPay
- ZestMoney (wound down 2023)

No separate BNPL provider integration needed — Razorpay surfaces these as payment options automatically at checkout. Activate in Razorpay dashboard when needed.

### What Not to Use

- **Stripe**: higher fees, limited UPI AutoPay, not optimized for India
- **Tabby**: UAE/GCC BNPL, not available in India
- **PayTm for Business / PhonePe for Business**: viable but Razorpay is better for developers
- **Amazon Pay**: possible but smaller market share for B2B transactions

---

## 18.4 WhatsApp Business API

WhatsApp is the non-optional communication channel for Indian studio operations and customer updates.

### Development Approach (Free)

Use **Meta Cloud API directly**:
- Setup: FREE (requires Meta Business Account + phone number verification)
- Template registration: FREE; Meta approval required (7-14 days typical)
- Cost classification: FREE (setup) + USAGE COST per message in production

### Per-Message Cost (India, 2026)

| Category | Cost |
|---|---|
| Utility messages | ~₹0.115/message |
| Authentication | ~₹0.115/message |
| Marketing | ~₹0.86/message |
| Service (customer-initiated, 24h window) | **FREE** |

For AutoDeck: booking confirmation, job updates, invoice links = utility category = ~₹0.115/message.
Customer replies within 24h window = free. Very low cost in practice for a studio handling 10-20 jobs/day.

### Templates to Register (register 6-8 weeks before launch)

| Template | Category | Variables |
|---|---|---|
| `booking_confirmed` | Utility | service, date, time |
| `job_started` | Utility | vehicle, service |
| `approval_required` | Utility | description, price, link |
| `vehicle_ready` | Utility | vehicle, studio name |
| `payment_link` | Utility | amount, link |
| `invoice_ready` | Utility | service, amount, link |

### BSPs (Avoid During Development)

Paid BSP platforms (AiSensy ₹1,500/month, Wati ₹2,499/month, Interakt) add no value during development. Use Meta Cloud API directly. Evaluate BSPs for production if the team finds the Meta API too complex to manage.

**Cost classification for BSPs:** SUBSCRIPTION — REQUIRES APPROVAL before use.

---

## 18.5 Firebase for India

### Region: `asia-south1` (Mumbai)
Correct for India — lowest latency for Ahmedabad users. Well-established.

### Spark vs Blaze Plan

**Spark (free):**
- 50,000 Firestore reads/day, 20,000 writes/day, 1 GB storage
- Firebase Auth: 10,000 phone OTP verifications/month free
- FCM: FREE, unlimited
- **Cloud Functions: NOT available on Spark**

**Blaze (required for Cloud Functions):**
- All Spark free quotas still apply
- Beyond free quotas: pay-as-you-go
- No minimum charge — linking a credit card is required but you are not billed unless you exceed free quotas
- For early development (1 studio, dev traffic): monthly bill is effectively ₹0

**Required on day one:** Upgrade to Blaze. Link a card. This costs nothing at dev scale.

**Cost classification:** Blaze = FREE TIER (same free quotas as Spark) + USAGE COST (beyond free quotas). Requires credit card but not a paid subscription.

---

## 18.6 Authentication for India

**Phone OTP (Firebase Auth phone sign-in):**
- Primary method. All Indian automotive customers expect this.
- Firebase Auth handles SMS OTP delivery — no external SMS provider needed for auth.
- Firebase SMS rates after free tier: ~$0.01-0.02/OTP (negligible at small scale)

**Apple Sign-In:**
- **NOT required** if AutoDeck uses phone OTP as the only login method (no Google/Facebook social login)
- Apple requires Apple Sign-In only when an app offers third-party social authentication
- Decision: skip Google/Facebook social login → skip Apple Sign-In requirement → significant simplification
- Cost classification: avoiding Apple Developer Program reduces scope; phone OTP only is simpler

**If Apple Sign-In IS required later (if Google login is added):**
- `expo-apple-authentication` handles the flow
- Apple Developer Program: $99/year (~₹8,300) — SUBSCRIPTION — REQUIRES APPROVAL

**Google Sign-In (recommendation: skip for V1):**
- Not needed if phone OTP is available; avoid to also avoid Apple Sign-In requirement

---

## 18.7 App Store / Play Store Costs

| Account | Cost | Classification |
|---|---|---|
| Apple Developer Program | $99/year (~₹8,300/year) | SUBSCRIPTION — REQUIRES APPROVAL |
| Google Play Developer | $25 one-time (~₹2,100) | ONE-TIME FEE — REQUIRES APPROVAL |
| EAS Build (Expo) — dev/preview | Free (15 builds/month) | FREE TIER |
| EAS Build — production scale | $99/month | SUBSCRIPTION — REQUIRES APPROVAL |

**Note on Google Play new account requirements:** New developer accounts must run closed testing for 14 days with a minimum of 12 testers before going to production. Plan for this in launch timeline.

---

## 18.8 Competitive Context: Why AutoDeck Wins in India

| Capability | CarzSpa / Typical India Studio | AutoDeck |
|---|---|---|
| Booking | WhatsApp + phone | Native app, real-time slots |
| Job tracking | No visibility | Live status in customer app |
| Payment | Cash/manual UPI | Razorpay payment link (tracked, confirmed) |
| Warranty documentation | Paper card (if any) | Digital certificate with PDF |
| Service history | No customer access | Permanent vehicle passport |
| Studio software | Paper/WhatsApp | Full studio app (bay board, job card) |
| Notifications | Manual WhatsApp | Automated WhatsApp + push notifications |
| Multi-service coordination | Manual | Bay-aware booking engine |

The gap is real. AutoDeck does not need to beat GoMechanic — it needs to serve the premium segment that GoMechanic's mass-market approach doesn't serve well.

---

## 18.9 Full Cost Classification Summary

| Service | Development | Production | Classification |
|---|---|---|---|
| Firebase (Firestore, Auth, Storage, FCM) | FREE | FREE TIER + USAGE | Blaze plan required (credit card, no subscription) |
| Cloud Functions | Requires Blaze | USAGE COST | Effectively free at small scale |
| Razorpay | Sandbox: FREE | TRANSACTION FEE (2%+GST) | No subscription |
| WhatsApp (Meta Cloud API) | FREE | USAGE COST (~₹0.115/msg) | No subscription |
| WhatsApp BSP (AiSensy etc.) | NOT needed | SUBSCRIPTION | REQUIRES APPROVAL |
| Resend (email) | FREE TIER (3k/month) | FREE TIER / paid | Free tier sufficient for V1 |
| PDFKit (PDF generation) | FREE | FREE | Open-source |
| Firebase Crashlytics | FREE | FREE | Built into Firebase |
| Firebase Analytics | FREE | FREE | Built into Firebase |
| UptimeRobot | FREE TIER | FREE TIER | 50 monitors free |
| Google Play Developer | $25 one-time | — | REQUIRES APPROVAL |
| Apple Developer Program | $99/year | $99/year | REQUIRES APPROVAL |
| EAS Build | FREE TIER | FREE TIER → SUBSCRIPTION | 15 builds/month free |
| GitHub | FREE | FREE | Free for public; free tier for private |

**Total dev infrastructure cost: ₹0/month** (until App Store accounts needed).
