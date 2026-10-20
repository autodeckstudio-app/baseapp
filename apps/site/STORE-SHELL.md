# AutoDeck Store: Editions + Edit

18 October 2026. Editorial opening plus simple department filters and quick-view product panels. Current collection is deliberately empty. The page states that it is in the making, with no opening date, stock claim, fake products, prices, checkout or mailing-list collection. Old logo-merch names, archive T-shirt image and placeholder product drawings removed from the Store and Home store teaser. The data files no longer contain those names.

## Add real content
`src/data/shop.json` contains `edition` (null until ready) and `products` (empty until ready). An edition accepts title, description, image and imageAlt. Product fields: id (unique slug), name, department (Scent or Clothing), description, image, imageAlt, optional detailImage/detailImageAlt, optional provenance (Made for AutoDeck or Selected by AutoDeck), optional maker, and details [{label,value}]. Only supplied and verified material, fit, size, care, scent, format and volume should enter details. Do not infer personal vs car perfume. Cards without identifying information and a real image are excluded. No synthetic example products shipped.

Quick view uses native dialog: keyboard focus trap, Escape to close, labelled heading, close button, click-outside close and focus return. Base detail content remains available without JS through noscript. All/Scent/Clothing filters work on real products and show contextual empty states; the department links use the same filters. Second supplied photograph appears on hover and inside quick view. No purchasing action is enabled. Future checkout, variants, prices, availability, sourcing and policies remain separate work once real product data is given.

## QA
Production build, empty-data/source guards, real local pixels at 320, 390, 820 and 1280, reduced motion and no overflow checks. Filter pressed state and matching empty-state copy checked at every width. No photos or product claims invented to fill the opening. Dynamic interaction is subtle pointer-follow lighting and hover states; reduced motion disables that pointer light. The full product dialog visual is not verified with real product data because none is supplied yet. No live deployment.

## Candidate list and scope record (data only, nothing here is approved for sale)

Source: agent-authored menu "AutoDeck-first-shop-menu-18-Oct-2026.pdf", sent in the owner chat on 18 Oct 2026 at 1:13 AM (message phonemsg-01M55P8VZC3YVT0MZRS0N9Z7YV). It was never picked from. The owner's "we can try the flip" at 1:14 AM replied to a different message.

Candidates (public retail references checked 18 Oct 2026, not AutoDeck prices, nothing ordered): 01 car perfume, Involve ONE Musk; 02 personal perfume, Bella Vita CEO Man 100 ml; 03 Studio Tee reference; 04 Shield Cap reference; 05 hoodie later; 06 audio upgrade, Sony XS-FB162E; 07 ambient interior, Genfrid K4 Ultra; 08 reverse camera, Woodman. Mod prices are hardware only.

Owner decisions: range is perfumes, clothing and car accessories or mods (covers, key chains); own-brand made or selected; no logo merchandise (18 Oct 6:02 PM, which removes 03 and 04); concept is Editions plus Edit; the owner said he will share the product list later.

Open: actual products and suppliers, made vs selected, car or personal perfume, photos, prices, online sale vs catalogue, and sourcing/authenticity for any third-party item. The site shows no prices.
