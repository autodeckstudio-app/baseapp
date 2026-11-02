# Owner decisions - 2 November 2026

Source: Meet Sheth, iMessage "All 3" (phonemsg-01M6E9RW910BVRC0PJTQ3AG0M5,
19:44 IST), replying to the exact three-choice summary
(phonemsg-01M6E9P6J8SPHJ6MDE59Q215V0) sent 19:42. Earlier same-day
confirmations (no-show retention 20%, premium 24h cutoff) were not re-asked.
These settle POLICY ONLY - not production release, not unrelated
payment/refund rules.

## 1. Pay-at-studio 20% advance
- Basis: 20% of the **discounted service price including GST, excluding
  pickup/drop**.
- Rounding: advance **rounds up** to the next whole rupee; balance is the
  exact remainder.
- No-show: advance is **retained** on no-show, disclosed **before** payment
  (confirmed earlier the same day).
- Late-cancel terms: NOT decided - no cancellation wording is introduced.
- Activation still gated on the advance payment mechanism (Razorpay wiring)
  and the final review gate. Code remains disabled until then.

## 2. Premium rescheduling (bigger jobs)
- Scope: ceramic/coating, PPF, garage, mods, tinting
  (core `BIGGER_SERVICE_CATEGORIES`, unchanged).
- **One reschedule request per booking** (strict, total - server-enforced via
  `rescheduleRequestCount` + terminal decisions).
- Declined request, or appointment missed: **further changes go through the
  studio** (both sides). The server's legacy missed-move bypass no longer
  applies to premium categories.
- Cutoff: **24 hours** from the current time (the already-agreed rule), kept.
- Transitional wash behaviour (one free move up to 4h) is unchanged and
  remains owner-pending for later confirmation.

## 3. Aadhaar
- **Do not collect Aadhaar.** Staff sign in with email; no Aadhaar
  requirement anywhere. The proposed staff-profile Aadhaar
  request/review/copy/tick flow is CANCELLED. Negative pins (email-alone
  grants sign-in, no Aadhaar gate) are retained as regression guards.

## Explicitly still NOT decided / out of scope
- Refund terms (incl. full-online x no-show retention interaction).
- Automatic road-distance pickup pricing: stays OFF. Google's per-use billing
  would require enabling paid APIs, which the standing no-paid-services
  instruction rules out. The existing tiered-distance pickup pricing and the
  manual studio quote path are unchanged.
- Production release of any of the above.
