# Dormant visit provider protocol

Local protocol qualification only. No production transport, credentials, route, webhook wiring or activation. Collection enablement remains false.

The separate visit-specific protocol accepts only explicit INR balance, visit, bill and bounded original reference IDs. It never passes a visit ID as a booking ID. Creation disables partial payments, notifications and reminders. A create response is only a saved candidate. An independent exact-ID fetch must prove actual reference, currency and amount through the existing one-submit runner.

Lost-create discovery sends only the original reference filter. The documented payment_links response must be complete and exact. Unrelated rows, duplicate rows, unexpected pagination metadata, timeout or an empty result never permit another create. No customer details or raw provider error text are added to the request or journal.

All 35 protocol unit tests and all 147 billing emulator tests pass, including committed-before-POST, candidate-before-fetch, recovery through actual encoded list/direct-fetch requests, and no second POST after uncertainty. All HTTP responses in tests are injected synthetic fixtures; no provider account was contacted. Functions types/build pass.

Verified official contracts on 15 November 2026:
- https://razorpay.com/docs/api/payments/payment-links/create-standard
- https://razorpay.com/docs/us/api/payments/payment-links/fetch-all-standard
- https://razorpay.com/docs/us/api/payments/payment-links/fetch-id-standard

The credential-bearing production transport and eventual activation remain held and are not implemented by this module. No refund approval or return execution is implied.
