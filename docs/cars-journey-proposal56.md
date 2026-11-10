# Cars journey: private proposal

9 November 2026. Draft for review. Not published, not adopted terms, and not a completed vehicle-sale service.

## The requested product

The original 5 October direction asks for an easy, light Cars experience synced between customer and admin, with no staff-app Cars workflow. On 9 November the owner asks for buying/selling terms and a proper end-to-end experience, including a review of what is missing.

Keep the minimum product as a listing and enquiry journey. Do not add escrow, a deposit, a commission, a paid inspection or an ownership-transfer service by assumption.

## Built listing journey

Seller submits details/photos for review. Admin approves or rejects with a reason. Approved listings become visible, with the asking price withheld until an enquiry. Enquiries and reports go to admin; seller name, phone and registration are omitted from buyer responses. Seller can mark the listing sold. That removes it from browsing, not a legal declaration that money or ownership has transferred.

This batch adds exact submission recovery and retry, owner-aware status refresh, upload/photo safety and compatible server changes. Production customer/admin progression still needs an authorized real round. Listing recovery alone is not the whole terms request.

## Necessary additions proposed for approval

1. Seller declaration at final review: "I own this car or have the owner's permission to list it. The details and photos are accurate to the best of my knowledge, including known damage and finance."
2. A short contact/privacy explanation. The response-field privacy boundary exists in source. Structured-field omission does not hide text inside images. Uploaded photos remain unchanged and may show number plates or personal details, so users should check each photo and avoid personal documents.
3. Buyer guidance next to enquiry: listing approval is not a condition inspection or finance/ownership guarantee. Ask what was checked; discuss a viewing or inspection before a sale.
4. A compact buying checklist: match seller/car to RC, check insurance and finance, record agreed condition/price/handover, retain transfer submission and acknowledgement. This is guidance, not AutoDeck performing those steps.
5. Admin follow-up checklist attached to enquiry: enquiry received, viewing/inspection discussed, counterpart checks pending, sale outcome unconfirmed. No staff workflow, new sensitive-document store or fabricated completion tick.
6. Once wording is adopted, record its version and the seller's explicit confirmation with the submission. The current private preview does not collect consent or claim that this exists.

## Decisions, not work assigned to the owner

Review the supplied declaration/guidance and confirm the business role AutoDeck is willing to state. Existing code's "not a party to the sale" sentence is pre-existing but owner adoption is unverified. Do not publish it as newly approved legal protection. Fees, paid inspections, transfer handling and guarantees require a separate business decision only if AutoDeck wants to offer them. A vehicle-sale contract, escrow or payment settlement is not required merely to finish this listing/referral journey.

## Factual grounding for the checklist

The official Form29 is a transfer notice and refers to registration, insurance, finance/encumbrances and the registering authority's endorsement:
https://parivahan.gov.in/sites/default/files/DownloadForm/cmvr/FORM-29.pdf

Official Form30 separates transferor/transferee declarations and financier consent; its document list includes RC, insurance, address proof, pollution certificate and financier NOC. State/RTO requirements should be checked for the actual vehicle; no universal deadline or fee is asserted here:
https://vahan.parivahan.gov.in/vahanservice/vahan/ui/FeeRecieptPrintReport/Form_30_TO.xhtml

Private source preview: CarsJourneyProposal.tsx, deliberately unmounted. Seller/buyer/admin renders have no working commercial action and label all proposals inactive. No customer consent, inspection, payment or transfer was created.
