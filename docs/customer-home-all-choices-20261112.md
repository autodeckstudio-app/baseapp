# Home service choices correction

Preview inspected at 390 and 1280 pixels before release. Garage check opens Garage families; Book an inspection opens Inspection choices, not Repairs. The card key now controls the destination independently of the product used for its price. All four Home cards retain Home-origin Back behavior, including after refresh and through a product page. Inspection starting price comes from the existing inspection record. No catalogue data, prices, payments, bookings or backend changes.

Owner approval: authenticated iMessage phonemsg-01M7877C9EE3P9W2KJV065TT22, 12 Nov 2026 21:20:04 Asia/Kolkata, "Yes", following explicit push request phonemsg-01M786N9Q7HME7WC606VTM8GEN and correction preview phonemsg-01M786D8Z36YB6K7N5FE314KES.

Qualification: 1080 unit tests and typecheck passed. Local real-component proof passed both widths with saved catalogue/sample car, no external calls. 345/346 render tests passed. The same cancellation-button assertion fails on the unchanged PR21 tree and is outside this correction; no payment behavior changed. Native device pixels not tested. Protected PR checks and actual production pixels remain release gates.
