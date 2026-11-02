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
- Slot hold for unpaid advance bookings: OWNER-CONFIRMED 2 Nov 22:01:24 IST
  ("Yes", phonemsg-01M6EHKVGDNCZVGXVHFS8GVXBE, replying to the exact proposal
  phonemsg-01M6EHJX0K9RQMB25685X0XW9H sent 22:00:53). An unpaid advance
  booking holds its slot for 15 minutes (the same hold already used for
  full-online bookings), then releases it if payment has not arrived. The
  booking confirms only after the 20% payment succeeds. Money arriving after
  the hold expires goes to refund review; it does NOT confirm a slot that
  may no longer be available. POLICY ONLY - no production activation and no
  refund execution.

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

## 4. No-show retention 20% - OWNER-CONFIRMED 2 Nov 21:32:50 IST
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
  None of these was acted on.

- APPROVAL CHAIN (iMessage, owner channel): the precise proposal
  (phonemsg-01M6EFFJ34NCEHMR4DB7MHS9MY, 21:24:06) -> Meet "Yes"
  (phonemsg-01M6EFWZEG7P3FH87AGW87AWYS, 21:31:25, attached to an earlier
  thread) -> clarification re-ask naming the exact rule
  (phonemsg-01M6EFX7WNKMRH55MPKW10QXT4, 21:31:35) -> Meet "Yes to the no
  show rule" (phonemsg-01M6EFZJ3S6BG0DGV4VRH52WCE, 21:32:50). The
  clarification makes the "Yes" bind to the 21:24 proposal, not the stray
  thread.
- APPROVED RULE (prospective only): retain 20% of the discounted service
  price incl GST, EXCLUDING unused pickup/drop. Pay-at-studio: keep the
  advance, no further charge. Full-online: keep the same service amount;
  the remainder (incl unused pickup/drop and its GST) goes to Meet for
  refund APPROVAL - never auto-executed. Late cancellations and the old
  Rs 1800-class captured cases stay SEPARATE and undecided. This approval
  is policy only: NOT production activation, NOT refund execution, NOT
  the old cases.

## 5. No-show money policy - ADOPTED by the owner 2 Nov 21:32:50 (see section 4 for the approval chain)
Full-online payment EXISTS today and is unchanged: bookings with
payMode "online" hold as PENDING, the customer pays 100% by payment link,
and the verified webhook confirms the booking. Nothing in this proposal
changes that flow, and no change to full-online happens without the
owner's specific approval.

Adopted rule: on a no-show the studio retains exactly the advance basis -
20% of the discounted service price including GST, EXCLUDING pickup/drop
fees and their GST - and nothing more.

Actual effect per payment mode:
- Pay-at-studio advance (basket item 4, once enabled): the customer has
  paid only the advance. The studio keeps it; the balance is cancelled
  with the booking. Zero money movement needed - no charge, no refund.
- Full-online (existing flow, customer paid 100%): the studio retains the
  SAME amount the advance would have been (20% of the discounted service
  incl GST, excl pickup/drop and their GST) and refunds the rest. The
  refund therefore returns the full 80% service remainder PLUS all unused
  pickup/drop fees and their GST. It is NOT 20% of the entire paid
  amount. Execution: the retained/refund split goes to the office review
  queue; a human approves, then the existing refund outbox moves the
  money. Office review is a decision point, not a completed refund.
- Late cancellation is a SEPARATE event with its own terms (still
  unsettled); a no-show is never silently treated as a late cancel, and
  this rule introduces no cancellation fee. Premium categories keep the
  already-settled 24h cutoff; this rule does not change rescheduling.
- Pre-existing captured-money cases (e.g. cancelled bookings with money
  already received, the Rs 1800-class cases in the review queue) are a
  SEPARATE decision and are not covered by this proposal.

Why this one: one uniform basis matches the advance already adopted, is
disclosable in one sentence, needs no money movement in the adopted
pay-at-studio flow, and treats both payment modes identically in effect.
Historical sources conflict (a 20 Oct voice note recited as "retain the
full payment"; a dead citation claiming "Rs 100 or 20%"; Gauri's "retain
20% of total service cost") - none is actionable owner authority, and
this proposal was not built on any of them. The owner approved exactly
this rule on 2 Nov 21:32:50 (section 4).

## Explicitly still NOT decided / out of scope
- Refund terms (full-online refunds, late-cancel refunds, and any
  interaction with no-show retention).
- Automatic road-distance pickup pricing: stays OFF. Google's per-use billing
  would require enabling paid APIs, which the standing no-paid-services
  instruction rules out. The existing tiered-distance pickup pricing and the
  manual studio quote path are unchanged.
- Production release of any of the above.
