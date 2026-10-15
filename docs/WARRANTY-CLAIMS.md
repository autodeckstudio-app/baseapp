# Warranty and spec claims shown in the customer app

Status: UNCONFIRMED. These were web-researched, not supplied by the owner. Confirm each against the official
brand page before launch, then record the confirmation date here. Displayed values are unchanged.

## A. Seeded menu (packages/core/src/menu.ts). Source: working market-study placeholders, no brand page cited
| Card | Shown | Where |
| --- | --- | --- |
| AutoDeck Care Ceramic 1-year / 2-year | "1-year / 2-year coating warranty" | menu.ts coat() |
| Fireball 1-year / 2-year / 3-year | "1/2/3-year coating warranty" | menu.ts coat() |
| Kovalent Graphene 7-year | "7-year coating warranty" | menu.ts coat() |
| Kovalent Prolong, Borophene, 3M Ceramic | no warranty shown | menu.ts coat() |
| Garware PPF (all coverages) | "8-year film warranty" | menu.ts ppf() |
| XPEL, LLumar, 3M PPF (all coverages) | "10-year film warranty" | menu.ts ppf() |

## B. Warranty label overrides (apps/customer/src/lib/catalogue-service.ts, SITE_WARRANTY)
| Service name | Shown | Claimed source |
| --- | --- | --- |
| Garware Plus | 5-Year PPF Film Warranty | garwarehitechfilms.com |
| Garware Premium | 8-Year PPF Film Warranty | garwarehitechfilms.com |
| Garware Platinum | blank | no source found |
| LLumar Gloss | 5-Year PPF Film Warranty | llumar.com |
| LLumar Platinum | 10-Year PPF Film Warranty | llumar.com |
| LLumar Valor | blank | no source found |

Note: A and B can disagree (e.g. menu seed says Garware 8-year for every Garware level, override says Plus is 5-year).

## C. Brand range pages (apps/customer/src/lib/brands.ts). Source noted per brand in that file
| Brand | Claim shown | Source listed |
| --- | --- | --- |
| XPEL | Ultimate Plus and Stealth, 10-year limited warranty | xpel.com/warranty-information |
| Garware | Premium 8-year, Plus 5-year, Protect 3-year, Ceramic Coating 9H with 3-year | garwarehitechfilms.com |
| LLumar | Platinum Gloss 10-year, Gloss and Matte 5-year (restrictions apply) | llumar.com/en/paint-protection-film |
| 3M | PPF Pro Series 200 10-year consumer warranty; Ceramic Coating "durable up to five years" | 3mindia.in |
| Kovalent | Borophene "9 years durability", 9H+, boron nitride; Graphene 7-year; Graphene Matrix "self-heals minor swirls when heat-activated"; Prolong 9H | kovalentcoatings.com/products |
| Fireball | Dok Do "9H flagship, top coat and base coat" | fireballkorea.com/ceramic-coating |

Conflict to resolve: Kovalent Borophene shows "9 years durability" in C, no warranty in A.
