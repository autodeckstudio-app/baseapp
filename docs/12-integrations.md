# 12 — Integrations

**Principle:** Every integration lives server-side (Cloud Functions). No API keys in client bundles.  
**Cost rule:** Every service is classified below. Do not use a paid service without owner approval.

---

## 12.1 Firebase Suite

### Firebase Authentication
| Service | Cost |
|---|---|
| Phone OTP (up to 10k/month) | FREE |
| Beyond 10k OTPs/month | ~$0.01-0.02/OTP (USAGE COST) |
| FCM push | FREE |
| App Check | FREE |

- **Phone OTP** — primary (India market standard)
- **No Google Sign-In in V1** — avoids Apple Sign-In requirement on iOS
- Custom claims: `{ role, tenantId, studioId }`
- Session cookies (admin web): httpOnly, Secure, SameSite=Strict, 14-day expiry
- Native apps: Firebase ID tokens managed by Firebase Auth SDK

### Firestore
| Service | Cost |
|---|---|
| Firestore (Blaze, within free quotas) | FREE TIER |
| Beyond free quotas | USAGE COST (pay-as-you-go) |

- Region: `asia-south1` (Mumbai) — lowest latency for India
- Offline persistence: enabled on both mobile apps
- Security rules: tenant isolation enforced (`request.auth.token.tenantId === resource.data.tenantId`)
- All role checks via custom claims (not document reads)
- Requires Blaze plan (credit card linked, no subscription charge at small scale)

### Firebase Storage
| Service | Cost |
|---|---|
| Storage (up to 5 GB) | FREE |
| Beyond 5 GB | USAGE COST |

Bucket structure:
```
vehicles/{vehicleId}/primary.jpg
vehicles/{vehicleId}/photos/{hash}.jpg
jobs/{jobId}/{stage}/{timestamp}-{employeeId}.jpg
invoices/{jobId}/invoice.pdf
warranties/{warrantyId}/certificate.pdf
```

- Private assets: signed URLs (1-hour expiry for app, 7 days for warranty share links)
- Upload flow: client requests signed URL from Cloud Function → PUT to Storage directly
- Public: only `gallery/` path

### Cloud Functions
| Service | Cost |
|---|---|
| Cloud Functions (within free quotas) | FREE TIER |
| Beyond free quotas | USAGE COST |

- Requires Blaze plan
- HTTP functions: booking, payments, jobs, approvals, auth, notifications
- Firestore triggers: audit log, notifications, denormalization
- Scheduled functions: booking expiry (daily cron)
- Middleware on all HTTP functions: auth → role → Zod validation → rate limiting → idempotency → business logic → audit log

### FCM (Push Notifications)
| Service | Cost |
|---|---|
| FCM | FREE (unlimited) |

- All pushes sent from Cloud Functions only
- Device tokens stored per user, refreshed on app open
- Every notification tap deep-links to relevant screen

### Firebase Analytics + Crashlytics
| Service | Cost |
|---|---|
| Firebase Analytics | FREE |
| Firebase Crashlytics | FREE |
| BigQuery export | FREE TIER (first 1 TB queries/month free) |

---

## 12.2 Payments: Razorpay

**Primary payment gateway for India.**

| Service | Cost |
|---|---|
| Razorpay setup | FREE |
| Monthly subscription | NONE |
| UPI (gateway-routed) | TRANSACTION FEE: 2% + 18% GST |
| Cards + net banking | TRANSACTION FEE: 2% + 18% GST |
| EMI / Pay Later | TRANSACTION FEE: 3% + 18% GST |
| Razorpay sandbox | FREE |

### Why Razorpay (not Stripe)
- India's standard: better UPI/net banking support than Stripe
- UPI AutoPay (recurring mandates) for membership subscriptions
- Payment Links: studio sends a trackable payment URL via WhatsApp → customer pays without installing anything
- No monthly fee; pure transaction cost
- Better developer documentation for India-specific payment flows

### V1 Payment Flow (Payment Links — no in-app card form)

