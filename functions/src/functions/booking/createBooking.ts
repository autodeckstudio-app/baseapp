import{isDeepStrictEqual}from "node:util";
import{combinedCheckoutEnabled,combinedGiftCheckoutEnabled,combinedWashCheckoutEnabled,combinedPickupBenefitEnabled,combinedQuoteCheckoutEnabled,reviewCombinedBooking,combinedReviewIdentity}from'../../lib/combined-booking.js';
import { membershipForFreePickup } from "../../lib/pickup-benefit.js";
import{pickupRoadKmForDisplay}from'@autodeck/core';
import { freezeConsultQuoteApproval } from "../../lib/consult-approval-binding.js";
import {acceptedServiceQuote,acceptedQuoteBreakdown} from "../../lib/accepted-service-quote.js";
import type {QuoteJourney} from "@autodeck/core";
import {hasReleasedBay} from "@autodeck/core";
import { customerServiceName } from "@autodeck/core";
import { bookingStartState } from "../../lib/booking-hold.js";
import { advancePaymentEnabled } from "../../lib/advance-payment.js";
import { assertNotPriorityHeld } from "../../lib/priority-access.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type {
  Gift,
  Service,
  StudioConfig,
  ServiceJob,
  Booking,
  Vehicle,
  Membership,
  MembershipUsage,
} from "@autodeck/core";
import {
  MAX_ADVANCE_BOOKING_DAYS,
  MAX_SERVICE_SPAN_DAYS,
} from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createBookingSchema } from "../../schemas/booking.js";
import { calculatePrice, applyMembershipBenefit, taxFor } from "../../lib/pricing.js";
import {
  buildOccupiedInterval,
  hasConflict,
  type OccupiedInterval,
} from "../../lib/availability.js";
import { hashGiftCode } from "../../lib/gift-code.js";
import { findGiftByHash, giftBlockReason } from "../../lib/gift-store.js";
import { addExtrasToBreakdown, extrasProblem, priceExtras, totalMinutes, type BookingLine } from "../../lib/booking-lines.js";
import { localToUTC, utcToLocalDate, utcToLocalTime, addDays, computeScheduleEnd } from "../../lib/schedule.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { requireCustomerDocId, resolveCustomerDocId } from "../../lib/customer-identity.js";

