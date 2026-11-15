# Customer screenshot corrections, 9 November 2026

Scope: remove payment helper sentence only; one Edit Vehicle cover preview; compact upload and Save/Cancel controls; reduce Home greeting gap; official existing-brand marks.

No payment action/verification, image storage/deletion, inspection evidence, catalogue eligibility, product facts or backend flags changed. All tests use fictional local data. No production fixture saved.

## Logo provenance

- CARPRO: https://www.carpro.global/ , exact inline header SVG, white native mark on dark ground. Brand-asset page: https://carpro.global/brand/ . SVG retained and rasterized unchanged for native/web compatibility.
- Koch-Chemie: https://www.koch-chemie.com/en/ , header/source https://www.koch-chemie.com/media/content/logos/logo_kochchemie-2025.svg . SVG retained, rasterized unchanged.
- Rodim: https://rodim.in/ , source https://rodim.in/wp-content/uploads/2024/12/logo.png . Original file unchanged.
- Avery Dennison: https://graphics.averydennison.com/eu-en/home/promotions/link-to-us-German.html , source https://graphics.averydennison.com/content/dam/averydennison/graphics/eu/en/Other/Avery%20Dennison%20logo%20positive%20black.png . Original file unchanged. Source page offers these web logo downloads.

Existing Fireball, Kovalent, XPEL, LLumar, Garware, NAR, AVVYX and GSWF assets remain unchanged. Shared registry is now brand-logos.ts, statically imported so product/reference routes can use the same contained marks without loading unrelated photo pools. Marks identify existing listed brands, not an accreditation or stock claim.

Gtechniq remains text. https://gtechniq.com/terms-and-conditions/ explicitly restricts logo reproduction to authorized use/formal partners. Bounded existing context check found product-placement discussion, not partner/approved-logo evidence. No generic affiliation is inferred.

## Verification

- Customer unit: 989 passed, 160 files.
- Customer mounted/render: 214 passed, 77 files, including payment continuation and server-completion guards.
- New regression: one selected cover preview, compact action props, Cancel does not upload. Existing native bytes-to-cover/RC service tests preserved.
- Actual components rendered locally at 320, 390, 820 px in day and night. Saved cover, replacement preview and Cancel exercised with a fictional image. Zero horizontal overflow. No field/image was saved to an external service.
- Home 320 px overlap caught and corrected before release. Responsive hero heights 224/240/280 px; exact official tagline retained, smaller 26 px type at narrow widths.
- Native export and backend runtime boundaries from preceding qualification remain unchanged. This UI release does not install a rebuilt native binary or deploy held functions.

## Incremental screenshot steering

Home studio card address display and matching accessibility-label address removed, only at that card. Canonical studio address, Help, name/hours/open status and Directions/Call/WhatsApp actions remain unchanged. Mounted regression checks absence of the address and preserved contact callbacks. Final mounted/render count: 215 across 78 files.

Hosted validation caught the new WebP declaration's import-type syntax against the actual locked ESLint preset. Replaced only that declaration syntax, no lint weakening. Full locked customer lint has zero errors. Types pass. Earlier substitute-config lint result was insufficient for this rule.

## Dynamic studio contacts

The studio card now has three distinct colored contact tiles (Call, WhatsApp, Directions) and two compact social cards. All five original callbacks and destinations are unchanged. Contact targets are80px high, social targets at least46px. Existing shared16px radius is retained. Press feedback changes opacity/border and applies a small scale only when reduced motion is off. Full accessibility labels include social channel/handle. No address, hours or open status change.

Qualification:990 customer unit tests and217 mounted/render tests pass. The mounted test exercises all five callbacks, minimum target size and pressed transforms with reduced motion both on and off. Customer types pass. Full customer lint using the locked preset passes with zero errors. Actual component pixels inspected at320/390/820 in day/night, with keyboard-pressed feedback and no horizontal overflow. These are local fictional fixtures, not production writes.

Prior696b20cf hosted validate passed, but emulator failed one existing money-refund concurrency case: the losing reserveRefund returned Firestore code3 "Transaction is invalid or closed." rather than the expected duplicate error.1157pass/1fail/1skip. No refund backend change or assertion weakening is included here. The earlier cancellation-specific recovery is not claimed to cover refunds. No backend deployment, payment activation or installed-native acceptance is implied.
