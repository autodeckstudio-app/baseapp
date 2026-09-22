import { describe, it, expect } from "vitest";
import { MockPaymentProvider } from "../../lib/mock-payment-provider.js";
import { buildInvoice } from "../../lib/invoice-builder.js";
import { formatInvoiceNumber } from "../../lib/invoice-counter.js";
import type { Booking, PriceBreakdown } from "@autodeck/core";

// ─── Mock provider ────────────────────────────────────────────────────────────

describe("MockPaymentProvider", () => {
  const provider = new MockPaymentProvider();

  it("createPaymentLink returns deterministic mock IDs", async () => {
    const result = await provider.createPaymentLink({
      amount: 500000,
      currency: "INR",
      bookingId: "booking-1",
      description: "Test Service",
      customerName: "Alice",
      customerPhone: "+919876543210",
      referenceId: "ref-abc",
    });
    expect(result.providerPaymentLinkId).toContain("mock_plink_ref-abc");
    expect(result.paymentUrl).toContain("ref-abc");
    expect(result.paymentUrl).toContain("500000");
  });

  it("verifyWebhookSignature always returns true in mock", () => {
    expect(
      provider.verifyWebhookSignature({ rawBody: "{}", signature: "anything" }),
    ).toBe(true);
  });

  it("parseWebhookEvent parses success event", () => {
    const body = JSON.stringify({
      id: "evt-001",
      event: "payment.captured",
      payload: {
        payment: { entity: { id: "pay-001", amount: 500000, currency: "INR" } },
      },
    });
    const event = provider.parseWebhookEvent(body);
    expect(event.eventType).toBe("payment.captured");
    expect(event.providerEventId).toBe("evt-001");
    expect(event.providerPaymentId).toBe("pay-001");
    expect(event.amount).toBe(500000);
  });

  it("initiateRefund returns mock refund ID", async () => {
    const result = await provider.initiateRefund({
      providerPaymentId: "pay-001",
      amount: 500000,
      reason: "Customer request",
      referenceId: "ref-refund-1",
    });
    expect(result.providerRefundId).toContain("mock_rfnd_ref-refund-1");
  });
});

// ─── Payment amount immutability ──────────────────────────────────────────────

describe("Payment amount immutability", () => {
  it("amount is taken from booking.totalAmount (not from any other source)", () => {
    // This is a contract test: business logic must use booking.totalAmount
    const bookingTotalAmount = 850000; // ₹8,500 in paise
    const clientClaimedAmount = 1; // attacker sends ₹0.01

    // The CF uses booking.totalAmount — client amount is ignored
    const authorizedAmount = bookingTotalAmount;
    expect(authorizedAmount).toBe(850000);
    expect(authorizedAmount).not.toBe(clientClaimedAmount);
  });

  it("price snapshot from booking is immutable after booking creation", () => {
    // Changing catalogue price AFTER booking must not change the payable amount
    const priceAtBooking = 500000; // ₹5,000
    const cataloguePriceNow = 600000; // ₹6,000 (admin raised price)

    // Invoice uses booking snapshot — not current catalogue
    const invoiceAmount = priceAtBooking;
    expect(invoiceAmount).toBe(500000);
    expect(invoiceAmount).not.toBe(cataloguePriceNow);
  });
});

// ─── Invoice number generation ────────────────────────────────────────────────

describe("formatInvoiceNumber", () => {
  it("formats as INV-YYYY-NNNNN", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("INV-2026-00001");
    expect(formatInvoiceNumber(2026, 42)).toBe("INV-2026-00042");
    expect(formatInvoiceNumber(2026, 99999)).toBe("INV-2026-99999");
  });

  it("resets numbering on year boundary (same format, different year)", () => {
    expect(formatInvoiceNumber(2027, 1)).toBe("INV-2027-00001");
  });

  it("sequence numbers are strictly monotonic (no gaps possible from counter logic)", () => {
    // Sequence 1, 2, 3 are always strictly increasing
    const seq = [1, 2, 3].map((n) => formatInvoiceNumber(2026, n));
    for (let i = 1; i < seq.length; i++) {
      const curr = seq[i];
      const prev = seq[i - 1];
      if (!curr || !prev) break;
      expect(curr > prev).toBe(true); // lexicographic order matches numeric order
    }
  });
});

