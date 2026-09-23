# 15 — App Store & Google Play Store Strategy

**Scope:** Publishing strategy for the AutoDeck Customer App and AutoDeck Studio App on both platforms.  
**Apps to publish:** Two separate apps — AutoDeck (customer) and AutoDeck Studio (studio operations).

---

## 15.1 Apple Developer Account Setup

### Account Type
- **Apple Developer Program** — business account (not personal)
- Required so the company name appears on App Store listings, not an individual's name
- Cost: USD $99/year (~₹8,300/year) — REQUIRES APPROVAL before opening account
- Registration requires: India business entity (company registration or proprietorship), D-U-N-S number (free, takes 1-5 business days to obtain if not already registered), business legal name, address, phone

### Team Configuration
- Team Agent (owner): business owner
- Admin role: lead developer(s)
- Developer role: engineers
- Certificates and provisioning profiles managed via EAS (no manual certificate management needed)

### Required Before Submission
- Privacy Policy URL (must be live, accessible without login)
- Support URL
- App Review contact (name, phone, email — for review team to reach you)
- App-specific password for TestFlight/EAS Submit

---

## 15.2 App Store Listings

### AutoDeck (Customer App)

| Field | Value |
|---|---|
| **App Name** | AutoDeck |
| **Subtitle** (30 chars) | Premium Car Care Platform |
| **Category** | Lifestyle (primary), Travel (secondary) |
| **Age Rating** | 4+ (no objectionable content) |
| **Price** | Free |

**Keywords (100 chars total — research actual India App Store search volume):**
`car service, car detailing, PPF, ceramic coating, car wash, auto care, Ahmedabad, car care, vehicle care`

**Description (4000 chars) — English:**
```
AutoDeck is the premium automotive care platform trusted by car owners 
who care about their vehicles.

Book PPF installation, ceramic coating, detailing, and car wash services 
from your favourite studio. Track your service in real-time, view 
studio photos as work progresses, and receive your warranty certificate 
the moment your car is complete.

YOUR CAR, YOUR HISTORY
Every service is logged to your vehicle's permanent passport. See 
before-and-after photos, review warranty coverage, and track protection 
status — all in one place.

COMPLETE VISIBILITY
Know exactly what's happening to your car at every stage. Real-time 
status updates, studio photos, and direct communication — no more 
wondering.

TRANSPARENT PRICING
See the exact price before you book. No surprises. No hidden fees.

QUALITY YOU CAN TRUST
Every service comes with a warranty. PPF installations include up to 
10-year coverage. Your warranty certificate is issued digitally the 
moment your car is delivered.

MEMBERSHIP BENEFITS
Join AutoDeck Club for premium wash credits, priority booking, and 
exclusive member discounts. Monthly plans with no lock-in.
```

**Screenshots required:**
- iPhone 6.9" (required)
- iPhone 6.5" (required)
- iPad 12.9" (required if app supports iPad)

**Screenshot content per frame (6 screenshots recommended):**
1. Home screen — vehicle state hub showing active service with live tracking
2. Service catalogue — PPF/ceramic options with pricing and warranty info
3. Booking flow — date/time selection with clean UI
4. Live tracking — job in progress with studio photos
5. Vehicle passport — protections and warranty certificates
6. Warranty certificate — premium certificate visual

**App Preview video:** 15-30 seconds. Show the booking flow + live status update. No voiceover required.

### AutoDeck Studio (Studio App)

| Field | Value |
|---|---|
| **App Name** | AutoDeck Studio |
| **Subtitle** (30 chars) | Studio Operations Platform |
| **Category** | Business |
| **Price** | Free |
| **Availability** | All countries (India primary; no reason to restrict globally) |

**Description:** Operational app for AutoDeck-partnered studios. Manage jobs, advance service status, capture photos, handle approvals, record payments, and run daily studio operations.

**Note:** Studio app can be listed as unlisted/invite-only on App Store Connect if desired (requires requesting unlisted distribution — not publicly searchable). This is optional.

---

## 15.3 Google Play Store

### Developer Account
- **Google Play Developer account**: USD $25 one-time registration fee (~₹2,100) — REQUIRES APPROVAL before opening account
- Business account (not personal)
- India business entity
- Payment profile linked to India bank account or card

### Play Store Listing

