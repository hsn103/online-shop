(() => {
  const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s), I = window.__I || {}, L = window.__L || 'fa';
  const nf = new Intl.NumberFormat(L === 'fa' ? 'fa-IR' : 'en-US'), root = document.documentElement;
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  // ظاهر شدن نرم هنگام اسکرول
  try {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) els.forEach(e => e.classList.add('in'));
    else { const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -5% 0px' }); els.forEach(e => io.observe(e)); setTimeout(() => els.forEach(e => e.classList.add('in')), 3500); }
  } catch { $$('.reveal').forEach(e => e.classList.add('in')); }

  const nb = $('#navbtn'); nb?.addEventListener('click', () => { const o = document.body.classList.toggle('nav-open'); nb.setAttribute('aria-expanded', o); });
  let tt; const toast = (m, bad) => { const t = $('#toast'); t.textContent = m; t.className = bad ? 'bad' : ''; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 2600); };
  const setCount = n => { const c = $('#cartcount'); if (!c) return; c.textContent = nf.format(n); c.hidden = !n; };
  const post = async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(I[d.error] || I.e_generic || 'Error'); return d;
  };
  const err = el => e => { if (el) el.textContent = e.message; else toast(e.message, true); };

  // گالری
  $$('[data-thumb]').forEach(b => b.addEventListener('click', () => { $('#mainImg').src = b.dataset.thumb; $$('[data-thumb]').forEach(x => x.setAttribute('aria-current', x === b)); }));

  // انتخاب سایز و تعداد (صفحه محصول)
  let size = null, qty = 1, max = 10;
  const hint = $('#sizehint'), qv = $('#qtyv');
  $$('.size').forEach(b => b.addEventListener('click', () => {
    $$('.size').forEach(x => x.setAttribute('aria-pressed', x === b)); size = b.dataset.size; const st = +b.dataset.stock; max = Math.min(10, st);
    if (qty > max) { qty = max; qv.textContent = nf.format(qty); }
    hint.textContent = st <= 3 ? (I.low_stock || '').replace('{n}', nf.format(st)) : ''; hint.style.color = st <= 3 ? '#b91c1c' : '';
  }));
  const stepper = (box, get, set, limit) => box.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { const v = Math.max(1, Math.min(limit(), get() + +b.dataset.d)); set(v); }));
  const pq = $('[data-qty]:not([data-set])'); if (pq) stepper(pq, () => qty, v => { qty = v; qv.textContent = nf.format(v); }, () => max);
  $('#addbtn')?.addEventListener('click', async e => {
    if (!size) { toast(I.size_err, true); $$('.size').forEach(b => { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }); return; }
    e.target.disabled = true;
    try { const d = await post('/api/cart/add', { product_id: e.target.dataset.pid, size, qty }); setCount(d.count); toast('✓ ' + I.added); } catch (er) { toast(er.message, true); }
    e.target.disabled = false;
  });

  // صفحه سبد خرید
  $$('.cl').forEach(row => {
    const id = row.dataset.item, out = row.querySelector('output'), box = row.querySelector('[data-qty]'), lim = +box.dataset.max || 10;
    let cur = parseInt(String(out.textContent).replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) || 1;
    const send = async q => { try { await post('/api/cart/set', { item_id: id, qty: q }); location.reload(); } catch (e) { toast(e.message, true); } };
    box.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { const n = cur + +b.dataset.d; if (n < 1) return; if (n > lim) return toast(I.stock_err, true); send(n); }));
    row.querySelector('[data-rm]')?.addEventListener('click', () => send(0));
  });

  // تسویه حساب
  $('#coForm')?.addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, m = $('#msg'), btn = $('#placeBtn'); m.textContent = ''; btn.disabled = true;
    try { const d = await post('/api/checkout', { name: f.name.value, phone: f.phone.value, email: f.email.value, city: f.city.value, address: f.address.value, notes: f.notes.value, payment: f.payment.value, lang: L }); location.href = `/${d.lang}/order/${d.token}`; }
    catch (er) { m.textContent = er.message; btn.disabled = false; }
  });

  // ورود / ثبت‌نام / خروج
  $$('[data-auth]').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault(); const m = f.querySelector('.msg'); m.textContent = ''; const data = Object.fromEntries(new FormData(f));
    try { await post('/api/auth/' + f.dataset.auth, data); location.reload(); } catch (er) { m.textContent = er.message; }
  }));
  $('#logoutBtn')?.addEventListener('click', async () => { await post('/api/auth/logout'); location.href = `/${L}`; });

  // فیلترها
  $$('.filters select').forEach(s => s.addEventListener('change', () => s.form.submit()));
})();