```
1. Studio marks job ready for payment (studio app)
2. Cloud Function: POST /razorpay/create-payment-link
   → Input: { jobId } — amount computed server-side, NEVER from request
   → Razorpay API creates payment link for the computed amount
   → Returns: { paymentLinkUrl, paymentLinkId }
3. Cloud Function sends WhatsApp message to customer with payment link
4. Customer opens link in any browser → pays via UPI/card/net banking
5. Razorpay webhook → Cloud Function validates signature → updates payment record → notifies customer
```

The customer does not need to be in the AutoDeck app to complete payment. This matches how India's premium service businesses operate today.

### Razorpay Webhook Events

```typescript
// Cloud Function: POST /webhooks/razorpay
// Validates: Razorpay-Signature header (HMAC-SHA256)
'payment_link.paid'           → mark payment completed, update job, notify customer
'payment.failed'              → notify customer, retry option
'refund.created'              → update payment status, notify customer
'subscription.charged'        → activate/renew membership
'subscription.halted'         → notify admin + customer, membership suspended
```

### UPI AutoPay (Membership Recurring — V2)

Razorpay Subscriptions supports UPI AutoPay (NACH mandate):
- Customer authorizes mandate once via their UPI app (Google Pay, PhonePe, Paytm)
- Monthly billing happens automatically
- No card required
- This is the correct mechanism for Indian membership subscriptions

### Razorpay Test Keys

Razorpay provides free sandbox environment with test card numbers and test UPI IDs.
All development uses Razorpay test keys. No real charges during development or CI.

### Refunds

Admin-only Cloud Function. Never customer-initiated directly. Razorpay API `refund.create`.

---

## 12.3 WhatsApp Business API (Meta Cloud API)

**Non-optional for India.** Indian customers expect WhatsApp updates for every stage.

| Service | Cost |
|---|---|
| Meta Cloud API setup | FREE |
| Utility messages | USAGE COST (~₹0.115/message) |
| Authentication messages | USAGE COST (~₹0.115/message) |
| Marketing messages | USAGE COST (~₹0.86/message) |
| Service replies (24h window) | FREE |
| Paid BSP (AiSensy/Wati) | SUBSCRIPTION — REQUIRES APPROVAL |

### Development Setup

Use Meta Cloud API directly:
1. Create Meta Business Account (free)
2. Add WhatsApp Business app to Meta account (free)
3. Get test WhatsApp number (free sandbox for development)
4. Register message templates (free; 7-14 days approval time)

Do not subscribe to any BSP (AiSensy, Wati, Interakt) during development.

### Templates to Register (6-8 weeks before launch)

| Template | Category | Key Variables |
|---|---|---|
| `booking_confirmed` | Utility | service, date, time, reference |
| `job_started` | Utility | vehicle, service |
| `approval_required` | Utility | description, price, link |
| `vehicle_ready` | Utility | vehicle, studio_name |
| `payment_link` | Utility | amount (INR), link |
| `invoice_ready` | Utility | service, amount, download_link |

Register templates in English. Hindi templates optional for Phase 2.

### Cloud Function Integration

```typescript
async function sendWhatsApp(phone: string, templateName: string, variables: string[]) {
  // POST https://graph.facebook.com/v18.0/{phoneNumberId}/messages
  // Authorization: Bearer {META_API_TOKEN}  (server-side only, never in client)
  // Body: { messaging_product: 'whatsapp', to: phone, type: 'template', template: { name, language: { code: 'en' }, components } }
}
```

All WhatsApp messages sent from Cloud Functions only. Never from client. Opt-out respected from customer notification preferences.

---

## 12.4 Email: Resend (Free Tier)

| Service | Cost |
|---|---|
| Resend (up to 3,000 emails/month, 100/day) | FREE TIER |
| Resend beyond free tier | SUBSCRIPTION — REQUIRES APPROVAL |

Use cases in V1/V2:
- Invoice delivery (PDF link or attachment)
- Warranty certificate (PDF link)
- Booking confirmation (text summary)
- Admin account welcome

### Alternative: Nodemailer + Gmail SMTP

If Resend free tier is insufficient: Nodemailer with Gmail App Password — 500 emails/day free, no credit card required. Suitable as Phase 1 fallback.

