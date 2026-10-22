// LOCAL DEV ONLY. Server-side pricing of a guest order from the FIXTURE catalogue.
// No payment, no database, no network beyond 127.0.0.1. Run: node --experimental-strip-types scripts/shop-dev-order-server.mjs
import http from 'node:http';
import fs from 'node:fs';
import { priceGuestOrder } from '../../../packages/core/src/shop-order.ts';
if (process.env.NODE_ENV === 'production') throw new Error('shop dev server refuses to run in production');
const fx = JSON.parse(fs.readFileSync(new URL('../src/data/shop-fixture.json', import.meta.url), 'utf8'));
const catalogue = {
  productionLive: false,
  deliveryPaise: 0, // fixture only: the owner has not set a delivery charge
  products: fx.products.map(p => ({ id: p.id, name: p.name, pricePaise: p.pricePaise ?? undefined, active: true, fixture: true, variants: p.variants })),
};
const seen = new Map(); // idempotency: key -> result
http.createServer((req, res) => {
  const h = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  if (req.method !== 'POST' || req.url !== '/order') { res.writeHead(404, h); return res.end('{}'); }
  let body = ''; req.on('data', c => { body += c; if (body.length > 20000) req.destroy(); });
  req.on('end', () => {
    let j; try { j = JSON.parse(body); } catch { res.writeHead(400, h); return res.end('{"ok":false,"code":"bad_json"}'); }
    const lines = Array.isArray(j.lines) ? j.lines.map(l => ({ productId: String(l.productId), variantId: String(l.variantId), quantity: Number(l.quantity) })) : [];
    const r = priceGuestOrder(catalogue, lines, j.guest || {});
    if (r.ok) { const prior = seen.get(r.idempotencyKey); if (prior) { res.writeHead(200, h); return res.end(JSON.stringify({ ...prior, replay: true })); } seen.set(r.idempotencyKey, { ...r, test: true, note: 'FIXTURE order. No payment taken.' }); }
    res.writeHead(r.ok ? 200 : 422, h); res.end(JSON.stringify(r.ok ? { ...r, test: true, note: 'FIXTURE order. No payment taken.' } : r));
  });
}).listen(8796, '127.0.0.1', () => console.log('shop dev order server on 127.0.0.1:8796'));