**AutoDeck (Customer App):**
| Field | Value |
|---|---|
| **App Name** | AutoDeck |
| **Short Description** (80 chars) | Premium automotive care — book, track & protect your car |
| **Category** | Auto & Vehicles |
| **Content Rating** | Everyone |
| **Price** | Free |

Full description: same content as App Store, adapted for Play Store (no need for different content).

**Data Safety form (mandatory):**
Declare all data collected:
- Personal info: name, phone number, email
- Photos: vehicle photos
- Location: pickup address (collected but not background-tracked)
- Financial: payment info (processed by Razorpay, not stored by AutoDeck)
- App activity: service booking history, notifications clicked
- Device: device identifiers (FCM tokens)

All data is encrypted in transit. User can request deletion (in-app account deletion flow).

**App Signing:**
Use Google Play App Signing (recommended). Google manages the signing key. Cannot be changed after first upload — choose this at first submission.

### Target API Level
Always target the current required minimum API level (Google updates this requirement annually for Play Store submissions). As of 2026: target Android 14 (API 34) minimum.

---

## 15.4 EAS Build Configuration

### Customer App (`apps/customer/eas.json`)

```json
{
  "cli": { "version": ">= 14.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "APP_ENV": "development", "FIREBASE_PROJECT": "autodeck-dev" }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "resourceClass": "m-medium" },
      "android": { "buildType": "apk" },
      "env": { "APP_ENV": "staging", "FIREBASE_PROJECT": "autodeck-staging" }
    },
    "production": {
      "ios": { "autoIncrement": "version", "resourceClass": "m-medium" },
      "android": { "buildType": "aab", "autoIncrement": "versionCode" },
      "env": { "APP_ENV": "production", "FIREBASE_PROJECT": "autodeck-prod" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "developer@autodeck.ae",
        "ascAppId": "APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./secrets/play-store-key.json",
        "track": "internal"
      }
    }
  }
}
```

### Secrets Management
All sensitive build values stored in EAS Secrets (not in eas.json):
- `APPLE_APP_SPECIFIC_PASSWORD`
- `FIREBASE_GOOGLE_SERVICES_INFO_PLIST` (iOS)
- `FIREBASE_GOOGLE_SERVICES_JSON` (Android)
- `RAZORPAY_KEY_ID`
- Play Store service account key (file secret)

---

## 15.5 App-Specific Requirements

### Apple Sign-In (Required for iOS)
Apple requires that any iOS app offering third-party social login must also offer Apple Sign-In. AutoDeck offers phone OTP + Google Sign-In — therefore Apple Sign-In is required.

Implementation: `expo-apple-authentication` handles the native Apple Sign-In flow. Cloud Function verifies the identity token on the server side.

### Privacy Manifest (iOS 17+)
Required for all apps submitted to App Store as of 2024. AutoDeck must declare:
- `NSUserDefaults` usage (expo-secure-store, react-native-async-storage)
- `File timestamp` (photo capture)
- `Disk space` (Firestore offline cache)
- Network domains (Firebase, Razorpay, WhatsApp/Meta API endpoints)

This is configured in `app.json` `expo.ios.privacyManifests` — review Expo documentation at implementation time for current format.

### Push Notifications Permission
The system permission prompt appears at most once on iOS. Design it to appear after the customer confirms their first booking — the highest acceptance-rate moment.

Do NOT ask for push permission on first app open. Customer has no context for why AutoDeck needs notifications.

### App Tracking Transparency (ATT — iOS 14.5+)
If Firebase Analytics uses IDFA for attribution tracking, ATT prompt is required. Options:
- Enable ATT (some customers will deny → reduced analytics data)
- Disable IDFA usage in Firebase Analytics (no ATT prompt needed; SKAdNetwork attribution only)

**Recommendation:** Disable IDFA usage. Firebase Analytics works without IDFA; ATT prompt friction is not worth the marginal attribution improvement for an automotive service app.

### In-App Purchases vs External Payment

**Risk:** Apple requires that any digital subscription purchasable in the app must be offered via Apple In-App Purchase (IAP), with Apple taking 15-30%.

**AutoDeck membership is a subscription.** If the customer app includes a "Join Membership" flow that accepts payment, Apple may require IAP.

**Mitigations used by other services:**
1. Link to external web page for payment (the "reader" exception — unclear applicability)
2. Remove purchase flow entirely from iOS app; customer buys via website or Android
3. Pay Apple's cut (simplest, most compliant, most expensive)

