# Bookings suggestion cleanup and exact-car continuity

Scope: empty Upcoming suggestions only. Due work first; identical due/last-service IDs deduplicated for the selected owned vehicle. One car heading, reason and Choose time. Different services remain separate. Remove standalone day-preference strip whose Earliest time label implied availability. Real availability still loads in the existing booking screen.

Navigation carries vehicleId with serviceId. The requested car must exist in the current owner feed, otherwise no silent fallback or continuation. Booking shows chosen car/plate with Change car for multi-car accounts. Explicit in-form changes survive later vehicle/preference refreshes; route/owner changes reset selection and reject stale listeners. Generic entries retain existing saved-car default. No backend/data/payment or notification changes.

Original owner approval: phonemsg-01M7CKMF38C94P19G3B0YYA6HD, 14 Nov 2026 14:13 IST, after matched visual and exact-car explanation. This document is a release record, not independent permission.

Qualification: Customer 1118 unit tests, 547 render tests; TypeScript pass, lint zero errors with existing warnings; production Expo web export and production-marker guard pass. Seven focused mounted tests cover ID routing, unknown/deleted car, explicit change preservation, account/route changes and generic default. Actual implemented local pixels checked at 320/390/desktop with inert sample adapters. No booking or payment transaction executed.

Release uses normal pull request and required CI/preview. Exact parent1134820 and nine-path guard permits Customer only, other surfaces skip. Runtime live acceptance is limited to read-only Bookings and initial date/time page; no time selection or checkout.
