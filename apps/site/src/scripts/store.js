const root = document.querySelector('.store-collection');
if (root) {
  const filters = [...root.querySelectorAll('[data-store-filter]')];
  const cards = [...root.querySelectorAll('[data-store-category]')];
  const empty = root.querySelector('.collection-empty');
  const title = root.querySelector('[data-empty-title]');
  const heading = root.querySelector('[data-collection-title]');
  const copy = root.querySelector('[data-empty-copy]');
  function select(department) {
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.storeFilter === department)));
    cards.forEach(card => { card.hidden = department !== 'All' && card.dataset.storeCategory !== department; });
    const count = cards.filter(card => !card.hidden).length;
    empty.hidden = count > 0;
    title.textContent = department === 'All' ? 'Collection in the making.' : `${department}, in the making.`;
    if (heading) heading.textContent = department === 'All' ? 'All products' : department;
    copy.textContent = 'Products and details will appear here when they are ready. Nothing is available to order yet.';
  }
  empty.setAttribute('role', 'status');
  filters.forEach(button => button.addEventListener('click', () => select(button.dataset.storeFilter)));
  document.querySelectorAll('[data-department]').forEach(link => link.addEventListener('click', () => select(link.dataset.department)));
  root.querySelectorAll('[data-open-product]').forEach(button => button.addEventListener('click', () => {
    const dialog = document.getElementById(button.dataset.openProduct);
    if (dialog instanceof HTMLDialogElement) dialog.showModal();
  }));
  root.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close-product]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => {
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialog.close();
    });
  });
}
const statement = document.querySelector('.edition-statement');
if (statement && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  statement.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const rect = statement.getBoundingClientRect();
    statement.style.setProperty('--light-x', `${(e.clientX - rect.left) / rect.width * 100}%`);
    statement.style.setProperty('--light-y', `${(e.clientY - rect.top) / rect.height * 100}%`);
  });
  statement.addEventListener('pointerleave', () => {
    statement.style.removeProperty('--light-x');
    statement.style.removeProperty('--light-y');
  });
}
