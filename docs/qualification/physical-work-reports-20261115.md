# Actual physical work, shared handover and read-only returns reports

## Scope and holds

Local demo/emulator proof only. No production/provider activation, live money, push or deployment. Existing Admin, Studio and Customer shells remain. New wording is short status/action copy, not a new design. Accountant remains disabled in a production build. No automatic completion, service grouping, cancellation approval or return is introduced.

## Current-state check and review navigation

The live baseline was inspected read-only earlier in this batch at the actual Admin and Studio job routes; those URLs are recorded in benefit-operations-20261115.md. This stage did not write live records. The Accountant before route is separately captured at 320/390/1280 in autodeck-operational-accountant-before and shows the existing disabled view.

Local review sequence:

1. Studio > Job > Start Work > service > Record performed work.
2. Standby sibling > Admit visit service > target bay > explicitly pause incompatible unfinished work > Confirm car move.
3. Record sibling work, resume the original service with explicit affected-service review. Work and QC are independent.
4. Studio > QC > service > Record QC check > Send to quality check > Mark Ready. This does not complete the sibling.
5. Admin > Job > Visit receipt > Review receipt > actual-receipt checkbox > Record this receipt.
6. Admin > each Job > Performed work and QC > complete-record checkbox > Lock work.
7. Admin > Mark delivered > Use recorded work > Reviewed all visit services > Confirm visit handover.
8. Customer > booking > progress and Visit charges. Admin > Money > Reports. Accountant > Money.

## Actual mixed-category proof

The fixture starts only initial arrival and catalogue facts. Every later work/QC record, bay move, receipt, invoice and handover uses actual mounted controls and original transaction writers. Wash work is preserved while paused for a detailing bay. Interior work is preserved when wash resumes. QC/ready on wash leaves interior IN_PROGRESS. Both services become DELIVERED only after their recorded work is locked, one actual cash receipt of Rs3,600 creates one consolidated original invoice, and explicit shared handover succeeds. Two category moves create two bay receipts; arrival remains one event per service. Physical/work steps do not alter money.

A separate compatible-parallel fixture places both services in the same bay type. Both independently record work, share Wash Bay1 and move together to Wash Bay2 without a pause. Both remain IN_PROGRESS, no visitBayPause appears, and their work and money snapshots remain unchanged. This proves compatible parallel work is not forced into serial completion.

## Actual report proof

Office and Accountant use actual authenticated routes and source projections. Gross receipts are not net revenue. A mixed fixture shows Rs3,600 gross receipts, Rs720 cash and Rs2,880 online, Rs240 actually returned cash, and Rs960 online return still held. No provider was called; online capture is injected test evidence. Accountant redacts private job/customer/provider/source fields. Source collections are byte-compared around read-only report navigation. Return totals are unavailable rather than zero if missing, malformed or inconsistent.

Both report pages discard obsolete month/scope responses and clear old data on loading/failure. Office mounted regression exercises late response, failed month and wrong-studio response. Accountant uses authenticated studio scope only within the local preview gate; production scope and activation are unchanged.

## Verification

- Admin unit: 70 files, 327 tests passed.
- Admin mounted: 54 files, 194 tests passed, including six new return-total cases and report response-race regression.
- Functions unit: 160 files, 2,025 passed, one skipped.
- Admin and Functions typecheck passed; optimized Admin preview build passed.
- Targeted billing emulator: three passed, 457 skipped: real shared receipt/handover, mixed cash/online reports, held mixed return.
- A broad billing/work/schedule emulator attempt exceeded the command time limit before a summary. No full emulator pass is claimed for this stage. The subsequent narrowed emulator run completed cleanly.
- Actual mixed physical, compatible parallel and mixed-return/report scripts passed. All three shells captured at 320/390/1280. Decisive 320/390/1280 pixels inspected, including both-service move review, QC without sibling completion, shared handover, Customer delivered totals and Accountant returns.
- Production Functions bundle rebuilt from src/index.ts after previews.

## Artifacts and limits

Screenshots/text are in autodeck-operational-physical-mixed, autodeck-operational-physical-parallel, autodeck-operational-returns-reports. Existing telemetry callable is absent from the narrow preview and emits CORS console noise; lifecycle/report callables pass. No failure screenshots are included. Local runtime tokens are not saved in evidence.

This is a connected operational checkpoint, not whole-outcome completion or approval. Unfunded retained obligations, final policy-fee plus trip allocation/collection, registered/taxed issuance, general benefit extras, further credential-free online qualification and final combined owner review remain. Existing policy and fiscal guards stay in place. No new owner decision is established here.
