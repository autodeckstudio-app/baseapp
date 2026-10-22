// Browser cart (localStorage, no account). Dev/fixture flow only: the order total shown comes from the server response.
const KEY = 'ad_cart_v1';
const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const set = c => localStorage.setItem(KEY, JSON.stringify(c));
document.querySelectorAll('[data-add-to-cart]').forEach(b => b.addEventListener('click', () => {
  const sel = document.querySelector('[data-variant]');
  const c = get(); const id = b.dataset.addToCart, v = sel ? sel.value : '';
  const l = c.find(x => x.productId === id && x.variantId === v);
  if (l) l.quantity = Math.min(10, l.quantity + 1); else c.push({ productId: id, variantId: v, quantity: 1 });
  set(c); const m = document.querySelector('[data-cart-msg]'); if (m) m.textContent = 'Added. Items in cart: ' + c.reduce((s, x) => s + x.quantity, 0);
}));
const root = document.querySelector('[data-cart]');
if (root) {
  const list = root.querySelector('[data-cart-lines]'), out = root.querySelector('[data-cart-result]'), form = root.querySelector('form');
  const draw = () => { const c = get(); list.innerHTML = c.length ? c.map(l => `<li>${l.productId} / ${l.variantId} x ${l.quantity} <button type="button" data-rm="${l.productId}|${l.variantId}">Remove</button></li>`).join('') : '<li>Cart is empty.</li>'; };
  list.addEventListener('click', e => { const k = e.target.dataset && e.target.dataset.rm; if (!k) return; const [p, v] = k.split('|'); set(get().filter(x => !(x.productId === p && x.variantId === v))); draw(); });
  draw();
  const keyName = 'ad_cart_key';
  let ck = localStorage.getItem(keyName); if (!ck) { ck = 'k' + crypto.randomUUID().replace(/-/g, ''); localStorage.setItem(keyName, ck); }
  form.addEventListener('submit', async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(form));
    out.textContent = 'Checking with the server...';
    try {
      const r = await fetch(root.dataset.orderUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: get(), guest: { ...f, clientKey: ck } }) });
      const j = await r.json();
      out.textContent = j.ok ? `TEST ORDER (fixture, no payment). Server total: Rs ${(j.totalPaise / 100).toFixed(2)}${j.replay ? ' (same order as before)' : ''}` : `Cannot order: ${j.code}${j.detail ? ' (' + j.detail + ')' : ''}`;
    } catch { out.textContent = 'Order server not reachable (local fixture server is not running).'; }
  });
}
