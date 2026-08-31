# firebase/

Firestore security rules and index definitions for AutoDeck's own Firebase project(s) — entirely separate from AutoModz's `automodz` project. No AutoDeck Firebase/GCP project has been created yet. Rules run locally against the Firebase Emulator Suite (`demo-autodeck`) — see the repo-root `firebase.json`/`.firebaserc`.

- `firestore.rules` — **Phase 1: the full ruleset**, covering all 17 collections from the approved data model, following the "thin, deny-by-default" pattern: reads scoped by role/ownership, writes to every operational collection denied for all clients and every role (the backend, via the Admin SDK, is the sole writer). Tested by `tests/rules/firestore.rules.test.ts`.
- `firestore.indexes.json` — still a placeholder; composite indexes will be added as query patterns are implemented in Phase 2.

See the approved technical-design document (§2.2) for the full rules design rationale.