**Recommendation (V1):** V1 uses Razorpay Payment Links sent via WhatsApp — no in-app payment UI — so IAP is not triggered. At V2+, if in-app membership purchase is added, evaluate IAP requirement with legal/business input. If IAP is required, use Apple Subscriptions for iOS and Razorpay for Android + web.

---

## 15.6 TestFlight (iOS) & Internal Testing (Android)

### TestFlight (iOS)
- Internal testing (up to 100 testers): no App Store review required
- External testing (up to 10,000 testers): requires Beta App Review (~24-48h)
- Use TestFlight for: stakeholder demos, team QA, partner studio testing
- Studio team should test on TestFlight before customer app launches

### Google Play Testing Tracks

| Track | Audience | Review Required |
|---|---|---|
| Internal testing | Up to 100 internal testers | No |
| Closed testing (Alpha) | Invited testers only | No |
| Open testing (Beta) | Public opt-in | No |
| Production | All users | Yes |

**Strategy:**
- Studio app: Internal testing only initially; move to closed testing when stable
- Customer app: Internal → Closed (invite existing legacy source app customers for feedback) → Open (broader beta) → Production

---

## 15.7 OTA Updates (EAS Update)

OTA updates deploy JS changes without going through App Store review. Use for:
- Bug fixes
- UI copy changes
- New screens (JS-only)
- Feature flag changes

**Rollout strategy:**
1. Deploy to 10% of users; monitor Crashlytics and user reports
2. After 24h with no regressions: expand to 50%
3. After 24h: expand to 100%

**What requires a full store submission:**
- New native module (expo install adds native code)
- New app permission (microphone, contacts, etc.)
- App icon or splash screen change
- Expo SDK version bump
- Binary-level changes

Keep EAS Update separate channels for customer and studio apps. Never cross-channel.

---

## 15.8 App Store Optimization (ASO)

### Keyword Research
Before finalizing keywords, research actual search volume in India App Store:
- Tools: AppFollow, Sensor Tower, App Annie (now data.ai)
- Key terms to evaluate: "car service ahmedabad", "car wash app", "PPF installer", "auto detailing app", "car care india", "ceramic coating"
- Hindi/Gujarati keyword variants: add in V2 when regional language listing is added

### Rating Strategy
Prompt for rating after a genuinely positive moment:
- After "Vehicle Ready" notification is acknowledged (the car is done!)
- After warranty certificate is viewed for the first time
- After first membership wash is used

**Never prompt:**
- On first app open
- Immediately after a payment
- During an error state

### Review Response Policy
- Respond to all App Store reviews within 24 hours
- Positive reviews: brief acknowledgement
- Negative reviews: apologize, offer resolution, provide support contact
- Bug reports in reviews: acknowledge the bug, note it's being fixed

---

## 15.9 Launch Strategy

### Pre-Launch (8 weeks before)

**Week -8 to -5:**
- All internal testing complete
- Studio team trained on Studio App (internal TestFlight/internal track)
- Studio App is production-ready before customer app launches
- Customer beta: 20-50 existing legacy source app customers invited via TestFlight

**Week -4 to -2:**
- Address beta feedback (OTA updates for JS fixes; store resubmission for native changes)
- App Store listing assets complete (screenshots, description, preview video)
- Privacy policy and terms of service live at autodeck.ae/privacy and /terms
- Apple/Google review timeline: submit 2 weeks before target launch

**Week -1:**
- App Store submission approved (targeting)
- Marketing materials ready
- Support team briefed on common issues
- Monitoring dashboards live (Crashlytics, App Store Connect, Firebase)

### Launch Day

- Publish apps to production
- Monitor Crashlytics for crash rate in first hour
- Monitor Firebase Console for unusual traffic patterns
- Monitor App Store reviews (new ones appear within hours)
- Support team active for increased inquiries
- No OTA updates on launch day (give the build time to stabilize)

### Post-Launch (first 2 weeks)

- Daily check of Crashlytics crash-free sessions rate (target: > 99%)
- Daily check of App Store / Play Store ratings (target: 4.0+ at launch week)
- Weekly OTA update cadence for bug fixes
- First major feature update: 4 weeks post-launch (Phase 3 work)
