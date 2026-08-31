# @autodeck/domain

Pure, framework-agnostic business logic shared across every AutoDeck app: pricing/advance calculation, refund-eligibility rules, the booking/visit state machine, and zod request/entity schemas. No Firebase, Express/Nest, or React dependency — safe to share across the customer/staff trust boundary because it contains no privileged execution or secrets, only types and pure functions. The backend independently re-enforces every rule regardless of which app calls it.

**Status**: Phase 0 (implementation plan) complete. Implemented and fully unit-tested: `computePriceSnapshot` (service pricing + the 40% advance rule), `calculateCancellationRefund` (the 24-hour cancellation/refund rule), and `isValidBookingTransition` (the booking state machine). Not yet implemented: visit-stage/approval logic, package-usage logic, and the remaining zod entity schemas beyond `Service`/`PriceSnapshot` — planned for later phases.
