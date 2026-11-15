# Explicit unused transport closure, local only

The dormant `closeUnusedVisitTransport` helper records an explicit Admin closure
of unused legs from the original saved cancellation review. It is not imported
by production callables or screens, and no deployment is included.

## Invariants

- Admin/superadmin and exact tenant, visit, cancelled original anchor, current
  bill token, current request hash and saved unused-leg choice are required.
- Every retained leg must have a real completion stamp. Every unused leg must
  remain unstamped. An active handover blocks closure.
- One private closure row is keyed by original job, paired with a marker on the
  original retention proof. Reads validate both sides, original scope, full
  request hash, exact retained charge and the closure's own hash. Missing row,
  missing marker, changed hash or subsequent request drift holds reads.
- Exact actor/command replay is idempotent, including concurrent replay. A new
  operation, different actor or changed choice cannot reuse that approval.
- The original request is not edited. In particular status stays CONFIRMED;
  unused drop does not become DONE/DECLINED and does not gain a completion stamp.
  Existing retained stamps, original invoice, money, sibling service and return
  amounts remain unchanged. The visit revision is incremented to invalidate
  stale physical reviews.
- Final sibling cancellation accepts independently validated completed transport
  or this closure, not mere request status. DONE without all retained stamps is
  rejected. Existing last-service fees and full funding/work checks still apply.
- Private closure facts remain inaccessible to direct clients, including Admin
  and superadmin. No provider call or money movement is added.

## Qualification

Sixteen new billing emulator cases cover unchanged request/invoice/money/sibling,
exact stale choices, missing pickup, actual drop, active handover, tenant/role,
reciprocal marker/hash/request drift, concurrent replay and changed actor/op.
Actual final sibling cancellation retains its existing10000paise fee and leaves
the original143963paise return separate from the final230000paise return. False
DONE without retained drop evidence holds both billing and final review.

All358billing cases pass in eight exact-name disjoint batches (seven45, one43).
Collected names and passing-name union checked for complete unique coverage.
Connected/intake/schedule/work/covered/Accountant/legacy-owed/privacy293cases
pass across10files, including169direct-client privacy cases. Functions types
and build pass. Full Functions units1969pass,1skip,1unchanged explicit
staff-alert-label test failure. No app/core/UI sources changed.

## Not finished

The legacy request status still reads CONFIRMED because original physical facts
are preserved. Request-list/customer/staff projections do not yet surface the
separate terminal closure proof. This helper alone is not a complete transport
workflow and must not be activated without truthful read projection plus actual
routed before/after visual review. No UI/copy change or preview acceptance is
claimed. Partial/unfunded retained-charge invoice/PDF/Accountant treatment,
outstanding final fees, general benefit extras and provider activation are
separate unfinished work. Existing release and provider-money holds remain.
