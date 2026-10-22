// Browser cart (localStorage, no account). Fixture flow, dev only. Every amount shown comes from the server quote.
const KEY = 'ad_cart_v1';
const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const set = c => localStorage.setItem(KEY, JSON.stringify(c));
const inr = p => 'Rs ' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
document.querySelectorAll('[data-add-to-cart]').forEach(b => b.addEventListener('click', () => {
  const sel = document.querySelector('[name=size]:checked');
  const c = get(); const id = b.dataset.addToCart, v = sel ? sel.value : '';
  const l = c.find(x => x.productId === id && x.variantId === v);
  if (l) l.quantity = Math.min(10, l.quantity + 1); else c.push({ productId: id, variantId: v, quantity: 1 });
  set(c); const m = document.querySelector('[data-cart-msg]'); if (m) m.textContent = 'Added. Items in cart: ' + c.reduce((s, x) => s + x.quantity, 0);
}));
const root = document.querySelector('[data-cart]');
if (root) {
  const api = root.dataset.api, imgs = JSON.parse(root.dataset.imgs || '{}');
  const lines = root.querySelector('[data-lines]'), sum = root.querySelector('[data-sum]'), res = root.querySelector('[data-res]'), form = root.querySelector('form'), btn = root.querySelector('[data-submit]');
  const post = async (path, body) => { const r = await fetch(api + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return r.json(); };
  const draw = async () => {
    const c = get(); res.textContent = ''; res.className = 'res';
    if (!c.length) { lines.innerHTML = '<p class="empty-cart">Your cart is empty.</p>'; sum.innerHTML = ''; btn.disabled = true; return; }
    let q; try { q = await post('/quote', { lines: c }); } catch { lines.innerHTML = '<p class="empty-cart">The local order server is not running, so prices cannot be shown.</p>'; btn.disabled = true; return; }
    if (!q.ok) { lines.innerHTML = `<p class="empty-cart">Cannot price this cart: ${q.code}${q.detail ? ' (' + q.detail + ')' : ''}.</p><button class="rm" data-clear>Clear cart</button>`; sum.innerHTML = ''; btn.disabled = true; return; }
    btn.disabled = false;
    lines.innerHTML = q.lines.map(l => `<div class="cl"><img src="${imgs[l.productId] || ''}" alt=""><div><h3>${l.name}</h3><small>Size ${l.variantLabel} · ${inr(l.unitPaise)} each</small><span class="qty"><button type="button" data-d="-1" data-k="${l.productId}|${l.variantId}" aria-label="Fewer">-</button><b>${l.quantity}</b><button type="button" data-d="1" data-k="${l.productId}|${l.variantId}" aria-label="More">+</button></span><button type="button" class="rm" data-rm="${l.productId}|${l.variantId}">Remove</button></div><div class="tot">${inr(l.linePaise)}</div></div>`).join('');
    sum.innerHTML = `<div><span>Subtotal</span><span>${inr(q.subtotalPaise)}</span></div><div><span>Delivery (fixture value)</span><span>${inr(q.deliveryPaise)}</span></div><div class="t"><span>Total</span><span>${inr(q.totalPaise)}</span></div>`;
  };
  lines.addEventListener('click', e => {
    const t = e.target; if (t.dataset.clear !== undefined) { set([]); return draw(); }
    const split = k => k.split('|');
    if (t.dataset.rm) { const [p, v] = split(t.dataset.rm); set(get().filter(x => !(x.productId === p && x.variantId === v))); draw(); }
    if (t.dataset.d) { const [p, v] = split(t.dataset.k); const c = get(); const l = c.find(x => x.productId === p && x.variantId === v); if (l) { l.quantity = Math.max(1, Math.min(10, l.quantity + Number(t.dataset.d))); set(c); draw(); } }
  });
  draw();
  let ck = localStorage.getItem('ad_cart_key'); if (!ck) { ck = 'k' + crypto.randomUUID().replace(/-/g, ''); localStorage.setItem('ad_cart_key', ck); }
  form.addEventListener('submit', async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(form)); res.className = 'res'; res.textContent = 'Checking with the server...';
    try {
      const j = await post('/order', { lines: get(), guest: { ...f, clientKey: ck } });
      if (j.ok) res.textContent = `Test order accepted. Server total ${inr(j.totalPaise)}${j.replay ? ' (same order as before)' : ''}. No payment was taken.`;
      else { res.className = 'res err'; res.textContent = `Cannot place order: ${j.code}${j.detail ? ' (' + j.detail + ')' : ''}`; }
    } catch { res.className = 'res err'; res.textContent = 'Order server not reachable.'; }
  });
}