export const createBooking = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  const data = validate(createBookingSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.create");
  if(data.combinedReview&&!combinedCheckoutEnabled())throw new HttpsError('failed-precondition','Combined checkout is not active. No booking or payment was started.');
  // Benefit/cancel/decline allocation acceptance remains a release gate, never guessed from the UI.
  if(data.combinedReview&&(data.giftCode&&!combinedGiftCheckoutEnabled()||data.membershipId&&!combinedWashCheckoutEnabled()||data.quoteJourneyId&&!combinedQuoteCheckoutEnabled()))throw new HttpsError('failed-precondition','This benefit or custom quote still needs combined-checkout qualification. No booking or payment was started.');

  const db = getFirestore();
  // Self-service booking is role-agnostic: studio/admin book their OWN cars here too.
  // Customers must have a profile; other roles fall back to legacy uid-keyed ownership when they have none.
  const resolvedDocId = user.claims.role === "customer"
    ? await requireCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid)
    : await resolveCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid);
  const customerDocId = resolvedDocId ?? user.uid;
  const now = new Date();

  // Validate booking is not too far in advance
  const requestedStart = localToUTC(data.scheduledDate, data.scheduledTime, "Asia/Kolkata");
  const maxDate = new Date(now.getTime() + MAX_ADVANCE_BOOKING_DAYS * 24 * 60 * 60 * 1000);
  if (requestedStart <= now) {
    throw new HttpsError("invalid-argument", "Booking time must be in the future.");
  }
  if (requestedStart > maxDate) {
    throw new HttpsError(
      "invalid-argument",
      `Cannot book more than ${MAX_ADVANCE_BOOKING_DAYS} days in advance.`,
    );
  }

  // Pre-fetch all inputs outside the transaction (read-heavy; re-validated inside)
  const [serviceSnap, configSnap, vehicleSnap] = await Promise.all([
    db.collection(COLLECTIONS.services()).doc(data.serviceId).get(),
    db.collection(COLLECTIONS.studioConfig()).doc(data.studioId).get(),
    db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId).get(),
  ]);

  if (!serviceSnap.exists) throw new HttpsError("not-found", "Service not found.");
  if (!configSnap.exists) throw new HttpsError("not-found", "Studio not found.");
  if (!vehicleSnap.exists) throw new HttpsError("not-found", "Vehicle not found.");

  const service = serviceSnap.data() as Service;
  const config = configSnap.data() as StudioConfig;
  const vehicle = vehicleSnap.data() as Vehicle;

  if (service.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (config.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (vehicle.ownerId !== customerDocId) {
    throw new HttpsError("permission-denied", "Vehicle does not belong to this customer.");
  }
  if (!service.active) {
    throw new HttpsError("failed-precondition", "Service is not currently available.");
  }

  const compatibleBays = config.bays.filter(
    (b) => b.active && b.bayType === service.requiredBayType,
  );
  if (compatibleBays.length === 0) {
    throw new HttpsError("failed-precondition", "No bays available for this service type.");
  }

  // More services in the same visit. All checks are server side; the app only mirrors them.
  let extraLines: BookingLine[] = [];
  // Categories of the whole visit, saved on the booking so the cancel band cannot change if a service is edited later.
  const cancelCategories: string[] = [String((service as { category?: string }).category ?? "")];
  if (data.extraServiceIds?.length) {
    const extraSnaps = await Promise.all(data.extraServiceIds.map((id) => db.collection(COLLECTIONS.services()).doc(id).get()));
    if (extraSnaps.some((x) => !x.exists)) throw new HttpsError("not-found", "Service not found.");
    const extras = extraSnaps.map((x) => ({ ...(x.data() as Service), id: x.id }));
    if (extras.some((e) => e.tenantId !== user.claims.tenantId)) throw new HttpsError("permission-denied", "Cross-tenant access denied.");
    const problem = extrasProblem({ ...service, id: serviceSnap.id }, extras, { gift: data.giftCode !== undefined });
    if (problem) throw new HttpsError("failed-precondition", problem);
    for (const e of extras) cancelCategories.push(String((e as { category?: string }).category ?? ""));
    extraLines = priceExtras(extras, { vehicleCategory: data.vehicleCategory, tax: taxFor(config), currency: config.currency });
  }
  const quoteRef=data.quoteJourneyId?db.collection("serviceQuoteJourneys").doc(data.quoteJourneyId):null;
  const quoteBefore=quoteRef?(await quoteRef.get()).data() as QuoteJourney|undefined:undefined;
  const quoteInput={tenantId:user.claims.tenantId,customerId:customerDocId,studioId:data.studioId,serviceId:data.serviceId,vehicleId:data.vehicleId,revision:data.quoteRevision??0,termsVersion:data.quoteTermsVersion??""};
  if(quoteRef&&quoteBefore?.phase==="visit_booked"){
    const replay=await db.collection(COLLECTIONS.bookingIntents()).doc(data.idempotencyKey).get();const r=replay.data();
    if(quoteBefore.tenantId!==user.claims.tenantId||quoteBefore.customerId!==customerDocId||r?.["customerId"]!==customerDocId||r?.["tenantId"]!==user.claims.tenantId||r?.["bookingId"]!==quoteBefore.bookingId)throw new HttpsError("failed-precondition","This quote already has a booking.");
    const expectedIdentity=data.combinedReview?JSON.stringify([combinedReviewIdentity(data.combinedReview),null,null]):null;
    if((r?.['combinedIdentity']??null)!==expectedIdentity)throw new HttpsError("already-exists","This quote was already booked with a different payment review.");
    const b=(await db.collection(COLLECTIONS.bookings()).doc(quoteBefore.bookingId!).get()).data() as Booking|undefined;
    if(!b||b.serviceId!==data.serviceId||b.vehicleId!==data.vehicleId||b.studioId!==data.studioId||b.scheduledDate!==data.scheduledDate||b.scheduledTime!==data.scheduledTime||quoteBefore.offer?.revision!==data.quoteRevision||quoteBefore.offer?.termsVersion!==data.quoteTermsVersion)throw new HttpsError("already-exists","This request already confirmed different booking details.");return{booking:b};
  }
  const acceptedOffer=quoteRef?acceptedServiceQuote(quoteBefore,quoteInput):null;
  if(acceptedOffer&&!data.combinedReview&&advancePaymentEnabled()&&user.claims.role==="customer")throw new HttpsError("failed-precondition","Quote booking needs an updated payment flow. No booking or payment was started.");
  if(quoteRef&&(data.extraServiceIds?.length||data.membershipId||data.giftCode))throw new HttpsError("failed-precondition","The accepted quote covers its exact work only. Extras, credits and gifts cannot change it.");
  if(!quoteRef&&(data.quoteRevision||data.quoteTermsVersion))throw new HttpsError("invalid-argument","Quote reference required.");
  const visitMinutes = acceptedOffer?acceptedOffer.workingMinutes:totalMinutes(service.estimatedDurationMinutes, extraLines);

  // A gift covers the gifted wash only: no stacking with a membership, and the code must be well formed.
  let giftHash: string | null = null;
  if (data.giftCode !== undefined) {
    if (data.membershipId !== undefined) throw new HttpsError("failed-precondition", "A gift cannot be combined with a membership.");
    giftHash = hashGiftCode(data.giftCode);
    if (!giftHash) throw new HttpsError("not-found", "That gift code did not work.");
  }

  // Membership pre-validation (cheap, non-transactional fail-fast). The
  // authoritative check happens again inside the transaction against a fresh
  // read, since washesUsed is mutable and racy across concurrent bookings.
  const todayStr = now.toISOString().slice(0, 10);
  if (data.membershipId !== undefined) {
    const membershipSnap = await db.collection(COLLECTIONS.memberships()).doc(data.membershipId).get();
    if (!membershipSnap.exists) {
      throw new HttpsError("not-found", "Membership not found.");
    }
    const membership = membershipSnap.data() as Membership;
    if (membership.tenantId !== user.claims.tenantId) {
      throw new HttpsError("permission-denied", "Cross-tenant access denied.");
    }
    if (membership.customerId !== customerDocId) {
      throw new HttpsError("permission-denied", "Cannot use another customer's membership.");
    }
    if (membership.status !== "active") {
      throw new HttpsError(
        "failed-precondition",
        `Membership is not active (status: ${membership.status}).`,
      );
    }
    if (!membership.endDate || membership.endDate < todayStr) {
      throw new HttpsError("failed-precondition", "Membership has expired.");
    }
  }

  // Compute server-authoritative price
  const breakdown = acceptedOffer?acceptedQuoteBreakdown(acceptedOffer.totalPaise,data.vehicleCategory,config):calculatePrice({
    basePrice: service.basePrice,
    serviceCategory: service.category,
    vehicleCategory: data.vehicleCategory,
    vehicleCategoryPricing: service.vehicleCategoryPricing,
    ...taxFor(config),
    currency: config.currency,
  });

  // Authoritative, multi-day-aware completion instant — walks forward
  // consuming operating-hours-only minutes, skipping closed/holiday days.
  // Reduces to requestedStart + duration for any service that fits within
  // its start day (Phase 5 — multi-day booking; single source of truth used
  // by both booking and job records below, and re-derived identically by
  // rescheduleBooking).
  await assertNotPriorityHeld(db, { isCustomer: user.claims.role === "customer", customerId: customerDocId, date: data.scheduledDate, time: data.scheduledTime, serviceDurationMinutes: visitMinutes, config, now });
  const estimatedEndAt = computeScheduleEnd(
    requestedStart,
    visitMinutes,
    config.operatingHours,
    config.holidays,
    config.timezone,
  );
  const nowIso = now.toISOString();

  const bookingRef = db.collection(COLLECTIONS.bookings()).doc();
  const jobRef = db.collection(COLLECTIONS.jobs()).doc();
  const intentRef = db.collection(COLLECTIONS.bookingIntents()).doc(data.idempotencyKey);

  const transportRef=data.combinedReview?.transport?db.collection(COLLECTIONS.pickupQuotes()).doc(data.combinedReview.transport.quoteId):null;
  const combinedIdentity=data.combinedReview?JSON.stringify([combinedReviewIdentity(data.combinedReview),giftHash,data.membershipId??null]):null;
  const result = await db.runTransaction(async (tx) => {
    // Idempotency check
    const intentSnap = await tx.get(intentRef);
    if (intentSnap.exists) {
      const prior=intentSnap.data()!;if(prior["tenantId"]!==user.claims.tenantId||prior["customerId"]!==customerDocId)throw new HttpsError("permission-denied","Booking request unavailable.");
      if((prior['combinedIdentity']??null)!==combinedIdentity)throw new HttpsError('already-exists','This request already confirmed a different checkout selection.');
      const existingBookingId = (intentSnap.data() as { bookingId: string }).bookingId;
      const existingSnap = await tx.get(
        db.collection(COLLECTIONS.bookings()).doc(existingBookingId),
      );
      const existing=existingSnap.data() as Booking|undefined;if(!existing||existing.serviceId!==data.serviceId||existing.vehicleId!==data.vehicleId||existing.studioId!==data.studioId||existing.scheduledDate!==data.scheduledDate||existing.scheduledTime!==data.scheduledTime)throw new HttpsError("already-exists","This request already confirmed different booking details.");return { booking: existing };
    }

    if(quoteRef){const identity=(await tx.get(db.collection(COLLECTIONS.customers()).doc(customerDocId))).data();if(!identity||identity["authUid"]!==user.uid||identity["tenantId"]!==user.claims.tenantId||identity["deletedAt"])throw new HttpsError("failed-precondition","Customer identity needs review.");}
    if(quoteRef){const liveService=await tx.get(db.collection(COLLECTIONS.services()).doc(data.serviceId));const live=liveService.data();if(!liveService.exists||live?.['active']!==true||live['tenantId']!==user.claims.tenantId||(live['productKey']??null)!==quoteBefore!.scope.productKey||(!!quoteBefore!.requestedReference&&live?.['name']!==quoteBefore!.scope.coverage))throw new HttpsError("failed-precondition","The selected offering changed. Ask the studio to review the quote.");const fresh=(await tx.get(quoteRef)).data() as QuoteJourney|undefined;const currentOffer=acceptedServiceQuote(fresh,quoteInput);if(fresh!.version!==quoteBefore!.version||JSON.stringify(currentOffer)!==JSON.stringify(acceptedOffer))throw new HttpsError("aborted","Quote changed. Review it again.");}

    // Coordinate creation with permanent deletion: a changed/deleted vehicle
    // invalidates this transaction rather than creating a visit for a gone car.
    const currentVehicleSnap=await tx.get(db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId));
    if(!currentVehicleSnap.exists)throw new HttpsError("not-found","Vehicle not found.");
    const currentVehicle=currentVehicleSnap.data() as Vehicle;
    if(currentVehicle.tenantId!==user.claims.tenantId || currentVehicle.ownerId!==customerDocId)throw new HttpsError("permission-denied","Vehicle does not belong to this customer.");
    if(currentVehicle.deletedAt)throw new HttpsError("failed-precondition","Restore this car before booking.");

    // Every combined quote and pricing scope is read before ANY membership/gift/audit writes.
    let transportQuote:unknown=null;
    let reservedPickup:{ref:FirebaseFirestore.DocumentReference;membership:Membership}|null=null;
    if(data.combinedReview){
      const [freshService,freshConfig]=await Promise.all([tx.get(serviceSnap.ref),tx.get(configSnap.ref)]);
      if(!isDeepStrictEqual(freshService.data(),service)||!isDeepStrictEqual(freshConfig.data(),config))throw new HttpsError('aborted','Service pricing or studio settings changed. Review again.');
      if(transportRef){
        transportQuote=(await tx.get(transportRef)).data();
        // Until reservation/restoration is qualified, never charge a member for
        // transport that the existing entitlement can cover. This guard survives
        // an accidental capability toggle; it consumes nothing and changes no price.
        if(Number((transportQuote as {feePaise?:number}|undefined)?.feePaise)>0){
          const rows=await tx.get(db.collection(COLLECTIONS.memberships()).where("customerId","==",customerDocId).where("status","==","active").limit(101));
          const plans=rows.docs.map(d=>d.data()as Membership).filter(m=>m.tenantId===user.claims.tenantId);
          const pick=membershipForFreePickup(plans,nowIso)??membershipForFreePickup(plans,data.scheduledDate);
          if(rows.size>100||pick&&!combinedPickupBenefitEnabled())throw new HttpsError("failed-precondition","Member transport benefits still need combined-checkout qualification. No booking or payment was started.");
          if(pick){
            if(!Number.isSafeInteger(pick.pickupsTotal)||!Number.isSafeInteger(pick.pickupsUsed??0)||(pick.pickupsUsed??0)<0||(pick.startDate&&pick.startDate.slice(0,10)>data.scheduledDate)||(pick.endDate&&pick.endDate.slice(0,10)<data.scheduledDate))throw new HttpsError("failed-precondition","The transport entitlement is not valid for this visit. Review the plan and price.");
            reservedPickup={ref:db.collection(COLLECTIONS.memberships()).doc(pick.id),membership:pick};
          }
        }
      }
    }
    // Re-validate availability inside the transaction to prevent race conditions.
    // Query all active jobs for compatible bays across a MAX_SERVICE_SPAN_DAYS-
    // wide window around the requested date — a same-day-only query would miss
    // a multi-day job that started earlier but is still occupying the bay
    // (Phase 5 — multi-day booking).
    const rangeStartDate = addDays(data.scheduledDate, -MAX_SERVICE_SPAN_DAYS);
    const rangeEndDate = addDays(data.scheduledDate, MAX_SERVICE_SPAN_DAYS);
    const bayOccupancy = new Map<string, OccupiedInterval[]>();
    for (const bay of compatibleBays) {
      const jobsSnap = await tx.get(
        db
          .collection(COLLECTIONS.jobs())
          .where("studioId", "==", data.studioId)
          .where("bayId", "==", bay.id)
          .where("scheduledDate", ">=", rangeStartDate)
          .where("scheduledDate", "<=", rangeEndDate),
      );
      const intervals: OccupiedInterval[] = [];
      for (const doc of jobsSnap.docs) {
        const job = doc.data() as ServiceJob;
        if (hasReleasedBay(job)||job.status === "CANCELLED" || job.status === "DELIVERED") continue;
        intervals.push(buildOccupiedInterval(job.scheduledAt, job.estimatedEndAt));
      }
      bayOccupancy.set(bay.id, intervals);
    }

    // Find the least-loaded available bay
    let assignedBayId: string | null = null;
    let minJobs = Infinity;

    for (const bay of compatibleBays) {
      const occupied = bayOccupancy.get(bay.id) ?? [];
      if (!hasConflict(requestedStart, estimatedEndAt, occupied)) {
        if (occupied.length < minJobs) {
          minJobs = occupied.length;
          assignedBayId = bay.id;
        }
      }
    }

    if (!assignedBayId) {
      throw new HttpsError(
        "resource-exhausted",
        "No bays available for the requested time slot. Please choose another time.",
      );
    }

    // Read (not yet write) the deterministic bay-lock doc for the bay we're
    // about to assign — see COLLECTIONS.bayLocks' doc comment for why this
    // exists and its HONEST, tested limitation (measurably reduces but does
    // NOT fully eliminate the bay-assignment race — see that comment and
    // "8. concurrent booking race"'s test comment before assuming this is
    // airtight). This read must happen before any writes (Firestore
    // transaction rule: all reads before any writes) so it's placed here,
    // with the corresponding write alongside the other writes below.
    const bayLockRef = db.collection(COLLECTIONS.bayLocks()).doc(`${user.claims.tenantId}__${data.studioId}__${assignedBayId}`);
    await tx.get(bayLockRef);

    // Gift: one transaction checks it is unused, unexpired, not void, bound to this account and for this service, and
    // marks it used together with the booking below. A second booking with the same code fails here.
    let giftToUse: { ref: FirebaseFirestore.DocumentReference; gift: Gift } | null = null;
    if (giftHash) {
      const gd = await findGiftByHash(tx, db, giftHash);
      if (!gd) throw new HttpsError("not-found", "That gift code did not work.");
      const gift = gd.data() as Gift;
      if (gift.tenantId !== user.claims.tenantId) throw new HttpsError("not-found", "That gift code did not work.");
      const reason = giftBlockReason(gift, customerDocId, now.getTime());
      if (reason) throw new HttpsError("failed-precondition", reason);
      if (gift.claimedBy !== customerDocId) throw new HttpsError("failed-precondition", "Enter the gift code first.");
      if (gift.serviceId !== data.serviceId) throw new HttpsError("failed-precondition", "This gift is for a different wash.");
      giftToUse = { ref: gd.ref, gift };
    }

    // Membership benefit — re-validated against a FRESH read inside the
    // transaction (the race-safety guarantee: two concurrent bookings both
    // reading washesUsed and racing to consume the last credit will have one
    // transaction retried/serialized by Firestore, exactly like bay
    // assignment above — doc07 §7.5).
    let finalBreakdown = breakdown;
    let membershipWashUsed = false;
    let membershipDiscountApplied = false;
    const membershipRef = data.membershipId
      ? db.collection(COLLECTIONS.memberships()).doc(data.membershipId)
      : null;

    if (membershipRef) {
      const membershipSnap = await tx.get(membershipRef);
      if (!membershipSnap.exists) {
        throw new HttpsError("not-found", "Membership not found.");
      }
      const membership = membershipSnap.data() as Membership;
      if (membership.tenantId !== user.claims.tenantId || membership.customerId !== customerDocId) {
        throw new HttpsError("permission-denied", "Cannot use another customer's membership.");
      }
      if (membership.status !== "active" || !membership.endDate || membership.endDate < data.scheduledDate) {
        throw new HttpsError("failed-precondition", "Membership is not active or has expired.");
      }

      if(data.combinedReview){
        if(membership.startDate&&membership.startDate.slice(0,10)>data.scheduledDate)throw new HttpsError("failed-precondition","Membership has not started for this visit.");
        if(!service.membershipWashEligible||!Number.isSafeInteger(membership.washesTotal)||!Number.isSafeInteger(membership.washesUsed)||membership.washesUsed<0||membership.washesUsed>=membership.washesTotal)throw new HttpsError("failed-precondition","This included wash is no longer available. Review the price again.");
      }
      const consumeWash = service.membershipWashEligible && membership.washesUsed < membership.washesTotal;
      finalBreakdown = applyMembershipBenefit(breakdown, {
        discountPercent: membership.discountPercent,
        consumeWash,
      });
      membershipWashUsed = consumeWash;
      membershipDiscountApplied = consumeWash || finalBreakdown.membershipDiscount !== null && finalBreakdown.membershipDiscount > 0;

      if (consumeWash) {
        tx.update(membershipRef, { washesUsed: membership.washesUsed + 1, updatedAt: nowIso });
      }

      if (membershipDiscountApplied) {
        const usageRef = db.collection(SUBCOLLECTIONS.membershipUsage(data.membershipId as string)).doc();
        const usage: MembershipUsage = {
          id: usageRef.id,
          tenantId: user.claims.tenantId,
          membershipId: data.membershipId as string,
          customerId: customerDocId,
          usageType: consumeWash ? "wash" : "discount",
          jobId: jobRef.id,
          bookingId: bookingRef.id,
          valueRedeemed: consumeWash ? breakdown.subtotal : (finalBreakdown.membershipDiscount ?? 0),
          usedAt: nowIso,
        };
        tx.set(usageRef, usage);
        writeAuditLog(tx, {
          action: consumeWash ? "membership.wash_used" : "membership.discount_applied",
          entityType: "Membership",
          entityId: data.membershipId as string,
          user,
          studioId: data.studioId,
          after: {
            jobId: jobRef.id,
            bookingId: bookingRef.id,
            valueRedeemed: usage.valueRedeemed,
            // Entitlement-remaining (floored at 0): an over-total counter from a
            // refund restore is true-net use, but remaining entitlement is 0.
            washesRemaining: Math.max(
              0,
              consumeWash
                ? membership.washesTotal - (membership.washesUsed + 1)
                : membership.washesTotal - membership.washesUsed,
            ),
          },
        });
      }
    }

    if (giftToUse) {
      // The buyer already paid the full price, so this visit costs the recipient nothing.
      finalBreakdown = { ...breakdown, ...(data.combinedReview?{basePrice:0,scopeAdjustment:0}:{}), tax: 0, total: 0, subtotal: 0 };
      tx.update(giftToUse.ref, { status: "REDEEMED", redeemedBy: customerDocId, redeemedAt: nowIso, bookingId: bookingRef.id });
      writeAuditLog(tx, { action: "gift.redeemed", entityType: "Gift", entityId: giftToUse.gift.id, user, studioId: data.studioId, after: { bookingId: bookingRef.id } });
    }

    // Extra services ride on the same booking. Any membership benefit stays on the main service only.
    finalBreakdown = addExtrasToBreakdown(finalBreakdown, extraLines);
    const combined=data.combinedReview?(()=>{try{return reviewCombinedBooking(finalBreakdown,data.combinedReview,transportQuote,{tenantId:user.claims.tenantId,customerId:customerDocId,nowMs:Date.now()},reservedPickup!==null)}catch(e){throw new HttpsError('failed-precondition',e instanceof Error?e.message:'Review checkout again.')}})():null;
    if(combined)finalBreakdown=combined.breakdown;
    if(reservedPickup)tx.update(reservedPickup.ref,{pickupsUsed:(reservedPickup.membership.pickupsUsed??0)+1,updatedAt:nowIso});
    const lines = extraLines.length ? [{ serviceId: data.serviceId, name: customerServiceName(service.name), price: breakdown.subtotal, durationMinutes: service.estimatedDurationMinutes }, ...extraLines] : undefined;

    // R3: with the advance flag ON, pay-at-studio goes through the existing
    // verified PENDING hold (15 min, same sweep) - confirmed ONLY by the
    // verified advance webhook. Flag OFF: unchanged (confirmed at once).
    // A previously open customer tab cannot complete the advance path. Fail
    // before writing its booking rather than strand it in an unpayable hold.
    if (!combined && advancePaymentEnabled() && user.claims.role === "customer" &&
        (data.payMode ?? "studio") === "studio" && finalBreakdown.total > 0 &&
        (acceptedOffer!==null||service.priceOnRequest !== true) && data.advanceFlowVersion !== 1) {
      throw new HttpsError("failed-precondition", "Online advance payments are now available. Refresh or update AutoDeck before booking so you can pay the 20% advance.");
    }
    const start = bookingStartState({ payMode: combined?"online":data.payMode, totalPaise: finalBreakdown.total, priceOnRequest: acceptedOffer===null&&service.priceOnRequest === true, nowMs: now.getTime(), advanceEnabled: advancePaymentEnabled() && user.claims.role === "customer" });
    const booking: Booking = {
      id: bookingRef.id,
      tenantId: user.claims.tenantId,
      studioId: data.studioId,
      customerId: customerDocId,
      vehicleId: data.vehicleId,
      vehicleSnapshot: {
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        photoUrl: vehicle.photoUrl ?? null,
      },
      serviceId: data.serviceId,
      vehicleCategory: data.vehicleCategory,
      scheduledAt: requestedStart.toISOString(),
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      estimatedEndAt: estimatedEndAt.toISOString(),
      estimatedEndDate: utcToLocalDate(estimatedEndAt, config.timezone),
      estimatedEndTime: utcToLocalTime(estimatedEndAt, config.timezone),
      durationMinutes: visitMinutes,
      bayId: assignedBayId,
      assignedEmployeeId: null,
      status: start.status,
      payMode: combined?(combined.payment.choice==='advance20'?'studio':'online'):data.payMode ?? "studio",
      ...(combined?{combinedPayment:combined.payment,transportSnapshot:combined.transport}:{}),
      holdExpiresAt: start.holdExpiresAt,
      ...(acceptedOffer?{priceOnRequest:true,quoteStatus:"approved" as const,quoteJourneyId:data.quoteJourneyId,quoteRevision:acceptedOffer.revision,quoteScope:quoteBefore!.scope,quoteTermsVersion:acceptedOffer.termsVersion}:service.priceOnRequest === true ? { priceOnRequest: true, quoteStatus: "requested" as const } : {}),
      priceBreakdown: finalBreakdown,
      ...(lines ? { lines } : {}),
      totalAmount: finalBreakdown.total,
      membershipId: data.membershipId ?? null,
      ...(giftToUse ? { giftId: giftToUse.gift.id } : {}),
      cancelCategories: cancelCategories.filter(Boolean),
      membershipDiscountApplied,
      membershipWashUsed,
      paymentStatus: "unpaid",
      notes: data.notes ?? null,
      idempotencyKey: data.idempotencyKey,
      rescheduleCount: 0,
      confirmedAt: start.status === "CONFIRMED" ? nowIso : null,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const job: ServiceJob = {
      ...(membershipWashUsed ? {membershipWashUsed:true} : {}),
      id: jobRef.id,
      tenantId: user.claims.tenantId,
      studioId: data.studioId,
      bookingId: bookingRef.id,
      customerId: customerDocId,
      vehicleId: data.vehicleId,
      serviceId: data.serviceId,
      bayId: assignedBayId,
      assignedEmployeeId: null,
      status: "PENDING_VEHICLE",
      statusHistory: [
        {
          status: "PENDING_VEHICLE",
          changedAt: nowIso,
          changedBy: user.uid,
          notes: null,
        },
      ],
      scheduledAt: requestedStart.toISOString(),
      scheduledDate: data.scheduledDate,
      // Buffer-free — same instant as booking.estimatedEndAt above (single
      // source of truth). The turnover buffer is applied only when building
      // occupancy intervals (buildOccupiedInterval), never stored here.
      estimatedEndAt: estimatedEndAt.toISOString(),
      estimatedEndDate: utcToLocalDate(estimatedEndAt, config.timezone),
      estimatedDurationMinutes: visitMinutes,
      studioNotes: data.notes ?? null,
      additionalWorkDelta: 0,
      ...(combined?{combinedPayment:combined.payment,transportSnapshot:combined.transport}:{}),
      priceBreakdown: finalBreakdown, // same snapshot already computed for the booking — not recomputed
      ...(lines ? { lines } : {}),
      totalAmount: finalBreakdown.total,
      paymentStatus: "unpaid",
      isWalkIn: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      sealedAt: null,
    };

    if(acceptedOffer){
      const receipt=freezeConsultQuoteApproval({version:1,bookingId:bookingRef.id,jobId:jobRef.id,tenantId:booking.tenantId,customerId:customerDocId,quotedTotalPaise:booking.totalAmount,pickupFeePaise:finalBreakdown.pickupFee??0,dropFeePaise:finalBreakdown.dropFee??0,quotedAt:nowIso},customerDocId,nowIso);
      tx.create(db.collection("consultQuoteApprovals").doc(receipt.quoteHash),receipt);
      Object.assign(booking,{consultQuoteApproval:{quoteHash:receipt.quoteHash}});
    }
    if(quoteRef)tx.update(quoteRef,{phase:"visit_booked",bookingId:bookingRef.id,version:quoteBefore!.version+1});
    if(combined?.transport&&data.combinedReview?.transport&&transportRef){
      const t=combined.transport,input=data.combinedReview.transport;
      tx.update(transportRef,{consumedAt:nowIso,bookingId:bookingRef.id});
      tx.create(db.collection(COLLECTIONS.pickupRequests()).doc(bookingRef.id),{
        id:bookingRef.id,tenantId:booking.tenantId,studioId:booking.studioId,bookingId:bookingRef.id,customerId:customerDocId,
        kind:t.kind,address:input.address,preferredTime:'',requestedPickupTime:input.requestedPickupTime??'',requestedDropTime:'',note:'',
        quoteId:t.quoteId,roadMeters:t.legs.reduce((n,l)=>n+l.roadMeters,0),distanceKm:pickupRoadKmForDisplay(t.legs.reduce((n,l)=>n+l.roadMeters,0)),
        feePaise:t.feePaise,legs:t.legs,pickupFeePaise:t.pickupFeePaise,dropFeePaise:t.dropFeePaise,feeBilled:true,billingVersion:2,
        ...(reservedPickup?{memberMembershipId:reservedPickup.ref.id,memberBenefitState:'reserved',memberBenefitReservedAt:nowIso}:{}),
        status:'REQUESTED',staffNote:'',agreedPickupAt:null,agreedDropAt:null,createdAt:nowIso,updatedAt:nowIso,
      });
    }
    tx.set(bookingRef, booking);
    tx.set(jobRef, job);
    tx.set(intentRef, {
      bookingId: bookingRef.id,
      customerId: customerDocId,
      tenantId: user.claims.tenantId,
      combinedIdentity,
      createdAt: nowIso,
    });
    // Write the bay lock read above — this is what actually forces Firestore
    // to detect a conflict and retry a genuinely concurrent second caller
    // that also read this same (pre-assignment) lock version for the same
    // bay, so its retry re-evaluates occupancy against this job's now-
    // committed data instead of stale empty data.
    tx.set(bayLockRef, { lastAssignedAt: nowIso });
    writeAuditLog(tx, {
      action: "booking.created",
      entityType: "Booking",
      entityId: bookingRef.id,
      user,
      studioId: data.studioId,
      after: {
        id: bookingRef.id,
        serviceId: data.serviceId,
        scheduledAt: requestedStart.toISOString(),
        bayId: assignedBayId,
        totalAmount: finalBreakdown.total,
        status: start.status,
      },
    });

    return { booking };
  }, { maxAttempts: 10 });

  return result;
});
