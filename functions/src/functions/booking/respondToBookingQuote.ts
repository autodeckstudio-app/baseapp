// Customer: approve the studio's quote on their own price-on-request booking. quoted -> approved.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { Booking, ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import {
  extractCustomerUser,
  assertRole,
  assertTenant,
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

import { readConsultPaymentBinding } from "../../lib/consult-payment.js";
import { requireCustomerDocId } from "../../lib/customer-identity.js";
import {
  freezeConsultQuoteApproval,
} from "../../lib/consult-approval-binding.js";

const schema = z
  .object({
    bookingId: z.string().min(1),
    expectedTotalPaise: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER),
    expectedUpdatedAt: z.string().min(1),
  })
  .strict();

export const respondToBookingQuote = onCall(
  { region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const user = extractCustomerUser(request);
    assertRole(user, "customer");
    const data = validate(schema, request.data);
    await enforceRateLimit(subjectFrom(user), "booking.quoteRespond");
    const db = getFirestore();
    const customerId = await requireCustomerDocId(
      db,
      COLLECTIONS.customers(),
      user.claims.tenantId,
      user.uid,
    );
    const ref = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
      const b = snap.data() as Booking;
      assertTenant(user, b.tenantId);
      if (b.customerId !== customerId)
        throw new HttpsError("permission-denied", "Not your booking.");
      const profile = (
        await tx.get(db.collection(COLLECTIONS.customers()).doc(customerId))
      ).data();
      if (
        !profile ||
        profile["authUid"] !== user.uid ||
        profile["tenantId"] !== b.tenantId ||
        profile["deletedAt"]
      )
        throw new HttpsError(
          "failed-precondition",
          "Customer identity needs review.",
        );
      if (
        !b.priceOnRequest ||
        ["CANCELLED", "COMPLETED", "EXPIRED"].includes(b.status)
      )
        throw new HttpsError(
          "failed-precondition",
          "This booking is not open for quote approval.",
        );
      const jobs = await tx.get(
        db
          .collection(COLLECTIONS.jobs())
          .where("bookingId", "==", b.id)
          .limit(2),
      );
      if (jobs.size !== 1)
        throw new HttpsError(
          "failed-precondition",
          "The linked job needs office review.",
        );
      const job = jobs.docs[0]?.data() as ServiceJob;
      if (
        job.id !== jobs.docs[0]?.id ||
        job.customerId !== customerId ||
        job.tenantId !== b.tenantId ||
        job.studioId !== b.studioId ||
        job.bookingId !== b.id ||
        b.priceBreakdown.total !== b.totalAmount ||
        job.priceBreakdown.pickupFee !== b.priceBreakdown.pickupFee ||
        job.priceBreakdown.dropFee !== b.priceBreakdown.dropFee
      )
        throw new HttpsError(
          "failed-precondition",
          "The current quote needs office review.",
        );
      const scope = {
        bookingId: b.id,
        jobId: job.id,
        tenantId: b.tenantId,
        customerId,
        pickupFeePaise: b.priceBreakdown.pickupFee ?? 0,
        dropFeePaise: b.priceBreakdown.dropFee ?? 0,
        totalAmountPaise: b.totalAmount,
      };
      const marker = (
        b as Booking & { consultQuoteApproval?: { quoteHash?: string } }
      ).consultQuoteApproval;
      if (b.quoteStatus === "approved" && marker?.quoteHash) {
        const stored = (
          await tx.get(
            db.collection("consultQuoteApprovals").doc(marker.quoteHash),
          )
        ).data();
        if (
          data.expectedTotalPaise !== b.totalAmount ||
          stored?.["quote"]?.quotedAt !== data.expectedUpdatedAt
        )
          throw new HttpsError(
            "failed-precondition",
            "The displayed quote changed. Review it again.",
          );
        try {
          await readConsultPaymentBinding(db,tx,job,b as unknown as Record<string,unknown>);
        } catch {
          throw new HttpsError(
            "failed-precondition",
            "The current quote needs fresh approval.",
          );
        }
        return;
      }
      if(job.totalAmount!==b.totalAmount||job.priceBreakdown.total!==b.totalAmount)throw new HttpsError("failed-precondition","The current quote needs office review.");
      if (b.quoteStatus !== "quoted")
        throw new HttpsError(
          "failed-precondition",
          "There is no quote to approve yet.",
        );
      if (
        data.expectedTotalPaise !== b.totalAmount ||
        data.expectedUpdatedAt !== b.updatedAt
      )
        throw new HttpsError(
          "failed-precondition",
          "The displayed quote changed. Review it again.",
        );
      const now = new Date().toISOString();
      const receipt = freezeConsultQuoteApproval(
        {
          version: 1,
          bookingId: b.id,
          jobId: job.id,
          tenantId: b.tenantId,
          customerId,
          quotedTotalPaise: b.totalAmount,
          pickupFeePaise: scope.pickupFeePaise,
          dropFeePaise: scope.dropFeePaise,
          quotedAt: b.updatedAt,
        },
        customerId,
        now,
      );
      tx.create(
        db.collection("consultQuoteApprovals").doc(receipt.quoteHash),
        receipt,
      );
      tx.update(ref, {
        quoteStatus: "approved",
        consultQuoteApproval: { quoteHash: receipt.quoteHash },
        updatedAt: now,
      });
      writeAuditLog(tx, {
        action: "booking.quote_approved",
        entityType: "Booking",
        entityId: data.bookingId,
        user,
        studioId: b.studioId,
        before: { quoteStatus: "quoted" },
        after: { quoteStatus: "approved", total: b.totalAmount },
      });
    });
    return { bookingId: data.bookingId };
  },
);
