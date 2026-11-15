# 21 - Current Implementation Status

**As audited:** 23 September 2026  
**Source of truth:** `main` at `1318d0d`  
**Product decision:** one AutoDeck mobile app for customers and studio staff by role, AutoDeck Admin on web, one Firebase backend.

## What exists

| Surface  | Implemented foundation                                                                                                                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer | Phone auth and profile setup; vehicle garage; service catalogue; booking, cancel and reschedule; job detail; inspections; approvals; invoices and payment links; membership; notifications; warranties and protection.                                    |
| Studio   | Staff auth; daily queue; job detail and status changes; inspections; bay board; calendar; walk-in intake; customer and vehicle lookup; payment and membership actions.                                                                                    |
| Admin    | Dashboard; bookings; jobs; customers; vehicles; invoices; payments; memberships; services; staff; studio settings; audit log.                                                                                                                             |
| Backend  | Catalogue and pricing; booking and availability; jobs and approvals; inspections; payment links, webhooks and refunds; membership; notifications; warranty and protection; multi-tenant authorization; rate limiting; App Check; scheduled expiry sweeps. |

## What is proven in the repository

- All eight code packages typecheck together.
- The functions and admin applications have unit and emulator test suites.
- Production payment mocking is guarded from the production project.
- Business-critical writes are routed through callable functions and protected by rules.
- The real Automodz service catalogue was imported in commit `e97ca63`.

## What is not yet proven

- A staging journey across every surface: customer sign-in -> booking -> staff check-in and work -> approval -> payment -> invoice/warranty -> customer history.
- One mobile binary. Customer and studio are still separate Expo apps in the tree.
- Production deployment configuration for Firebase projects, App Check, Razorpay, notifications and hosting.
- Device delivery for push notifications, camera uploads, deep links and offline/retry behavior.
- Complete visual and personalization migration from Automodz.

## Immediate priorities

1. Keep `main` canonical and archive the divergent `feature/autodeck-phase1` implementation after reviewing it for isolated reusable tests or decisions.
2. Make CI consistently green and run emulator suites in an environment with Java and Firebase emulators.
3. Prove the full staging journey and tenant/role boundaries.
4. Unify customer and staff routes into one AutoDeck mobile shell.
5. Port the Automodz experience - semantic themes, vehicle-first home, photography, motion, navigation and personalized state - without copying its server layer.

## Reading the older plans

- [`16-build-phases.md`](16-build-phases.md) is the original forecast and scope sequence.
- [`20-v1-product-scope.md`](20-v1-product-scope.md) defines the original minimum end-to-end test.

They are retained for product history. Their checkboxes were never maintained as implementation state; use this document and executable CI instead.
