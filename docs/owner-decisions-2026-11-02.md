# Owner decisions - 2 November 2026

Source: Meet Sheth, iMessage "All 3" (phonemsg-01M6E9RW910BVRC0PJTQ3AG0M5,
19:44 IST), replying to the exact three-choice summary
(phonemsg-01M6E9P6J8SPHJ6MDE59Q215V0) sent 19:42. Earlier same-day
confirmations (premium 24h cutoff) were not re-asked. See section 4 for
no-show retention: re-checked on reviewer challenge, it is NOT
owner-confirmed. These settle POLICY ONLY - not production release, not
unrelated payment/refund rules.

## 1. Pay-at-studio 20% advance
- Basis: 20% of the **discounted service price including GST, excluding
  pickup/drop**.
- Rounding: advance **rounds up** to the next whole rupee; balance is the
  exact remainder.
- No-show: NOT owner-confirmed - see section 4. No retention or forfeiture
  wording is disclosed to customers until the owner decides.
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
- Cutoff: **24 hours before the current appointment start** (the
  already-agreed rule), kept: a move within 24h of the appointment start
  needs a studio-approved request.
- Wash rule (one free move up to 4h before the appointment start) was
  already accepted by the owner at 16:25 the same day and is unchanged.

## 3. Aadhaar
- **Do not collect Aadhaar.** Staff sign in with email; no Aadhaar
  requirement anywhere. The proposed staff-profile Aadhaar
  request/review/copy/tick flow is CANCELLED. Negative pins (email-alone
  grants sign-in, no Aadhaar gate) are retained as regression guards.

## 4. No-show retention 20% - NOT OWNER-CONFIRMED (decision required)
- Origin (Gauri only): i2i 1 Nov 17:49:30 IST
  (wamid.HBgMOTE4OTc1MTI4ODE2FQIAEhgWM0VCMDk5RDI3RjAzQjNEMURCODI4MwA=),
  restated 2 Nov 13:59:52
  (wamid.HBgMOTE4OTc1MTI4ODE2FQIAEhgWM0VEMUM2MEZCMzk0Q0VBMUU0MTgyNwA=)
  point 5: retain 20% of total service cost on no-show, disclosed before
  payment.
- Presentation check (recovered 2 Nov 21:04 on reviewer challenge): the only
  native ask presenting Gauri's basket to Meet was
  phonemsg-01M6DW99ANRYZWJ1VCX9CTXZ7Z (15:48:38, agent-authored). It
  presented pickup/drop tiers (first 3 road km free per leg, then Rs25/km),
  Garage warranty hiding, and "advance calculation, distance rounding and
  Maps failure handling still need settling". No no-show line.
- User-channel sweep of 2 Nov (iMessage bodies ILIKE no-show / no show /
  retain / retention): ZERO owner-facing mentions of the retention rule.
- "Accept gauris changes" (phonemsg-01M6DYC2Y7Y37546Z0W2VMM0C7, 16:25:06):
  no owner-channel presentation of no-show retention is found in the
  record, so it stays UNCONFIRMED. Whether "Accept" was meant more broadly
  than the 15:48 ask is unresolved - it is not proof the retention line was
  covered, and it is not proof of absence either. "All 3" (19:44) covered
  exactly the 3 groups quoted at 19:42 and neither confirms nor revokes
  no-show. The premium 24h cutoff IS settled independently: the 19:42 offer
  said "Keep the agreed 24-hour cutoff" and "All 3" accepted it.
- My earlier "confirmed" label traced to my own 16:25:47 basket summary,
  relayed to GAURI over i2i, never presented to Meet. That was my error;
  i2i content and agent summaries are not owner authority.
- Consequence: customer-facing disclosure MUST NOT state any retention /
  forfeiture rule until the owner decides. The noShow line is removed from
  advanceDisclosureLines; the flow stays disabled (flag absent everywhere).
- Historical sources conflict and none is actionable owner authority: a
  20 Oct voice note (transcript unrecoverable) recited by the previous
  agent as "retain the full payment" on no-contact no-shows; a dead code
  citation ("WhatsApp 22 Oct 21:22", messages do not exist) claiming
  "Rs 100 or 20%"; Gauri's basket "retain 20% of total service cost".
  Do NOT act on any of these. A single recommendation is prepared below.

## 5. No-show money policy - RECOMMENDATION for the owner (draft, undecided)
Recommended single rule: a no-show forfeits exactly the 20% advance, for
BOTH payment modes, disclosed before payment.
- Pay-at-studio advance (the adopted flow): the studio keeps the 20%
  advance already paid; nothing more is charged; the balance is cancelled
  with the booking. Execution: no money movement needed - the advance
  payment is already completed; booking closes as no-show.
- Full-online prepayment (if ever offered): retain 20% of the service
  price incl GST and refund the rest through the normal refund route
  (outbox reservation, office review). Execution: refund reservation of
  (paid - 20% of service incl GST); never automatic without review.
- Late cancellation is a SEPARATE event with its own terms (still
  unsettled); no-show is never silently treated as a late cancel and this
  rule introduces no cancellation fee.
- Why this one: one uniform 20% number matches the advance the owner
  already adopted, is simple to disclose in one sentence, needs no new
  money movement in the adopted pay-at-studio flow, and avoids the
  voice-note "retain full payment" outcome, which is harsher than the
  advance itself and was never confirmed.
- If the owner picks something else, the disclosure copy and the admin
  no-show review candidates change, nothing else is pre-built on this.

## Explicitly still NOT decided / out of scope
- Refund terms (full-online refunds, late-cancel refunds, and any
  interaction with no-show retention).
- Automatic road-distance pickup pricing: stays OFF. Google's per-use billing
  would require enabling paid APIs, which the standing no-paid-services
  instruction rules out. The existing tiered-distance pickup pricing and the
  manual studio quote path are unchanged.
- Production release of any of the above.
