# AutoDeck OS — Engineering Constitution

This repository is the new AutoDeck product.

## Current phase

Repository and architecture setup only.

Do not implement application features until the architecture, product specification, repository structure, environments, security model, and development workflow have been approved.

## Existing AutoModz product

The existing AutoModz PWA is a separate product and must remain untouched.

It may be inspected later as a reference for existing business logic, services, pricing, workflows, and requirements.

Do not copy its implementation blindly.

## Product direction

AutoDeck will be a native mobile product for iOS and Android, with a separate web-based admin application.

The product should provide GoMechanic-level automotive service functionality while maintaining an independent AutoDeck product architecture, UX, branding, terminology, and design system.

## Non-negotiables

- Native iOS and Android applications.
- No PWA wrapper for the customer or studio applications.
- Admin remains web-based.
- Separate production infrastructure from the existing AutoModz PWA.
- Strong role-based permissions.
- Operational data must be protected from unauthorized customer modification.
- All important operational mutations must be auditable.
- Do not copy GoMechanic's visual identity or implementation.
- Do not preserve existing AutoModz features merely because they already exist.
- Every existing feature must eventually be classified as KEEP, MODIFY, REBUILD, REPLACE, or REMOVE.
- Do not begin feature implementation before the architecture audit is complete.

## Development principle

Prefer a clean, scalable architecture over fast accumulation of UI features.

When requirements conflict, identify the conflict and recommend the better system before implementing it.
