# Customer visual polish, 9 November 2026

## Owner request and scope

After reviewing the live studio buttons, the owner requested smaller controls, icons only, all five in one line. Subsequent voice instructions asked for an app-wide visual review with less oversized text and obvious icon actions, using app examples as inspiration, and one consolidated checked push for the remaining changes.

This batch changes visual presentation only. No backend deployment, payment activation, issuer/GST inference, new capabilities or production test records. Existing booking, quote, approval and legal boundaries remain in place. Native source can be exported but an installed native app has not been rebuilt or physically accepted.

## Audit and changes

Actual live Home, Bookings, Services, Garage, You and Help screens were inspected. Forms, quote/enquiry, notification, membership, invoice and car-detail source were reviewed for shared hierarchy and consequential controls.

- Studio contacts: one centered row, five icon-only actions. Each visible colored circle is34px, inside a48px target. All five existing callbacks and accessible names retained. Reduced motion disables pressed scale. Canonical address, hours/status and destinations unchanged.
- Shared SceneIntro headings: compact24/28px and standard28/33px instead of28/32 and36/39. Shared PageHeader22/28 instead of26/32. CanvasTitle32/38, up to two lines instead of52/56 one line, so long titles fit.
- Services: concise "Explore services" intro;20/25px category names; chevron beside title instead of repeated "Explore services" sentences. Category descriptions and scope information retained.
- Garage: "Your cars" instead of a repeated promotional statement.
- Bookings: short state headings ("In the studio", "Upcoming visit", "No upcoming visits"). Counts, sections, status and timing remain explicit.
- Profile: accessible pencil replaces visible "Edit" word, same edit callback. Shared small edit/delete controls retain compact visuals with enlarged hit slop.

Payment, approval, destructive action, sign-out, booking confirmation and form labels were deliberately preserved. A universal icon-only conversion would make consequential actions unclear. Service names, descriptions, totals, policy warnings, exact product names and the official Home tagline were not removed. Help remains readable, with actual address and hours available there.

## Reference review

Visual automotive examples were inspected, not copied:
https://www.pinterest.com/ideas/automotive-app-design-resources/951649628148/

Material guidance supports common-action icons, clear names, contrast and48px targets:
https://m3.material.io/components/icon-buttons/guidelines
https://m3.material.io/components/icon-buttons/accessibility

NNG cautions that most icons are ambiguous without text. This informed retaining labels for complex and consequential actions:
https://www.nngroup.com/articles/icon-usability/

## Qualification

-990 customer unit tests,160 files, pass.
-218 mounted/render tests,78 files, pass. Regression covers all five contact callbacks,48px targets, icon-only text absence, both reduced-motion states, shared typography and profile edit callback.
-Customer types pass; full locked customer lint zero errors (existing warnings retained).
-Clean iOS and Android JS/Hermes exports pass. These are exports, not installed-device acceptance.
-Actual components inspected at320/390/820px in day/night.24 app-component scenarios plus contact/pressed states, no horizontal overflow. Profile edit exercised in a local fixture only. No production field/upload/save/contact action.

Prior source db909fb0 exact hosted validate and emulator both succeeded in run42529501383. Preserved earlier696b20cf emulator failure was one refund-reservation concurrency code3 closed-transaction error (1157pass/1fail/1skip). No refund code was changed here, so later success is not claimed as a refund fix. Current consolidated source requires its own CI and live promotion checks after push.
