# @autodeck/backend

AutoDeck's dedicated NestJS + TypeScript API service — the sole writer of all operational data (bookings, payments, packages, visits, staff, inventory, audit logs). Called by all four client surfaces (customer mobile, customer web, studio mobile, admin web); no client has direct write access to the database.

**Status**: Phase 1 implemented — app bootstrap, config validation, emulator-only Firebase Admin integration (fails closed if emulator config is missing/invalid), `FirebaseAuthGuard` + `RolesGuard` (custom-claims-only RBAC), audit-logging infrastructure, and a health endpoint. No business modules (bookings, payments, packages, etc.) exist yet — that's Phase 2.

Run locally: `pnpm --filter @autodeck/backend run test` (unit), and from the repo root `pnpm run test:backend:e2e` (integration, against the local Firebase Emulator Suite — `demo-autodeck`, never a real project).

See `docs/AutoModz-Audit-and-V1-Decisions.md` and the approved architecture/technical-design documents for the full API design, RBAC model, and domain boundaries (auth/RBAC, customers/vehicles, bookings, payments/webhooks, packages, visits/approvals, inventory, audit logging) this service will implement.
