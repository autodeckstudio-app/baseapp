# tests/integration

Cross-app/backend integration tests (Jest + Supertest against the Firebase emulator suite) — booking→payment→visit→seal flows, RBAC matrix coverage, state-machine transition coverage, payment-webhook idempotency, and the AutoModz-specific regression tests identified in the approved technical design (§O of the architecture document): no plate-string joins, no reachable demo/seed data path, full validation/rate-limiting route coverage, job-title changes never affecting authorization.

**Status**: no tests written yet — scaffold placeholder.
