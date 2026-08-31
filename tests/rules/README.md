# tests/rules

Firestore security-rule tests (`@firebase/rules-unit-testing`), run against the Firebase emulator suite — e.g. asserting a Staff-role token cannot write pricing fields, cannot write to `auditLogs`, and that a `sealed` visit rejects all updates.

**Status**: Phase 1 implemented (`firestore.rules.test.ts`) — covers ownership-scoped reads, backend-only writes (including for Owner/Admin), append-only audit logs, and sealed-visit immutability. This is a plain folder, not a pnpm workspace package (kept out of `pnpm-workspace.yaml` per explicit instruction); its test dependencies are declared in the repo-root `package.json` and resolve via Node's standard upward module resolution. Run from the repo root: `pnpm run test:rules` (starts the local emulator via `firebase emulators:exec`, runs the suite, shuts the emulator down — never touches any real project).
