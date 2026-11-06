vi.mock('react-native',async(load)=>({...await load<any>(),TextInput:(p:any)=>React.createElement('input',p)}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));
vi.mock("../../../lib/imagery", () => ({
  sceneImagery: {},
  serviceImagery: {},
  brandImagery: {},
}));
vi.mock("@autodeck/ui", () => ({
  formatDateShort: (s: any) => s,
  TextInput: (props: any) => React.createElement("input", props),
}));
vi.mock("../../../lib/auth-service", () => ({
  verifyMyCustomerDocId: async () => true,
  onIdTokenChanged: (cb: any) => {
    cb({
      uid: "auth-different-from-c",
      getIdTokenResult: async () => ({
        claims: { role: "customer", tenantId: "t" },
      }),
    });
    return () => {};
  },
  resolveMyCustomerDocId: async () => (h.claimed ? "c" : null),
  claimCustomerRecord: async () => {
    h.claimed = true;
    return { customerId: "c" };
  },
  setupCustomerProfile: async () => ({
    customerId: "c",
    customer: { id: "c" },
  }),
  rememberMyCustomerDocId: async (id: any) => {
    h.remember = id;
  },
  refreshAuthToken: async () => {},
  isClaimRequired: () => false,
  signOut: async () => {},
}));
import { writeFileSync } from "node:fs";
import React from "react";
import { it, vi, expect } from "vitest";
import { act, create } from "react-test-renderer";
const __params = vi.hoisted(() => ({ current: {} as any }));
const h = vi.hoisted(() => ({
  claimed: false,cancel:vi.fn(),review:vi.fn(),approval:vi.fn(),approvalCb:null as any,inspectionCb:null as any,
  remember: "",
  queries: [] as any[],
  routes: [] as any[],
  auth: {
    status: "ready",
    customerDocId: "c",
    user: { uid: "auth-different-from-c" },
    claims: { tenantId: "t" },
  },
  bookingCb: null as any,
  jobCb: null as any,
  paymentCb: null as any,
  paymentError: null as any,
  oldPaymentCb: null as any,
  open: vi.fn(async (..._args: any[]) => "pending"),
  initiate: vi.fn(),
  approve: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("../../../lib/push", () => ({
  PUSH_ASKED_KEY: "push",
  requestPush: vi.fn(),
  registerPushToken: vi.fn(),
  pushSupported: false,
}));
vi.mock("../../../lib/firebase", () => ({ db: {}, functions: {} }));
vi.mock("../../../lib/booking-service", () => ({
  getMyBookings: async (c: any, t: any) => {
    h.queries.push(["bookings", c, t]);
    return [];
  },
  listenToBooking: (_i: any, cb: any) => {
    h.bookingCb = cb;
    return () => {};
  },
  cancelBooking: (...a:any[])=>h.cancel(...a),
  approveBookingQuote: (...a: any[]) => h.approve(...a),
}));
vi.mock("../../../lib/job-service", () => ({
  listenToMyJobs: (t: any, c: any, cb: any) => {
    h.queries.push(["jobs", c, t]);
    cb([{...job,status:'VEHICLE_RECEIVED',bookingId:null}]);
    return () => {};
  },
  listenToJobById: (_i: any, cb: any) => {
    h.jobCb = cb;
    return () => {};
  },
  listenToJobForBooking: () => () => {},
  bookingFromJob: (j: any) => ({
    ...j,
    status: "ACTIVE",
    payMode: "studio",
    serviceId: "svc",
    scheduledAt: "2026-11-04T05:00:00Z",
    scheduledDate: "2026-11-04",
    scheduledTime: "10:30",
    estimatedEndDate: "2026-11-04",
    estimatedEndTime: "11:30",
    estimatedEndAt: "2026-11-04T06:00:00Z",
    durationMinutes: 60,
    notes: null,
    priceBreakdown: {
      basePrice: 250000,
      scopeAdjustment: 0,
      addOns: [],
      tax: 0,
      total: 250000,
    },
  }),
  getJobIdForBooking: vi.fn(),
}));
vi.mock("../../../lib/payment-service", () => ({
  listenToPaymentForJob: (_j: any, _t: any, _c: any, cb: any, err: any) => {
    h.paymentError = err;
    h.oldPaymentCb = h.paymentCb;
    h.paymentCb = cb;
    return h.stop;
  },
  initiatePayment: (...a: any[]) => h.initiate(...a),
  requestAdvancePayment: vi.fn(),
}));
vi.mock("../../../lib/razorpay-checkout", () => ({
  payWithPaymentLink: (...a: any[]) => h.open(...a),
  payOnline: vi.fn(),
}));
vi.mock("../../../lib/vehicle-service", () => ({
  listenToMyVehicles: (c: any, t: any, cb: any) => {
    h.queries.push(["vehicles", c, t]);
    cb([]);
    return () => {};
  },
  listenToMyArchivedVehicles: (c: any, t: any, cb: any) => {
    h.queries.push(["archived", c, t]);
    cb([]);
    return () => {};
  },
  restoreVehicle: vi.fn(),
  deleteVehiclePermanently: vi.fn(),
}));
vi.mock("../../../lib/catalogue-service", () => ({
  getServiceCatalogue: async () => [],
}));
vi.mock("../../../lib/approval-service", () => ({
  listenToApprovalsForJob: (_j:any,_t:any,_c:any,cb:any) => {h.approvalCb=cb;return()=>{}},
  respondToApproval: (...a:any[])=>h.approval(...a),
}));
vi.mock("../../../lib/inspection-service", () => ({
  listenToInspection: (_j:any,cb:any)=>{h.inspectionCb=cb;return()=>{}},
}));
vi.mock("../../../lib/review-service", () => ({
  getReview: async () => null,
  submitReview: (...a:any[])=>h.review(...a),
}));
vi.mock("../../../ui/CarThumb", () => ({ CarThumb: () => null }));
vi.mock("../../../ui/PickupCard", () => ({ PickupCard: () => null }));
vi.mock("../../../ui/ServicePhoto", () => ({ ServicePhoto: () => null }));

vi.mock("expo-router", async () => {
  const React = await import("react");
  return {
    useSegments: () => [],
    useLocalSearchParams: () => __params.current,
    useRouter: () => ({
      replace: (p: any) => h.routes.push(p),
      push: (p: any) => h.routes.push(p),
      back: () => {},
    }),
    useFocusEffect: (cb: any) => React.useEffect(cb, [cb]),
  };
});
vi.mock("../../../lib/invoice-service", () => ({
  listenToMyInvoices: (t: any, c: any, cb: any) => {
    h.queries.push(["invoices", c, t]);
    cb([]);
    return () => {};
  },
}));
vi.mock("../../../lib/home-service", () => ({
  listenToMyMemberships: (t: any, c: any, cb: any) => {
    h.queries.push(["memberships", c, t]);
    cb([]);
    return () => {};
  },
}));
vi.mock("../../../hooks/useCustomerHome", () => ({
  setActiveVehicle: vi.fn(),
}));
vi.mock("../../../ui/LegalLinks", () => ({ LegalLinks: () => null }));
import ClaimScreen from "../../(auth)/claim";
import Bookings from "./index";
import Garage from "../garage/index";
import Detail from "./[id]";
import { Button } from "../../../ui/kit";
const job = {
  id: "j",
  tenantId: "t",
  customerId: "c",
  vehicleId: "v",
  status: "READY_FOR_DELIVERY",
  paymentStatus: "unpaid",
  totalAmount: 250000,
  services: [],
  statusHistory: [],
  createdAt: "2026-11-04T00:00:00Z",
};
const payment = {
  id: "p",
  jobId: "j",
  tenantId: "t",
  customerId: "c",
  status: "pending",
  method: "razorpay_payment_link",
  amount: 250000,
  currency: "INR",
  paymentUrl: "https://rzp.io/i/existing",
};
function text(r: any) {
  return JSON.stringify(r.toJSON());
}
it("real job-ID consult fallback uses linked booking ID and exact displayed revised total/version, review received never says paid", async () => {
  __params.current = {};
  let claim: any;
  await act(async () => {
    claim = create(<ClaimScreen />);
  });
  await act(async () =>
    claim.root
      .findByProps({ placeholder: "XXXX-XXXX" })
      .props.onChangeText("ABCD-EFGH"),
  );
  await act(async () =>
    claim.root.findByProps({ testID: "claim-continue" }).props.onPress(),
  );
  expect(h.remember).toBe("c");
  expect(h.routes).toContain("/(tabs)");
  await act(async () => claim.unmount());
  let list: any;
  await act(async () => {
    list = create(<Bookings />);
  });
  expect(h.queries.some((q) => q[0] === "bookings")).toBe(true);
  expect(h.queries.every((q) => q[1] === "c" && q[2] === "t")).toBe(true);
  expect(text(list)).toContain('Track');
  await act(async()=>list.root.findAllByType(Button).find((b:any)=>b.props.label==='Track')!.props.onPress());
  expect(h.routes).toContain('/(tabs)/bookings/j');
  await act(async () => list.unmount());
  await act(async () => {
    list = create(<Garage />);
  });
  expect(h.queries.some((q) => q[0] === "memberships")).toBe(true);
  await act(async () => list.unmount());
  __params.current = { id: "j" };
  let r: any;
  await act(async () => {
    r = create(<Detail />);
  });
  await act(async () => h.bookingCb(null));
  await act(async () => h.jobCb({ ...job, bookingId: "quote-b" }));
  const b = {
    ...job,
    id: "quote-b",
    status: "ACTIVE",
    payMode: "studio",
    serviceId: "svc",
    priceOnRequest: true,
    quoteStatus: "quoted",
    totalAmount: 129900,
    updatedAt: "v2",
    notes: null,
    scheduledAt: "2026-11-04T05:00:00Z",
    scheduledDate: "2026-11-04",
    scheduledTime: "10:30",
    estimatedEndDate: "2026-11-04",
    estimatedEndTime: "11:30",
    estimatedEndAt: "2026-11-04T06:00:00Z",
    durationMinutes: 60,
    priceBreakdown: {
      basePrice: 129900,
      scopeAdjustment: 0,
      addOns: [],
      tax: 0,
      total: 129900,
    },
  };
  await act(async () => h.bookingCb(b));
  writeFileSync(
    "/tmp/autodeck-customer-quote-tree.json",
    JSON.stringify(r.toJSON()),
  );
  expect(text(r)).toContain("Studio quote");
  expect(text(r)).toContain("Approve this exact total before payment.");
  const approve = r.root
    .findAllByType(Button)
    .find((x: any) => x.props.label === "Approve quote");
  const capturedApprove=approve.props.onPress;
  let finishApprove:any;h.approve.mockImplementationOnce(()=>new Promise(r=>finishApprove=r));
  await act(async () => {approve.props.onPress();approve.props.onPress()});expect(h.approve).toHaveBeenCalledTimes(1);await act(async()=>finishApprove({}));
  expect(h.approve).toHaveBeenCalledWith("quote-b", 129900, "v2");
  await act(async () => h.bookingCb({ ...b, status: "CANCELLED" }));
  expect(
    r.root
      .findAllByType(Button)
      .some((x: any) => x.props.label === "Approve quote"),
  ).toBe(false);
  await act(async()=>capturedApprove());expect(h.approve).toHaveBeenCalledTimes(1);
  await act(async()=>h.bookingCb({...b,status:'EXPIRED'}));await act(async()=>capturedApprove());expect(h.approve).toHaveBeenCalledTimes(1);
  await act(async()=>h.bookingCb({...b,status:'COMPLETED'}));await act(async()=>capturedApprove());expect(h.approve).toHaveBeenCalledTimes(1);
  await act(async () => h.bookingCb(b));
  await act(async () =>
    h.paymentCb({ ...payment, status: "completed", invoiceReviewNeeded: true }),
  );
  writeFileSync(
    "/tmp/autodeck-customer-review-tree.json",
    JSON.stringify(r.toJSON()),
  );
  expect(text(r)).toContain(
    "Money received - office review needed. Do not pay again.",
  );
  expect(text(r)).not.toContain("Continue online payment");
  await act(async()=>capturedApprove());expect(h.approve).toHaveBeenCalledTimes(1);
  await act(async () => r.unmount());
});

it('actual detail cancel is singleflight and former booking result cannot cancel new booking',async()=>{
 h.cancel.mockReset();let resolve:any;h.cancel.mockImplementation(()=>new Promise(r=>resolve=r));__params.current={id:'cancel-first'};let r:any;await act(async()=>{r=create(<Detail/>)});
 const b:any={...job,id:'cancel-first',notes:null,status:'CONFIRMED',payMode:'studio',serviceId:'svc',quoteStatus:'approved',scheduledDate:'2099-01-01',scheduledTime:'10:00',scheduledAt:'2099-01-01T04:30:00Z',estimatedEndDate:'2099-01-01',estimatedEndTime:'11:00',durationMinutes:60,priceBreakdown:{total:250000,tax:0,addOns:[],basePrice:250000,scopeAdjustment:0}};
 await act(async()=>h.bookingCb(b));const button=(label:string)=>r.root.findAllByType(Button).find((x:any)=>x.props.label===label);expect(button('Cancel booking')).toBeTruthy();await act(async()=>button('Cancel booking')!.props.onPress());await act(async()=>{button('Yes, cancel booking')!.props.onPress();button('Yes, cancel booking')!.props.onPress()});expect(h.cancel).toHaveBeenCalledTimes(1);
 __params.current={id:'cancel-second'};await act(async()=>r.update(<Detail/>));await act(async()=>h.bookingCb({...b,id:'cancel-second'}));await act(async()=>resolve({cancellationPending:false}));expect(button('Cancel booking')).toBeTruthy();expect(text(r)).not.toContain('Yes, cancel booking');await act(async()=>r.unmount());
});

it('actual rating singleflight and late previous booking success never thanks next booking',async()=>{h.review.mockReset();let resolve:any;h.review.mockImplementation(()=>new Promise(r=>resolve=r));__params.current={id:'rating-first'};let r:any;await act(async()=>{r=create(<Detail/>)});const b:any={...job,id:'rating-first',notes:null,status:'COMPLETED',payMode:'studio',serviceId:'svc',quoteStatus:'approved',scheduledDate:'2026-11-01',scheduledTime:'10:00',scheduledAt:'2026-11-01T04:30:00Z',estimatedEndDate:'2026-11-01',estimatedEndTime:'11:00',durationMinutes:60,priceBreakdown:{total:250000,tax:0,addOns:[],basePrice:250000,scopeAdjustment:0}};await act(async()=>h.bookingCb(b));await act(async()=>r.root.findAll((x:any)=>x.props.accessibilityLabel==='5 stars'&&typeof x.props.onPress==='function')[0].props.onPress());const send=r.root.findAllByType(Button).find((x:any)=>x.props.label==='Send rating')!;await act(async()=>{send.props.onPress();send.props.onPress()});expect(h.review).toHaveBeenCalledTimes(1);__params.current={id:'rating-next'};await act(async()=>r.update(<Detail/>));await act(async()=>h.bookingCb({...b,id:'rating-next'}));await act(async()=>resolve({}));expect(text(r)).not.toContain('Thanks for rating');await act(async()=>r.unmount())});

it('actual live approval decision singleflight, old approval listener and late failure cannot populate next job',async()=>{h.approval.mockReset();let reject:any;h.approval.mockImplementation(()=>new Promise((_,j)=>reject=j));__params.current={id:'approval-job'};let r:any;await act(async()=>{r=create(<Detail/>)});await act(async()=>h.bookingCb(null));await act(async()=>h.jobCb({...job,id:'approval-job',status:'IN_PROGRESS',bookingId:null}));const old=h.approvalCb;await act(async()=>old([{id:'pending',status:'pending',serviceName:'PRIVATE-OLD-WORK',priceImpact:100,newTotal:250100,originalAmount:250000,createdAt:'2026-11-01'}]));const approve=r.root.findAllByType(Button).find((x:any)=>String(x.props.label).startsWith('Approve +'))!;await act(async()=>{approve.props.onPress();approve.props.onPress()});expect(h.approval).toHaveBeenCalledTimes(1);__params.current={id:'approval-next'};await act(async()=>r.update(<Detail/>));await act(async()=>h.bookingCb(null));await act(async()=>h.jobCb({...job,id:'approval-next',status:'IN_PROGRESS',bookingId:null}));await act(async()=>{old([{id:'late',status:'pending',serviceName:'PRIVATE-OLD-LATE',priceImpact:1,newTotal:2}]);reject(Error('PRIVATE-OLD-ERROR'))});expect(text(r)).not.toContain('PRIVATE-OLD');await act(async()=>r.unmount())});

it('detail captured approval refuses withdrawn current request and inspection old finalized callback cannot show next route report',async()=>{h.approval.mockReset();__params.current={id:'capture-first'};let r:any;await act(async()=>{r=create(<Detail/>)});await act(async()=>h.bookingCb(null));await act(async()=>h.jobCb({...job,id:'capture-first',status:'IN_PROGRESS',bookingId:null}));const oldInspection=h.inspectionCb;await act(async()=>h.approvalCb([{id:'pending',status:'pending',serviceName:'Work',priceImpact:100,newTotal:250100}]));const captured=r.root.findAllByType(Button).find((x:any)=>String(x.props.label).startsWith('Approve +'))!.props.onPress;await act(async()=>h.approvalCb([{id:'pending',status:'cancelled',serviceName:'Work',priceImpact:100}]));await act(async()=>captured());expect(h.approval).not.toHaveBeenCalled();await act(async()=>oldInspection({status:'finalized'}));expect(text(r)).toContain('Inspection report');__params.current={id:'capture-next'};await act(async()=>r.update(<Detail/>));await act(async()=>h.bookingCb(null));await act(async()=>h.jobCb({...job,id:'capture-next',status:'IN_PROGRESS',bookingId:null}));await act(async()=>oldInspection({status:'finalized'}));expect(text(r)).not.toContain('Inspection report');await act(async()=>r.unmount())});