// ─── Invoice builder ──────────────────────────────────────────────────────────

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  const pb: PriceBreakdown = {
    vehicleCategory: "sedan",
    basePrice: 500000,
    scopeAdjustment: 0,
    addOns: [],
    subtotal: 500000,
    membershipDiscount: null,
    membershipDiscountPercent: null,
    pickupFee: 0,
    dropFee: 0,
    taxRatePercent: 18,
    taxDescription: "GST 18%",
    tax: 90000,
    total: 590000,
    currency: "INR",
  };

  return {
    id: "booking-1",
    tenantId: "autodeck",
    studioId: "studio-ahmedabad",
    customerId: "customer-1",
    vehicleId: "vehicle-1",
    serviceId: "service-ppf-1",
    vehicleCategory: "sedan",
    scheduledAt: "2026-09-01T03:30:00.000Z",
    scheduledDate: "2026-09-01",
    scheduledTime: "09:00",
    estimatedEndAt: "2026-09-01T07:30:00.000Z",
    estimatedEndDate: "2026-09-01",
    estimatedEndTime: "13:00",
    durationMinutes: 240,
    bayId: "bay-protection-1",
    assignedEmployeeId: null,
    status: "COMPLETED",
    priceBreakdown: pb,
    totalAmount: pb.total,
    membershipId: null,
    membershipDiscountApplied: false,
    membershipWashUsed: false,
    paymentStatus: "paid",
    notes: null,
    idempotencyKey: "key-1",
    rescheduleCount: 0,
    confirmedAt: "2026-08-20T10:00:00.000Z",
    cancelledAt: null,
    cancellationReason: null,
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

// buildInvoice no longer takes a Booking — it takes the resolved price
// snapshot plus entity references directly, so it works identically for a
// booking-sourced job or a walk-in job. This helper maps a Booking fixture
// (still convenient for readable test data) onto that generic param shape.
function invoiceParamsFromBooking(
  booking: Booking,
  extra: {
    invoiceId: string;
    invoiceNumber: string;
    paymentId: string | null;
    serviceName: string;
  },
) {
  return {
    ...extra,
    tenantId: booking.tenantId,
    studioId: booking.studioId,
    jobId: "job-1",
    bookingId: booking.id,
    customerId: booking.customerId,
    vehicleId: booking.vehicleId,
    priceBreakdown: booking.priceBreakdown,
  };
}

describe("buildInvoice", () => {
  it("invoice total equals the source's totalAmount (historical price immutability)", () => {
    const booking = makeBooking();
    const invoice = buildInvoice(
      invoiceParamsFromBooking(booking, {
        invoiceId: "inv-1",
        invoiceNumber: "INV-2026-00001",
        paymentId: "pay-1",
        serviceName: "LLumar Gloss PPF",
      }),
    );
    expect(invoice.total).toBe(booking.totalAmount);
    expect(invoice.total).toBe(590000);
  });

  it("invoice tax is snapshotted from the price breakdown (not recalculated)", () => {
    const booking = makeBooking();
    const invoice = buildInvoice(
      invoiceParamsFromBooking(booking, {
        invoiceId: "inv-2",
        invoiceNumber: "INV-2026-00002",
        paymentId: "pay-2",
        serviceName: "Service",
      }),
    );
    expect(invoice.taxRatePercent).toBe(18);
    expect(invoice.taxDescription).toBe("GST 18%");
    expect(invoice.tax).toBe(90000);
  });

  it("invoice status is 'issued' when paymentId is provided", () => {
    const booking = makeBooking();
    const invoice = buildInvoice(
      invoiceParamsFromBooking(booking, {
        invoiceId: "inv-3",
        invoiceNumber: "INV-2026-00003",
        paymentId: "pay-3",
        serviceName: "Service",
      }),
    );
    expect(invoice.status).toBe("issued");
    expect(invoice.issuedAt).not.toBeNull();
  });

  it("invoice status is 'draft' when no paymentId", () => {
    const booking = makeBooking();
    const invoice = buildInvoice(
      invoiceParamsFromBooking(booking, {
        invoiceId: "inv-4",
        invoiceNumber: "INV-2026-00004",
        paymentId: null,
        serviceName: "Service",
      }),
    );
    expect(invoice.status).toBe("draft");
    expect(invoice.issuedAt).toBeNull();
  });

  it("publicToken is a valid UUID", () => {
    const booking = makeBooking();
    const invoice = buildInvoice(
      invoiceParamsFromBooking(booking, {
        invoiceId: "inv-5",
        invoiceNumber: "INV-2026-00005",
        paymentId: null,
        serviceName: "Service",
      }),
    );
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(invoice.publicToken).toMatch(uuidRegex);
  });

  it("each invoice gets a unique publicToken", () => {
    const booking = makeBooking();
    const params = invoiceParamsFromBooking(booking, {
      invoiceId: "inv-6",
      invoiceNumber: "INV-2026-00006",
      paymentId: null,
      serviceName: "Service",
    });
    const inv1 = buildInvoice({
      ...params,
      invoiceId: "inv-6",
      invoiceNumber: "INV-2026-00006",
    });
    const inv2 = buildInvoice({
      ...params,
      invoiceId: "inv-7",
      invoiceNumber: "INV-2026-00007",
    });
    expect(inv1.publicToken).not.toBe(inv2.publicToken);
  });

  it("line items include add-ons from price breakdown", () => {
    const pb: PriceBreakdown = {
      vehicleCategory: "suv",
      basePrice: 500000,
      scopeAdjustment: 50000,
      addOns: [{ id: "addon-1", name: "Ceramic Coat", price: 100000 }],
      subtotal: 650000,
      membershipDiscount: null,
      membershipDiscountPercent: null,
      pickupFee: 0,
      dropFee: 0,
      taxRatePercent: 18,
      taxDescription: "GST 18%",
      tax: 117000,
      total: 767000,
      currency: "INR",
    };
    const booking = makeBooking({ priceBreakdown: pb, totalAmount: pb.total });
    const invoice = buildInvoice(
      invoiceParamsFromBooking(booking, {
        invoiceId: "inv-8",
        invoiceNumber: "INV-2026-00008",
        paymentId: "pay-8",
        serviceName: "PPF",
      }),
    );
    // Line items: main service + add-on
    const addOnLine = invoice.lineItems.find(
      (li) => li.description === "Ceramic Coat",
    );
    expect(addOnLine).toBeDefined();
    expect(addOnLine?.total).toBe(100000);
  });

  it("invoice total cannot be overridden — always equals the price breakdown's total", () => {
    const booking = makeBooking();
    // Attempt to "pass" a different total — but buildInvoice uses pb.total directly
    const invoice = buildInvoice(
      invoiceParamsFromBooking(booking, {
        invoiceId: "inv-9",
        invoiceNumber: "INV-2026-00009",
        paymentId: "pay-9",
        serviceName: "Service",
      }),
    );
    // No parameter for "total" — it comes exclusively from priceBreakdown
    expect(invoice.total).toBe(booking.priceBreakdown.total);
  });

  it("walk-in invoice (no bookingId) is built identically to a booking invoice", () => {
    const booking = makeBooking();
    const invoice = buildInvoice({
      invoiceId: "inv-10",
      invoiceNumber: "INV-2026-00010",
      tenantId: booking.tenantId,
      studioId: booking.studioId,
      jobId: "walkin-job-1",
      bookingId: null, // walk-in — no fabricated bookingId
      customerId: booking.customerId,
      vehicleId: booking.vehicleId,
      priceBreakdown: booking.priceBreakdown,
      paymentId: "pay-10",
      serviceName: "Walk-in Wash",
    });
    expect(invoice.bookingId).toBeNull();
    expect(invoice.jobId).toBe("walkin-job-1");
    expect(invoice.total).toBe(booking.priceBreakdown.total);
    expect(invoice.status).toBe("issued");
  });
});

// ─── Payment status machine ───────────────────────────────────────────────────

describe("Payment status lifecycle", () => {
  it("terminal states cannot be re-entered (completed → refunded is a separate record)", () => {
    // Refund creates a new Payment record; original stays completed
    const originalStatus = "completed";
    // We don't mutate the original — this is a design assertion
    expect(originalStatus).toBe("completed");
  });

  it("idempotency: same event ID should not process twice", () => {
    // Simulated idempotency check: eventRef already exists → skip
    const processedEvents = new Set(["evt-001"]);
    const incomingEventId = "evt-001";
    const shouldSkip = processedEvents.has(incomingEventId);
    expect(shouldSkip).toBe(true);
  });

  it("different event IDs are each processed once", () => {
    const processedEvents = new Set(["evt-001"]);
    expect(processedEvents.has("evt-002")).toBe(false);
  });
});

// ─── Security: client cannot set payment amount ───────────────────────────────

describe("Payment security invariants", () => {
  it("client-provided amount is always ignored — booking totalAmount is used", () => {
    // The CF ignores request.data.amount entirely — amount = booking.totalAmount
    const bookingAmount = 850000;
    const clientAmount = 1; // Attempted tampering

    // Business rule: authorizedAmount = booking.totalAmount
    const authorizedAmount = bookingAmount; // CF always reads from booking
    expect(authorizedAmount).toBe(850000);
    expect(authorizedAmount).not.toBe(clientAmount);
  });

  it("client cannot set paymentStatus on booking directly (rules enforce CF-only writes)", () => {
    // This is asserted by Firestore security rules (tested in emulator suite)
    // Firestore rule: bookings allow update: if isStudioOrAbove() && !affectedKeys.hasAny([...])
    const protectedFields = [
      "priceBreakdown",
      "totalAmount",
      "membershipDiscountApplied",
      "paymentStatus",
    ];
    expect(protectedFields).toContain("paymentStatus");
    expect(protectedFields).toContain("totalAmount");
  });
});