---

## 12.5 PDF Generation: PDFKit

| Service | Cost |
|---|---|
| PDFKit (npm: `pdfkit`) | FREE (open-source, MIT) |

Use cases:
- Invoice PDF (line items, amount, payment status, studio branding)
- Warranty certificate PDF (product, coverage, dates, installer, certificate number)

PDFKit runs inside Cloud Functions — no external service, no cost. Generates PDFs programmatically. Sufficient for structured documents without complex layouts.

If complex HTML/CSS layouts are needed later: Puppeteer inside Cloud Functions (free but adds ~170MB to function bundle — evaluate at that point).

---

## 12.6 SMS (Authentication Only)

Firebase Auth handles OTP SMS delivery natively for phone sign-in. No external SMS provider needed.

Beyond authentication: avoid SMS for other notifications. WhatsApp is the preferred channel in India; SMS adds cost with lower engagement.

---

## 12.7 Maps & Location

| Service | Cost |
|---|---|
| Google Maps Static API | FREE TIER ($200/month credit, covers ~100k static map loads) |
| Google Places Autocomplete | FREE TIER ($200/month credit, covers ~50k requests) |

Use for:
- Pickup/drop address autocomplete (Google Places, V2+)
- Studio location map on booking confirmation (Google Maps Static, V2+)

Not needed in V1 (pickup/drop is not in V1 scope).

---

## 12.8 Error Tracking & Monitoring

| Service | Cost |
|---|---|
| Firebase Crashlytics | FREE |
| Firebase Console (function logs) | FREE |
| UptimeRobot | FREE TIER (50 monitors) |

- Firebase Crashlytics: both mobile apps, unlimited crashes, free
- Firebase Console: Cloud Function errors, logs, traces — sufficient for V1
- UptimeRobot: health check on a Cloud Function endpoint — free

No Sentry subscription needed. Evaluate only if Firebase Console is insufficient at scale.

---

## 12.9 CI/CD

| Service | Cost |
|---|---|
| GitHub Actions | FREE (public repos, or 2,000 min/month on private) |
| EAS Build (dev/preview profiles) | FREE TIER (15 builds/month) |
| Vercel (admin web) | FREE TIER (Hobby plan — 100 GB bandwidth) |

### GitHub Actions Workflows

**On PR:**
- Lint + typecheck (all packages)
- Unit tests (Vitest)
- Integration tests (Firebase Emulator)
- Firestore rules tests

**On merge to main:**
- All PR checks
- Deploy Cloud Functions to staging
- Deploy admin web to Vercel (staging)

**On release tag:**
- Deploy functions to production
- Deploy admin web to Vercel (production)
- Trigger EAS Build (mobile apps, production profile)

EAS builds are free for 15/month per account. Sufficient for development. When free limit is hit in production: REQUIRES APPROVAL for paid EAS plan ($99/month).

---

## 12.10 Cost Summary

**Development monthly cost: ₹0**

| Trigger for First Paid Cost | Approx. Cost |
|---|---|
| Google Play developer account (one-time) | $25 (~₹2,100) |
| Apple Developer Program (annual) | $99/year (~₹8,300) |
| Firebase Blaze (if free quotas exceeded) | USAGE COST — pay-as-you-go |
| Razorpay (when first real payment processes) | 2% + GST of transaction |
| WhatsApp messages (when first sent) | ~₹0.115/message |
| Resend (if >3k emails/month) | $20/month |
| EAS Build (if >15 builds/month) | $99/month |

None of these occur during development. All require explicit approval before incurring cost.

---

## 12.11 Deferred Integrations (V3+)

| Integration | Reason Deferred |
|---|---|
| Parts supplier API | Requires supplier partnerships |
| Accounting software (Tally, Zoho Books) | V2+ when reporting matures |
| RTO/Vahan (vehicle registration verification) | Nice to have, not critical |
| WhatsApp two-way chat | Significant product scope |
| Loyalty/rewards platform | Post product-market fit |
| Multi-tenant billing (Razorpay marketplace) | When second tenant onboards |
