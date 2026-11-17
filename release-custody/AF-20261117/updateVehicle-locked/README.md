# F exact-runtime isolated qualification

Single compiled change.diff is the already-reviewed canonical normalized plate duplicate guard. Preserves archived/other-owner/other-tenant exclusions and self-normalization. No other runtime code changes from original artifact. Source zip is the prior prepared current-generation zip plus package-lock.json only, every prior entry byte-identical. Private original exports excluded from this packet.

Historical no-lock package had semver ranges. We do NOT claim exact dependency parity with old image. New lock resolves within every original range; package.json unchanged. FirebaseAdmin13.10.0/Functions6.6.0/Zod3.25.76; see full lock. npmci omitting dev succeeds on Node22.23.5. Tests import actual /tmp/ad-F-locked/lib/index.js so CJSrequire resolves this isolated node_modules, not source-tree dependencies. Firestore emulator only, fictional demo project, no productionwrites. Four actual handler/lifecycle tests pass. Metadata lookup warnings401 are incidental emulator auth lookup, assertions passed. Full handlers export load succeeded.

Audit records nine moderate and one high finding. High Zod constrained-collection resource exhaustion affects version<4.6.6, fix requires major4 upgrade outside original^3.24.1 and outside this defect. No auditfix executed. F accepts fixed-shape scalar vehicle fields rather than unbounded constrained collection data. Review exploitability and compatibility, do not fold unrelated deferred security/major upgrade into this release.

Request: independent artifact/runtime compatibility review before source-only deployment. Deployment preserves serviceConfig/runtime/entrypoint/triggers/IAM, original generation rollback retained. No money/roles/live synthetic writes.
