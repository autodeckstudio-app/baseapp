# AutoDeck product design system

## Outcome
One product, three roles. The customer sees their vehicle, the current visit and the next useful action. Studio sees the next operational decision. Admin sees attention and business state. Information density changes by role, not component language.

## Shared contract
- 4px spacing unit. 8/12/16px internal groups, 24px sections, 48px only between major scenes.
- 16px cards, 20px panels, 24px sheets, 32px vehicle hero, pill controls.
- Inter body/data, Montserrat headings. Body 15/22, data 14/20, labels/captions minimum 12/16. Registration always dark ink on an explicit white plate.
- 44px minimum controls; no hover-only action, no color-only status. State label accompanies color.
- White/neutral surfaces and AutoDeck orange. Dark customer vehicle stages are intentional photographic surfaces; staff data uses light surfaces. Text contrast is not inherited from the image.
- One primary action per action group. Secondary actions are quiet, not rival orange buttons.
- Frosting belongs to navigation, overlays and raised controls. Flat rows/tables remain legible. Never stack decorative glass. Opaque fallback for reduced transparency.
- Subtle depth, no permanent glow. Reduced motion turns off movement; focus rings remain visible.

## Screen hierarchy
1. Current context: car/visit or today's studio.
2. Attention: approvals, unpaid handover, failed operation, waiting queue.
3. One next action.
4. Secondary activity behind navigation or disclosure. Do not duplicate counts with charts and rows.

## Image library
Curated 3:2 images are selected by subject, never by an unused-image allocator. Wash, PPF, coating, headlight, interior, engine and wheels have separate reviewed topics. Stock images have no visible plates. Product packshots preserve labels/colors on one warm-white panel. Uploaded customer, seller and evidence photos remain untouched.

## State contract
- Loading: no temporary zero KPIs or 'All clear' before core feeds settle.
- Empty: explain what belongs here and offer the relevant next action.
- Error: say what failed, preserve input, offer retry. Never silently show empty data.
- Busy: disable the firing control and show progress, prevent double submission.
- Confirm: show the specific effect, destination and cost where relevant.
- Standby: no bay/time promised, FIFO per compatible bay type, admission rechecks occupancy/reservations transactionally.

## Review status
Implemented and locally tested: quieter customer home, plate identity, shared photo identity, topic library, staff controls/queue, QC rework, paid handover, core admin dashboard loading/error state.
Live visual verification is recorded per release, not assumed from this document.
Still required before 'complete redesign': exhaustive route/state matrix across customer, admin and studio, including money/forms/modals, tablet layouts, keyboard navigation, reduced motion/transparency, text scaling and offline/errors. This document is the governing component contract, not a claim those checks passed.
