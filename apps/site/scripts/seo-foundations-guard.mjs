// Guard: SEO/AEO foundations stay in the built HTML (run after astro build).
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../dist/${p}`, import.meta.url), 'utf8');
const fail = (m) => { console.error(`seo-foundations-guard: ${m}`); process.exit(1); };

const home = read('index.html');
const faq = read('faq/index.html');
const privacy = read('privacy/index.html');
const sitemap = read('sitemap.xml');
const cart = read('shop/cart/index.html');
const shop = read('shop/index.html');
if (!cart.includes('content="noindex,follow"')) fail('cart page must be noindex,follow');
if (cart.includes('sitemap.xml') && sitemap.includes('/shop/cart')) fail('sitemap must not list the cart');
if (shop.includes('noindex')) fail('storefront must stay indexable');

if (!sitemap.includes('https://www.autodeck.in/faq')) fail('sitemap missing /faq');
if (!faq.includes('"@type":"FAQPage"')) fail('faq page missing FAQPage schema');
if ((faq.match(/"@type":"Question"/g) ?? []).length !== 11) fail('FAQPage must list all 11 questions');
if (privacy.includes('Car care, connected')) fail('subpage footer must use the approved tagline, not "Car care, connected"');
if (!privacy.includes('Complete car care. All under one roof.')) fail('subpage footer missing approved tagline');
const first = home.match(/<h[12][ >]/);
if (!first || first[0] !== '<h1 ') fail('homepage first heading is not the h1');
if (home.includes('<h2 class="rmh"')) fail('pre-h1 story headings must be paragraphs');
for (const [name, html] of [['home', home], ['privacy', privacy]]) {
  for (const tag of ['og:site_name', 'og:locale', 'twitter:title', 'twitter:description']) {
    if (!html.includes(tag)) fail(`${name} missing ${tag}`);
  }
  if (!html.includes('"@id":"https://www.autodeck.in/#business"')) fail(`${name} schema missing @id`);
  if (!html.includes('hasOfferCatalog')) fail(`${name} schema missing service catalogue`);
  if (html.includes('"geo"')) fail(`${name} schema must not carry geo until the map pin is verified`);
  if (html.includes('priceRange')) fail(`${name} schema must not carry priceRange while prices are unconfirmed`);
}
if (!privacy.includes('Sunbeam Complex, Old Sharda Mandir Rd, Ellisbridge, Ahmedabad 380006')) fail('footer missing street address');
console.log('seo-foundations-guard ok');
