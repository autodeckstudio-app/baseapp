# A-F source and deployed artifact custody

Source content: commit a3c5207e, tree191f1363c9b85d3abe1a1c78c63ed9b9ae6d2b94. This is recovered content, not original707651b1commit-object recovery. Backup-only Vercel suppression stays out of deployed code.

Actual per-function compiled source was derived from each live generation, not a wholesale build from current repository. Diffs in this directory are the complete runtime code changes. Runtime wrappers, unrelated helpers, original dependencies and lock files retained.

Five successful source-only updates: createBooking, createWalkinJob, getAvailability, rescheduleBooking, requestBookingReschedule. See post-release-summary and deployed-source-verification for exact runtime revisions and source generations. Source zip and bundle bytes re-downloaded and matched the reviewed artifacts. Runtime, entrypoint, environment/service configuration, triggers and IAM unchanged.

restoreVehicle already had the claimed-customer resolver in its deployed generation and was not redeployed. updateVehicle normalized-duplicate fix is prepared but was not deployed in this record, pending isolated dependency-lock qualification because its current source has no package-lock.

Prepared compiled-artifact tests: 18/18 across six emulator files. Compiled date/time consumer probes:16/16. Source units2095pass1skip and Functions typecheck pass. Fixtures are fictional demo-project records only. No live booking/payment/role tests. These results do not establish real customer/staff/payment/device acceptance.
