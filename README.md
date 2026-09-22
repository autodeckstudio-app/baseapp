# AutoDeck

AutoDeck is one automotive service ecosystem with one brand, one Firebase backend and role-based experiences.

## Product surfaces

- **AutoDeck mobile app** - customer and studio-staff experiences selected by authenticated role. The repository currently contains separate `apps/customer` and `apps/studio` Expo shells; unifying them into one distributable app is the next architecture milestone.
- **AutoDeck Admin** - a Next.js web application for business configuration and operational control.
- **AutoDeck backend** - Firebase Auth, Firestore, Storage, Cloud Functions and security rules shared by every surface.

## Current implementation

This is an active implementation, not an empty scaffold. The main branch includes:

- customer authentication, vehicles, catalogue, bookings, approvals, payments, memberships, notifications, inspections and warranty/protection flows;
- studio job queue, job lifecycle, bay board, calendar, walk-ins and customer/vehicle lookup;
- admin dashboards and management for bookings, jobs, customers, vehicles, invoices, payments, memberships, services, staff, studio settings and audit records;
- hardened multi-tenant Cloud Functions, Firestore rules, storage rules and emulator test suites.

See [`docs/21-current-implementation-status.md`](docs/21-current-implementation-status.md) for the evidence-based status and known gaps. The earlier phase plans remain useful as scope history, but unchecked boxes in those documents are not a live status tracker.

## Architecture direction

`main` is the source of truth. Automodz is a product and design reference; its legacy server architecture should not be merged into AutoDeck. Experience work should be ported or rebuilt on the AutoDeck domain and backend.

The remote `feature/autodeck-phase1` branch is a divergent NestJS-era implementation. Do not merge it wholesale.

## Local development

Requirements: Node 20 and pnpm 9.15.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Use the Firebase Emulator Suite for local integration work. Real credentials belong in local or deployment secret stores and must never be committed.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`next build` does not require `FIREBASE_SERVICE_ACCOUNT_KEY`. The Admin SDK resolves credentials only when a session API request runs. A non-GCP production host still requires that secret at runtime; Firebase App Hosting and Cloud Run can use Application Default Credentials.

## Delivery rule

Changes land through reviewable pull requests. CI validates formatting, lint, types, unit tests and production builds. Emulator integration tests remain a separate environment-dependent gate.
