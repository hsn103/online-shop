require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { LANGS, META, CATS, UI } = require('./i18n');
const SEED = require('./seed');

const { PORT = 3001, SESSION_SECRET, DEMO_MODE = '1', ALLOW_INDEX = '0' } = process.env;
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();
const SITE = (process.env.SITE_URL || 'https://shop.hxdev.ir').replace(/\/+$/, '');
if (!ADMIN_PASSWORD || !SESSION_SECRET) { console.error('ADMIN_PASSWORD و SESSION_SECRET را در .env تنظیم کنید'); process.exit(1); }
const BUILD = Date.now().toString(36), INDEXABLE = ALLOW_INDEX === '1';
const FREE_SHIP = 3000000, SHIP_FEE = 150000, MAX_QTY = 10;
const UPLOAD_DIR = path.join(__dirname, 'uploads'); fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Database ----------
const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, category TEXT NOT NULL, price INTEGER NOT NULL, old_price INTEGER NOT NULL DEFAULT 0,
  tone TEXT NOT NULL DEFAULT '#ece4d6', images TEXT NOT NULL DEFAULT '[]', sizes TEXT NOT NULL DEFAULT '[]', sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1, featured INTEGER NOT NULL DEFAULT 0, is_new INTEGER NOT NULL DEFAULT 0, i18n TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, pass TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS carts (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL UNIQUE, user_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS cart_items (id INTEGER PRIMARY KEY AUTOINCREMENT, cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL, qty INTEGER NOT NULL DEFAULT 1, UNIQUE(cart_id, product_id, size));
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL UNIQUE, user_id INTEGER, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL, address TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', payment TEXT NOT NULL, subtotal INTEGER NOT NULL, shipping INTEGER NOT NULL, total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', lang TEXT NOT NULL DEFAULT 'fa', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id INTEGER NOT NULL,
  title_fa TEXT NOT NULL, title_en TEXT NOT NULL, size TEXT NOT NULL, qty INTEGER NOT NULL, price INTEGER NOT NULL, image TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
if (!db.prepare("SELECT 1 FROM meta WHERE key='seeded'").get()) {
  const ins = db.prepare('INSERT INTO products (slug,category,price,old_price,tone,images,sizes,sort,featured,is_new,i18n) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  SEED.forEach((p, i) => ins.run(p.slug, p.cat, p.price, p.old, p.tone, JSON.stringify([`/demo/${p.slug}-1.png`, `/demo/${p.slug}-2.png`]), JSON.stringify(p.sizes), i, p.feat, p.isNew, JSON.stringify({ fa: p.fa, en: p.en })));
  db.prepare("INSERT INTO meta VALUES ('seeded','1')").run();
}

// ---------- Helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const int = (v, max = 1e9) => Math.min(max, Math.max(0, parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10) || 0));
const parse = (j, d) => { try { return JSON.parse(j) ?? d; } catch { return d; } };
const toEn = s => String(s ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const tt = lang => (k, v) => { let s = UI[lang]?.[k] ?? UI.fa[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.replace(`{${a}}`, b); return s; };
const fmt = (n, lang) => new Intl.NumberFormat(META[lang].locale).format(n);
const money = (n, lang) => `${fmt(n, lang)} ${tt(lang)('toman')}`;
const dateL = (s, lang) => new Date(String(s).replace(' ', 'T') + 'Z').toLocaleDateString(META[lang].locale, { year: 'numeric', month: 'long', day: 'numeric' });
const sizeLabel = (s, lang) => {
  const t = tt(lang); if (s === 'ONE') return t('one_size');
  const m = /^(\d+)-(\d+)Y$/.exec(s); if (m) return `${fmt(m[1], lang)}–${fmt(m[2], lang)} ${t('yrs')}`;
  return /^\d+$/.test(s) ? fmt(s, lang).replace(/[,٬]/g, '') : s;
};
const IMG_RE = /^\/(uploads\/[a-f0-9]{24}\.webp|demo\/[a-z0-9-]+\.png)$/;
const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const uniqueSlug = (base, id = 0) => { const s = slugify(base) || 'product'; let c = s, n = 2; while (db.prepare('SELECT 1 FROM products WHERE slug=? AND id!=?').get(c, id)) c = `${s}-${n++}`; return c; };

const prod = (r, lang) => {
  const tr = parse(r.i18n, {}), pick = k => tr[lang]?.[k] || tr.fa?.[k] || tr.en?.[k] || '';
  const sizes = parse(r.sizes, []), images = parse(r.images, []);
  return { id: r.id, slug: r.slug, category: r.category, price: r.price, old: r.old_price, tone: r.tone, images, sizes, active: !!r.active, isNew: !!r.is_new,
    title: pick('title'), description: pick('description'), details: pick('details'), stock: sizes.reduce((a, s) => a + s.stock, 0), created_at: r.created_at };
};
const activeProducts = lang => db.prepare('SELECT * FROM products WHERE active=1 ORDER BY sort, id').all().map(r => prod(r, lang));

// ---------- Auth (مشتری‌ها) ----------
const sign = v => crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('hex');
const hashPw = pw => { const salt = crypto.randomBytes(16); return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 64).toString('hex'); };
const checkPw = (pw, stored) => { const [s, h] = String(stored).split(':'); const b = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64); return crypto.timingSafeEqual(b, Buffer.from(h, 'hex')); };
const setUser = (req, res, id) => { const exp = Date.now() + 30 * 864e5, v = `${id}.${exp}`; res.cookie('u', `${v}.${sign(v)}`, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 30 * 864e5, path: '/' }); };
const userFrom = req => {
  const [id, exp, sig] = String(req.cookies.u || '').split('.');
  if (!id || !exp || !sig || Number(exp) < Date.now()) return null;
  const good = Buffer.from(sign(`${id}.${exp}`)), got = Buffer.from(sig);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return null;
  return db.prepare('SELECT id,name,email FROM users WHERE id=?').get(Number(id)) || null;
};

// ---------- سبد خرید (روی سرور؛ ادمین می‌بیند) ----------
const touch = id => db.prepare('UPDATE carts SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
function mergeCarts(fromId, toId) {
  for (const it of db.prepare('SELECT * FROM cart_items WHERE cart_id=?').all(fromId)) {
    const ex = db.prepare('SELECT * FROM cart_items WHERE cart_id=? AND product_id=? AND size=?').get(toId, it.product_id, it.size);
    if (ex) db.prepare('UPDATE cart_items SET qty=? WHERE id=?').run(Math.min(MAX_QTY, ex.qty + it.qty), ex.id);
    else db.prepare('INSERT INTO cart_items (cart_id,product_id,size,qty) VALUES (?,?,?,?)').run(toId, it.product_id, it.size, it.qty);
  }
  db.prepare('DELETE FROM carts WHERE id=?').run(fromId); touch(toId);
}
function cartOf(req, res, create = false) {
  const user = req.user, tok = req.cookies.cart;
  let cart = tok ? db.prepare('SELECT * FROM carts WHERE token=?').get(tok) : null;
  if (user) {
    const own = db.prepare('SELECT * FROM carts WHERE user_id=? ORDER BY id LIMIT 1').get(user.id);
    if (own && cart && cart.id !== own.id && !cart.user_id) { mergeCarts(cart.id, own.id); cart = own; }
    else if (own) cart = cart && cart.user_id === user.id ? cart : own;
    else if (cart && !cart.user_id) { db.prepare('UPDATE carts SET user_id=? WHERE id=?').run(user.id, cart.id); cart.user_id = user.id; }
    else if (cart && cart.user_id !== user.id) cart = null;
  } else if (cart && cart.user_id) cart = null;
  if (!cart && create) {
    const t = crypto.randomBytes(16).toString('hex'), r = db.prepare('INSERT INTO carts (token,user_id) VALUES (?,?)').run(t, user?.id || null);
    cart = { id: r.lastInsertRowid, token: t, user_id: user?.id || null };
  }
  if (cart && res && cart.token !== tok) res.cookie('cart', cart.token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 30 * 864e5, path: '/' });
  return cart;
}
function cartLines(cartId, lang) {
  const rows = db.prepare('SELECT ci.id item_id, ci.size ci_size, ci.qty ci_qty, p.* FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.cart_id=? ORDER BY ci.id').all(cartId);
  const lines = rows.map(r => { const p = prod(r, lang), stock = p.sizes.find(s => s.size === r.ci_size)?.stock || 0;
    return { item_id: r.item_id, size: r.ci_size, qty: r.ci_qty, stock, p, line: p.price * r.ci_qty, ok: p.active && stock >= r.ci_qty }; });
  const subtotal = lines.reduce((a, l) => a + l.line, 0), shipping = subtotal === 0 || subtotal >= FREE_SHIP ? 0 : SHIP_FEE;
  return { lines, subtotal, shipping, total: subtotal + shipping, count: lines.reduce((a, l) => a + l.qty, 0) };
}
const cartCount = req => { const c = cartOf(req, null); return c ? db.prepare('SELECT COALESCE(SUM(qty),0) n FROM cart_items WHERE cart_id=?').get(c.id).n : 0; };

// ---------- HTML ----------
const FAV = `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%2315120f'/><text x='50' y='68' font-size='56' text-anchor='middle' fill='%23f1ece4' font-family='serif' font-weight='700'>N</text></svg>">`;
function seoTags(lang, o) {
  const url = SITE + '/' + lang + o.path; let h = `<title>${esc(o.title)}</title>\n<meta name="description" content="${esc(o.description || '')}">\n`;
  h += `<meta name="robots" content="${INDEXABLE && !o.noindex ? 'index,follow,max-image-preview:large' : 'noindex,nofollow'}">\n<link rel="canonical" href="${esc(url)}">\n`;
  if (!o.noalt) { for (const l of LANGS) h += `<link rel="alternate" hreflang="${l}" href="${esc(SITE + '/' + l + o.path)}">\n`; h += `<link rel="alternate" hreflang="x-default" href="${esc(SITE + '/fa' + o.path)}">\n`; }
  h += `<meta property="og:type" content="${o.type || 'website'}"><meta property="og:locale" content="${META[lang].og}"><meta property="og:site_name" content="${esc(tt(lang)('brand'))}"><meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.description || '')}"><meta property="og:url" content="${esc(url)}">\n`;
  if (o.image) h += `<meta property="og:image" content="${esc(SITE + o.image)}">\n`;
  if (o.jsonld) h += `<script type="application/ld+json">${JSON.stringify(o.jsonld).replace(/</g, '\\u003c')}</script>\n`;
  return h;
}
const ICON = {
  cart: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2.2l2 11h10.4l2-8H6.4"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>'
};
function layout(req, lang, o, body, scripts = '') {
  const t = tt(lang), other = lang === 'fa' ? 'en' : 'fa', n = cartCount(req), p = o.langPath ?? o.path;
  const I = JSON.stringify(Object.fromEntries(['added', 'size_err', 'e_generic', 'stock_err', 'e_required', 'e_phone', 'e_login', 'e_exists', 'e_weak', 'e_email', 'e_empty', 'low_stock'].map(k => [k, t(k)]))).replace(/</g, '\\u003c');
  const nav = Object.entries(CATS).map(([k, v]) => `<a href="/${lang}/shop?cat=${k}">${v[lang]}</a>`).join('');
  return `<!DOCTYPE html>\n<html lang="${lang}" dir="${META[lang].dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${seoTags(lang, o)}${FAV}<link rel="preload" href="/fonts/${lang === 'fa' ? 'vazirmatn-arabic' : 'manrope-latin'}-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css?v=${BUILD}"><script>document.documentElement.classList.add('js')</script></head><body>
<a class="skip" href="#main">${t('skip')}</a>
${DEMO_MODE === '1' ? `<div class="announce"><span>${t('demo_note')}</span><span class="sep">•</span><span>${t('ship_note', { n: money(FREE_SHIP, lang) })}</span></div>` : ''}
<header class="hdr"><div class="wrap hdr-in">
  <button class="ibtn burger" id="navbtn" type="button" aria-label="${t('menu')}" aria-expanded="false" aria-controls="mainnav"><span></span></button>
  <a class="logo" href="/${lang}">${t('brand')}<i></i></a>
  <nav class="mainnav" id="mainnav" aria-label="${t('menu')}"><a href="/${lang}/shop">${t('shop')}</a>${nav}</nav>
  <div class="hdr-act">
    <form class="srch" action="/${lang}/shop" method="get" role="search"><input type="search" name="q" placeholder="${t('search_ph')}" aria-label="${t('search')}" value="${esc(o.q || '')}"><button aria-label="${t('search')}">${ICON.search}</button></form>
    <a class="ibtn lang" href="/${other}${p}" hreflang="${other}" lang="${other}">${t('lang')}</a>
    <a class="ibtn" href="/${lang}/account" aria-label="${t('account')}">${ICON.user}</a>
    <a class="ibtn cartbtn" href="/${lang}/cart" aria-label="${t('cart')}">${ICON.cart}<b class="badge" id="cartcount"${n ? '' : ' hidden'}>${fmt(n, lang)}</b></a>
  </div></div></header>
${body}
<footer class="ftr"><div class="wrap ftr-in"><div><a class="logo" href="/${lang}">${t('brand')}<i></i></a><p class="muted">${t('f_about_d')}</p></div>
<div><h4>${t('shop')}</h4><ul>${Object.entries(CATS).map(([k, v]) => `<li><a href="/${lang}/shop?cat=${k}">${v[lang]}</a></li>`).join('')}</ul></div>
<div><h4>${t('f_help')}</h4><ul><li><a href="/${lang}/cart">${t('cart')}</a></li><li><a href="/${lang}/account">${t('account')}</a></li><li><a href="/${other}${p}">${META[other].name}</a></li></ul></div></div>
<div class="wrap ftr-copy">© <span id="year"></span> ${t('brand')} · ${t('f_rights')}${DEMO_MODE === '1' ? ` · ${t('f_demo')}` : ''}</div></footer>
<div id="toast" role="status" aria-live="polite" hidden></div>
<script>window.__I=${I};window.__L="${lang}"</script>${scripts}<script src="/app.js?v=${BUILD}"></script></body></html>`;
}
const notFound = (req, res, lang) => { const t = tt(lang); res.status(404).type('html').send(layout(req, lang, { title: t('nf_h'), path: '/', noindex: true, noalt: true }, `<main id="main" class="wrap page center"><h1>${t('nf_h')}</h1><p><a class="btn dark" href="/${lang}">${t('back_home')}</a></p></main>`)); };

const pUrl = (lang, p) => `/${lang}/p/${encodeURIComponent(p.slug)}`;
const noImg = '<span class="noimg" aria-hidden="true">N</span>';
const pcard = (p, lang) => {
  const t = tt(lang), off = p.old > p.price ? Math.round((1 - p.price / p.old) * 100) : 0;
  const badges = `${p.stock === 0 ? `<span class="tag out">${t('out_of_stock')}</span>` : ''}${off ? `<span class="tag sale">${t('off', { n: fmt(off, lang) })}</span>` : ''}${p.isNew && !off && p.stock ? `<span class="tag new">${t('new_badge')}</span>` : ''}`;
  return `<article class="pc reveal" style="--tone:${esc(p.tone)}"><a class="pc-img" href="${pUrl(lang, p)}" tabindex="-1" aria-hidden="true">${badges}
    ${p.images[0] ? `<img class="i1" src="${esc(p.images[0])}" alt="${esc(p.title)}" loading="lazy" width="450" height="570">${p.images[1] ? `<img class="i2" src="${esc(p.images[1])}" alt="" loading="lazy" width="450" height="570">` : ''}` : noImg}</a>
    <div class="pc-b"><span class="pc-cat">${CATS[p.category]?.[lang] || ''}</span><h3><a href="${pUrl(lang, p)}">${esc(p.title)}</a></h3>
    <div class="price"><b>${money(p.price, lang)}</b>${p.old > p.price ? `<s>${fmt(p.old, lang)}</s>` : ''}</div>
    <div class="pc-sizes" aria-label="${t('sizes_h')}">${p.sizes.slice(0, 6).map(s => `<span${s.stock ? '' : ' class="x"'}>${sizeLabel(s.size, lang)}</span>`).join('')}</div></div></article>`;
};

// ---------- App ----------
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin' });
  if (!INDEXABLE) res.set('X-Robots-Tag', 'noindex, nofollow');
  req.user = userFrom(req); next();
});
app.get('/', (req, res) => res.redirect(302, '/fa'));
const L = '/:lang(fa|en)';

// خانه
app.get(L, (req, res) => {
  const lang = req.params.lang, t = tt(lang), all = activeProducts(lang);
  const feat = all.filter(p => p.images[0]).sort((a, b) => 0).filter((p, i, a) => ['classic-tee', 'floral-dress', 'wool-coat'].includes(p.slug)).slice(0, 3);
  const hero = (feat.length ? feat : all.slice(0, 3));
  const fresh = [...all].sort((a, b) => b.isNew - a.isNew || b.id - a.id).slice(0, 8);
  const cats = Object.entries(CATS).map(([k, v]) => { const p = all.find(x => x.category === k && x.images[0]); return `<a class="cat reveal" href="/${lang}/shop?cat=${k}" style="--tone:${p ? esc(p.tone) : '#ece4d6'}">${p ? `<img src="${esc(p.images[0])}" alt="" loading="lazy" width="300" height="380">` : ''}<span>${v[lang]}</span></a>`; }).join('');
  const sale = all.filter(p => p.old > p.price && p.images[0]).slice(0, 2);
  const body = `<main id="main">
  <section class="hero"><div class="wrap hero-in"><div class="hero-t"><span class="kicker">${t('hero_kicker')}</span><h1>${t('hero_title')}</h1><p>${t('hero_sub')}</p>
    <div class="cta"><a class="btn dark" href="/${lang}/shop">${t('hero_cta')}</a><a class="btn line" href="/${lang}/shop?sort=new">${t('hero_cta2')}</a></div></div>
    <div class="hero-art" aria-hidden="true">${hero.map((p, i) => `<a class="hp hp${i + 1}" href="${pUrl(lang, p)}" style="--tone:${esc(p.tone)}" tabindex="-1"><img src="${esc(p.images[0])}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} width="450" height="570"></a>`).join('')}</div></div></section>
  <section class="section"><div class="wrap"><div class="shead"><h2>${t('cats_h')}</h2></div><div class="cats">${cats}</div></div></section>
  <section class="section alt"><div class="wrap"><div class="shead"><div><h2>${t('new_h')}</h2><p class="muted">${t('new_sub')}</p></div><a class="more" href="/${lang}/shop?sort=new">${t('view_all')} →</a></div><div class="grid">${fresh.map(p => pcard(p, lang)).join('')}</div></div></section>
  ${sale.length ? `<section class="wrap"><div class="promo reveal"><div class="promo-t"><span class="kicker light">${t('promo_k')}</span><h2>${t('promo_h')}</h2><p>${t('promo_sub')}</p><a class="btn light" href="/${lang}/shop?sale=1">${t('promo_cta')}</a></div>
    <div class="promo-art">${sale.map(p => `<a href="${pUrl(lang, p)}" style="--tone:${esc(p.tone)}" tabindex="-1" aria-hidden="true"><img src="${esc(p.images[0])}" alt="" loading="lazy" width="450" height="570"></a>`).join('')}</div></div></section>` : ''}
  <section class="section"><div class="wrap feats">${[1, 2, 3, 4].map(i => `<div class="feat reveal"><b>${t('f' + i + '_t')}</b><span class="muted">${t('f' + i + '_d')}</span></div>`).join('')}</div></section></main>`;
  res.type('html').send(layout(req, lang, { title: `${t('brand')} | ${t('hero_title')}`, description: t('hero_sub'), path: '',
    jsonld: { '@context': 'https://schema.org', '@type': 'Store', name: t('brand'), url: SITE + '/' + lang } }, body));
});

// فروشگاه (فیلتر و مرتب‌سازی)
app.get(L + '/shop', (req, res) => {
  const lang = req.params.lang, t = tt(lang), q = str(req.query.q, 60), cat = CATS[req.query.cat] ? req.query.cat : '', size = str(req.query.size, 10), sort = ['new', 'price_asc', 'price_desc'].includes(req.query.sort) ? req.query.sort : 'new', sale = req.query.sale === '1';
  let list = activeProducts(lang); const everySize = [...new Set(list.flatMap(p => p.sizes.map(s => s.size)))];
  const ql = q.toLowerCase();
  if (cat) list = list.filter(p => p.category === cat);
  if (sale) list = list.filter(p => p.old > p.price);
  if (size) list = list.filter(p => p.sizes.some(s => s.size === size && s.stock > 0));
  if (q) list = list.filter(p => `${p.title} ${p.description}`.toLowerCase().includes(ql));
  list.sort((a, b) => sort === 'price_asc' ? a.price - b.price : sort === 'price_desc' ? b.price - a.price : b.isNew - a.isNew || b.id - a.id);
  const href = (o = {}) => { const p = new URLSearchParams(); const m = { cat, size, sort: sort === 'new' ? '' : sort, q, sale: sale ? '1' : '', ...o }; for (const [k, v] of Object.entries(m)) if (v) p.set(k, v); const s = p.toString(); return `/${lang}/shop${s ? '?' + s : ''}`; };
  const body = `<main id="main" class="wrap page"><div class="shead"><div><h1>${cat ? CATS[cat][lang] : sale ? t('sale') : t('shop_h')}</h1><p class="muted">${t('results', { n: fmt(list.length, lang) })}</p></div></div>
  <div class="chips"><a class="chip" href="${href({ cat: '' })}" aria-current="${!cat}">${t('all')}</a>${Object.entries(CATS).map(([k, v]) => `<a class="chip" href="${href({ cat: k })}" aria-current="${cat === k}">${v[lang]}</a>`).join('')}</div>
  <form class="filters" method="get" action="/${lang}/shop">${cat ? `<input type="hidden" name="cat" value="${cat}">` : ''}${sale ? '<input type="hidden" name="sale" value="1">' : ''}
    <label>${t('sort')}<select name="sort"><option value="new"${sort === 'new' ? ' selected' : ''}>${t('sort_new')}</option><option value="price_asc"${sort === 'price_asc' ? ' selected' : ''}>${t('sort_price_asc')}</option><option value="price_desc"${sort === 'price_desc' ? ' selected' : ''}>${t('sort_price_desc')}</option></select></label>
    <label>${t('filter_size')}<select name="size"><option value="">${t('all')}</option>${everySize.map(s => `<option value="${esc(s)}"${size === s ? ' selected' : ''}>${sizeLabel(s, lang)}</option>`).join('')}</select></label>
    <label>${t('search')}<input type="search" name="q" value="${esc(q)}" placeholder="${t('search_ph')}"></label><button class="btn dark sm">${t('search')}</button>${cat || size || q || sale ? `<a class="more" href="/${lang}/shop">${t('clear')}</a>` : ''}</form>
  ${list.length ? `<div class="grid">${list.map(p => pcard(p, lang)).join('')}</div>` : `<p class="empty">${t('no_results')}</p>`}</main>`;
  res.type('html').send(layout(req, lang, { title: `${cat ? CATS[cat][lang] : t('shop_h')} | ${t('brand')}`, description: t('hero_sub'), path: '/shop' + (cat ? '?cat=' + cat : ''), q, noindex: !!(q || size || sale) }, body));
});

// صفحه محصول
app.get(L + '/p/:slug', (req, res) => {
  const lang = req.params.lang, t = tt(lang), row = db.prepare('SELECT * FROM products WHERE slug=? AND active=1').get(req.params.slug);
  if (!row) return notFound(req, res, lang);
  const p = prod(row, lang), off = p.old > p.price ? Math.round((1 - p.price / p.old) * 100) : 0;
  const rel = activeProducts(lang).filter(x => x.id !== p.id && x.category === p.category).concat(activeProducts(lang).filter(x => x.id !== p.id && x.category !== p.category)).slice(0, 4);
  const body = `<main id="main" class="wrap page"><nav class="crumbs" aria-label="Breadcrumb"><a href="/${lang}">${t('home')}</a><span>/</span><a href="/${lang}/shop?cat=${p.category}">${CATS[p.category][lang]}</a><span>/</span><span>${esc(p.title)}</span></nav>
  <div class="pd"><div class="gal" style="--tone:${esc(p.tone)}"><div class="gal-main">${p.images[0] ? `<img id="mainImg" src="${esc(p.images[0])}" alt="${esc(p.title)}" width="900" height="1140" fetchpriority="high">` : noImg}</div>
    ${p.images.length > 1 ? `<div class="gal-th">${p.images.map((u, i) => `<button type="button" data-thumb="${esc(u)}" aria-current="${i === 0}" aria-label="${i + 1}"><img src="${esc(u)}" alt="" loading="lazy" width="90" height="114"></button>`).join('')}</div>` : ''}</div>
  <div class="pd-i"><span class="pc-cat">${CATS[p.category][lang]}</span><h1>${esc(p.title)}</h1>
    <div class="price lg"><b>${money(p.price, lang)}</b>${p.old > p.price ? `<s>${fmt(p.old, lang)}</s><span class="tag sale">${t('off', { n: fmt(off, lang) })}</span>` : ''}</div>
    <p class="lead">${esc(p.description)}</p>
    <div class="sizes" role="group" aria-label="${t('sizes_h')}" id="sizes"><div class="lbl"><b>${t('sizes_h')}</b><span id="sizehint" class="muted">${t('choose_size')}</span></div>
      <div class="size-row">${p.sizes.map(s => `<button type="button" class="size" data-size="${esc(s.size)}" data-stock="${s.stock}" aria-pressed="false"${s.stock ? '' : ' disabled'}>${sizeLabel(s.size, lang)}</button>`).join('')}</div></div>
    <div class="buy"><div class="qty" data-qty><button type="button" data-d="-1" aria-label="-">−</button><output id="qtyv">1</output><button type="button" data-d="1" aria-label="+">+</button></div>
      <button class="btn dark grow" type="button" id="addbtn" data-pid="${p.id}"${p.stock ? '' : ' disabled'}>${p.stock ? t('add_to_cart') : t('out_of_stock')}</button></div>
    <details class="acc" open><summary>${t('details_h')}</summary><ul>${p.details.split('\n').filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details></div></div>
  ${rel.length ? `<section class="section tight"><div class="shead"><h2>${t('related')}</h2></div><div class="grid">${rel.map(x => pcard(x, lang)).join('')}</div></section>` : ''}</main>`;
  res.type('html').send(layout(req, lang, { title: `${p.title} | ${t('brand')}`, description: p.description, path: '/p/' + encodeURIComponent(p.slug), image: p.images[0], type: 'product',
    jsonld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'Product', name: p.title, description: p.description, sku: p.slug, image: p.images.map(u => SITE + u), brand: { '@type': 'Brand', name: t('brand') },
      offers: { '@type': 'Offer', priceCurrency: 'IRR', price: String(p.price * 10), availability: p.stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: SITE + '/' + lang + '/p/' + encodeURIComponent(p.slug) } },
      { '@type': 'BreadcrumbList', itemListElement: [[t('home'), '/' + lang], [CATS[p.category][lang], `/${lang}/shop?cat=${p.category}`], [p.title, `/${lang}/p/${encodeURIComponent(p.slug)}`]].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE + c[1] })) }] } }, body));
});

// سبد خرید
app.get(L + '/cart', (req, res) => {
  const lang = req.params.lang, t = tt(lang), cart = cartOf(req, res), c = cart ? cartLines(cart.id, lang) : { lines: [], subtotal: 0, shipping: 0, total: 0, count: 0 };
  const left = FREE_SHIP - c.subtotal;
  const rows = c.lines.map(l => `<div class="cl" data-item="${l.item_id}"><a class="cl-img" href="${pUrl(lang, l.p)}" style="--tone:${esc(l.p.tone)}">${l.p.images[0] ? `<img src="${esc(l.p.images[0])}" alt="" width="90" height="114">` : noImg}</a>
    <div class="cl-b"><a class="cl-t" href="${pUrl(lang, l.p)}">${esc(l.p.title)}</a><span class="muted">${t('size')}: ${sizeLabel(l.size, lang)}</span>${l.ok ? '' : `<span class="err">${l.stock ? t('low_stock', { n: fmt(l.stock, lang) }) : t('out_of_stock')}</span>`}
      <div class="qty sm" data-qty data-set data-max="${Math.min(MAX_QTY, l.stock)}"><button type="button" data-d="-1" aria-label="-">−</button><output>${fmt(l.qty, lang)}</output><button type="button" data-d="1" aria-label="+">+</button></div></div>
    <div class="cl-p"><b>${money(l.line, lang)}</b><button class="rm" type="button" data-rm>${t('remove')}</button></div></div>`).join('');
  const body = `<main id="main" class="wrap page"><h1>${t('cart_h')}</h1>${c.lines.length ? `<div class="cart-grid"><div class="cl-list">${rows}</div>
    <aside class="sum"><h2 class="h3">${t('summary')}</h2><dl><dt>${t('subtotal')}</dt><dd>${money(c.subtotal, lang)}</dd><dt>${t('shipping')}</dt><dd>${c.shipping ? money(c.shipping, lang) : t('free')}</dd><dt class="tot">${t('total')}</dt><dd class="tot">${money(c.total, lang)}</dd></dl>
      <p class="muted small">${left > 0 ? t('free_ship_left', { n: money(left, lang) }) : t('free_ship_ok')}</p>
      <div class="bar"><i style="width:${Math.min(100, Math.round(c.subtotal / FREE_SHIP * 100))}%"></i></div>
      <a class="btn dark block" href="/${lang}/checkout">${t('checkout')}</a><a class="more center" href="/${lang}/shop">${t('continue')}</a></aside></div>`
    : `<p class="empty">${t('empty_cart')}</p><p><a class="btn dark" href="/${lang}/shop">${t('continue')}</a></p>`}</main>`;
  res.set('Cache-Control', 'no-store').type('html').send(layout(req, lang, { title: `${t('cart_h')} | ${t('brand')}`, path: '/cart', noindex: true }, body));
});

// تسویه حساب
app.get(L + '/checkout', (req, res) => {
  const lang = req.params.lang, t = tt(lang), cart = cartOf(req, res), c = cart ? cartLines(cart.id, lang) : null;
  if (!c || !c.lines.length) return res.redirect(302, `/${lang}/cart`);
  const u = req.user || {};
  const body = `<main id="main" class="wrap page"><h1>${t('checkout_h')}</h1><div class="cart-grid">
  <form id="coForm" class="form" novalidate>
    <label>${t('full_name')} *<input name="name" required maxlength="80" autocomplete="name" value="${esc(u.name || '')}"></label>
    <div class="two"><label>${t('phone')} *<input name="phone" required inputmode="tel" dir="ltr" autocomplete="tel" placeholder="09123456789"></label><label>${t('email')}<input name="email" type="email" dir="ltr" autocomplete="email" value="${esc(u.email || '')}"></label></div>
    <label>${t('city')} *<input name="city" required maxlength="60" autocomplete="address-level2"></label>
    <label>${t('address')} *<textarea name="address" rows="3" required maxlength="400" autocomplete="street-address"></textarea></label>
    <label>${t('notes')}<textarea name="notes" rows="2" maxlength="300"></textarea></label>
    <fieldset class="pay"><legend>${t('payment')}</legend><label class="opt"><input type="radio" name="payment" value="cod" checked><span>${t('pay_cod')}</span></label><label class="opt"><input type="radio" name="payment" value="card"><span>${t('pay_card')}</span></label><p class="muted small">${t('demo_pay')}</p></fieldset>
    <p class="msg" id="msg" role="alert"></p><button class="btn dark block" id="placeBtn">${t('place_order')}</button></form>
  <aside class="sum"><h2 class="h3">${t('summary')}</h2>${c.lines.map(l => `<div class="mini"><span>${esc(l.p.title)} <small class="muted">· ${sizeLabel(l.size, lang)} × ${fmt(l.qty, lang)}</small></span><b>${money(l.line, lang)}</b></div>`).join('')}
    <dl><dt>${t('subtotal')}</dt><dd>${money(c.subtotal, lang)}</dd><dt>${t('shipping')}</dt><dd>${c.shipping ? money(c.shipping, lang) : t('free')}</dd><dt class="tot">${t('total')}</dt><dd class="tot">${money(c.total, lang)}</dd></dl></aside></div></main>`;
  res.set('Cache-Control', 'no-store').type('html').send(layout(req, lang, { title: `${t('checkout_h')} | ${t('brand')}`, path: '/checkout', noindex: true }, body));
});

// سفارش
const orderView = (lang, o) => {
  const t = tt(lang), items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id);
  return `<div class="ord"><div class="ord-h"><div><b>${t('order_no')} #${fmt(o.id, lang)}</b><span class="muted"> · ${dateL(o.created_at, lang)}</span></div><span class="st st-${o.status}">${t('s_' + o.status)}</span></div>
  ${items.map(i => `<div class="mini"><span>${esc(lang === 'fa' ? i.title_fa : i.title_en)} <small class="muted">· ${sizeLabel(i.size, lang)} × ${fmt(i.qty, lang)}</small></span><b>${money(i.price * i.qty, lang)}</b></div>`).join('')}
  <dl><dt>${t('shipping')}</dt><dd>${o.shipping ? money(o.shipping, lang) : t('free')}</dd><dt class="tot">${t('total')}</dt><dd class="tot">${money(o.total, lang)}</dd></dl></div>`;
};
app.get(L + '/order/:token', (req, res) => {
  const lang = req.params.lang, t = tt(lang), o = db.prepare('SELECT * FROM orders WHERE token=?').get(req.params.token);
  if (!o) return notFound(req, res, lang);
  const body = `<main id="main" class="wrap page narrow"><div class="thanks"><div class="check" aria-hidden="true">✓</div><h1>${t('thanks_h')}</h1><p class="muted">${t('thanks_p')}</p></div>${orderView(lang, o)}
    <p class="muted small">${t('ship_to')}: ${esc(o.name)} · ${esc(o.city)}، ${esc(o.address)}</p><p><a class="btn dark" href="/${lang}/shop">${t('continue_shop')}</a></p></main>`;
  res.set('Cache-Control', 'no-store').type('html').send(layout(req, lang, { title: `${t('thanks_h')} | ${t('brand')}`, path: '/order/' + o.token, noindex: true, noalt: true }, body));
});

// حساب کاربری
app.get(L + '/account', (req, res) => {
  const lang = req.params.lang, t = tt(lang), u = req.user; let inner;
  if (u) {
    const orders = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 50').all(u.id);
    inner = `<div class="acc-h"><h1>${t('hello', { n: esc(u.name) })}</h1><button class="btn line sm" id="logoutBtn" type="button">${t('logout')}</button></div><h2 class="h3">${t('my_orders')}</h2>${orders.length ? orders.map(o => orderView(lang, o)).join('') : `<p class="empty">${t('no_orders')}</p>`}`;
  } else {
    inner = `<div class="auth"><form class="form auth-f" data-auth="login" novalidate><h2>${t('login_h')}</h2><label>${t('email')}<input name="email" type="email" required dir="ltr" autocomplete="email"></label><label>${t('pass')}<input name="password" type="password" required autocomplete="current-password"></label><p class="msg" role="alert"></p><button class="btn dark block">${t('login')}</button></form>
    <form class="form auth-f" data-auth="register" novalidate><h2>${t('register_h')}</h2><label>${t('name')}<input name="name" required maxlength="80" autocomplete="name"></label><label>${t('email')}<input name="email" type="email" required dir="ltr" autocomplete="email"></label><label>${t('pass')}<input name="password" type="password" required minlength="8" autocomplete="new-password"><small class="muted">${t('pass_hint')}</small></label><p class="msg" role="alert"></p><button class="btn line block">${t('register')}</button></form></div>`;
  }
  res.set('Cache-Control', 'no-store').type('html').send(layout(req, lang, { title: `${t('account')} | ${t('brand')}`, path: '/account', noindex: true }, `<main id="main" class="wrap page">${inner}</main>`));
});

app.get('/sitemap.xml', (req, res) => {
  const paths = ['', '/shop', ...db.prepare('SELECT slug FROM products WHERE active=1').all().map(r => '/p/' + encodeURIComponent(r.slug))];
  const alt = p => LANGS.map(l => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(SITE + '/' + l + p)}"/>`).join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(SITE + '/fa' + p)}"/>`;
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${paths.flatMap(p => LANGS.map(l => `<url><loc>${esc(SITE + '/' + l + p)}</loc>${alt(p)}</url>`)).join('\n')}\n</urlset>`);
});
app.get('/robots.txt', (req, res) => res.type('text/plain').send(INDEXABLE ? `User-agent: *\nDisallow: /admin\nDisallow: /api/\n${LANGS.map(l => `Disallow: /${l}/cart\nDisallow: /${l}/checkout\nDisallow: /${l}/account\nDisallow: /${l}/order/`).join('\n')}\nSitemap: ${SITE}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n'));

app.use('/fonts', express.static(path.join(__dirname, 'public', 'fonts'), { maxAge: '365d', immutable: true, index: false }));
app.use('/demo', express.static(path.join(__dirname, 'public', 'demo'), { maxAge: '7d', index: false }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', index: false, dotfiles: 'deny' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], index: false }));

// ---------- API فروشگاه ----------
const limiter = (min, max) => rateLimit({ windowMs: min * 60 * 1000, max, standardHeaders: true });
const authLimiter = limiter(15, 30), cartLimiter = limiter(10, 300), orderLimiter = limiter(60, 30);
const cartJson = (req, res, cart) => { const c = cart ? cartLines(cart.id, 'fa') : { count: 0 }; res.json({ ok: true, count: c.count }); };

app.post('/api/cart/add', cartLimiter, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(int(req.body?.product_id)), size = str(req.body?.size, 10), qty = Math.max(1, int(req.body?.qty, MAX_QTY));
  const stock = p ? parse(p.sizes, []).find(s => s.size === size)?.stock : 0;
  if (!p || !stock) return res.status(400).json({ error: 'stock_err' });
  const cart = cartOf(req, res, true), ex = db.prepare('SELECT * FROM cart_items WHERE cart_id=? AND product_id=? AND size=?').get(cart.id, p.id, size), want = Math.min(MAX_QTY, (ex?.qty || 0) + qty);
  if (want > stock) return res.status(400).json({ error: 'stock_err' });
  if (ex) db.prepare('UPDATE cart_items SET qty=? WHERE id=?').run(want, ex.id); else db.prepare('INSERT INTO cart_items (cart_id,product_id,size,qty) VALUES (?,?,?,?)').run(cart.id, p.id, size, want);
  touch(cart.id); cartJson(req, res, cart);
});
app.post('/api/cart/set', cartLimiter, (req, res) => {
  const cart = cartOf(req, res); if (!cart) return res.status(400).json({ error: 'e_generic' });
  const it = db.prepare('SELECT ci.*, p.sizes FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.id=? AND ci.cart_id=?').get(int(req.body?.item_id), cart.id);
  if (!it) return res.status(404).json({ error: 'e_generic' });
  const qty = int(req.body?.qty, MAX_QTY), stock = parse(it.sizes, []).find(s => s.size === it.size)?.stock || 0;
  if (qty === 0) db.prepare('DELETE FROM cart_items WHERE id=?').run(it.id);
  else if (qty > stock) return res.status(400).json({ error: 'stock_err' });
  else db.prepare('UPDATE cart_items SET qty=? WHERE id=?').run(qty, it.id);
  touch(cart.id); cartJson(req, res, cart);
});

const validPhone = p => /^\+?\d{9,15}$/.test(p);
app.post('/api/checkout', orderLimiter, (req, res) => {
  const b = req.body || {}, cart = cartOf(req, res); if (!cart) return res.status(400).json({ error: 'e_empty' });
  const name = str(b.name, 80), phone = toEn(str(b.phone, 20)).replace(/[\s-]/g, ''), email = str(b.email, 120), city = str(b.city, 60), address = str(b.address, 400);
  if (name.length < 2 || !city || address.length < 6) return res.status(400).json({ error: 'e_required' });
  if (!validPhone(phone)) return res.status(400).json({ error: 'e_phone' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'e_email' });
  const payment = b.payment === 'card' ? 'card' : 'cod', lang = LANGS.includes(b.lang) ? b.lang : 'fa';
  try {
    const token = db.transaction(() => {
      const c = cartLines(cart.id, 'fa'); if (!c.lines.length) throw new Error('e_empty');
      for (const l of c.lines) if (!l.ok) throw new Error('stock_err');
      const r = db.prepare(`INSERT INTO orders (token,user_id,name,phone,email,city,address,notes,payment,subtotal,shipping,total,lang) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(crypto.randomBytes(12).toString('hex'), req.user?.id || null, name, phone, email, city, address, str(b.notes, 300), payment, c.subtotal, c.shipping, c.total, lang);
      for (const l of c.lines) {
        const row = db.prepare('SELECT * FROM products WHERE id=?').get(l.p.id), tr = parse(row.i18n, {}), sizes = parse(row.sizes, []);
        sizes.find(s => s.size === l.size).stock -= l.qty;
        db.prepare('UPDATE products SET sizes=? WHERE id=?').run(JSON.stringify(sizes), l.p.id);
        db.prepare('INSERT INTO order_items (order_id,product_id,title_fa,title_en,size,qty,price,image) VALUES (?,?,?,?,?,?,?,?)')
          .run(r.lastInsertRowid, l.p.id, tr.fa?.title || '', tr.en?.title || tr.fa?.title || '', l.size, l.qty, l.p.price, parse(row.images, [])[0] || '');
      }
      db.prepare('DELETE FROM cart_items WHERE cart_id=?').run(cart.id); touch(cart.id);
      return db.prepare('SELECT token FROM orders WHERE id=?').get(r.lastInsertRowid).token;
    })();
    res.json({ ok: true, token, lang });
  } catch (e) { res.status(400).json({ error: ['stock_err', 'e_empty'].includes(e.message) ? e.message : 'e_generic' }); }
});

app.post('/api/auth/register', authLimiter, (req, res) => {
  const name = str(req.body?.name, 80), email = str(req.body?.email, 120).toLowerCase(), pw = String(req.body?.password ?? '');
  if (name.length < 2) return res.status(400).json({ error: 'e_required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'e_email' });
  if (pw.length < 8 || pw.length > 200) return res.status(400).json({ error: 'e_weak' });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return res.status(400).json({ error: 'e_exists' });
  const r = db.prepare('INSERT INTO users (name,email,pass) VALUES (?,?,?)').run(name, email, hashPw(pw));
  req.user = { id: r.lastInsertRowid, name, email }; setUser(req, res, r.lastInsertRowid); cartOf(req, res); res.json({ ok: true });
});
app.post('/api/auth/login', authLimiter, (req, res) => {
  const email = str(req.body?.email, 120).toLowerCase(), pw = String(req.body?.password ?? ''), u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  let ok = false; try { ok = !!u && checkPw(pw, u.pass); } catch {}
  if (!ok) return res.status(401).json({ error: 'e_login' });
  req.user = { id: u.id, name: u.name, email: u.email }; setUser(req, res, u.id); cartOf(req, res); res.json({ ok: true });
});
app.post('/api/auth/logout', (req, res) => { res.clearCookie('u', { path: '/' }); res.clearCookie('cart', { path: '/' }); res.json({ ok: true }); });

// ---------- ادمین ----------
const adminSign = v => crypto.createHmac('sha256', SESSION_SECRET + ':admin').update(v).digest('hex');
const sha = v => crypto.createHash('sha256').update(String(v)).digest();
const validAdmin = t => { if (!t) return false; const [exp, sig] = t.split('.'); if (!exp || !sig || Number(exp) < Date.now()) return false; const g = Buffer.from(adminSign(exp)), s = Buffer.from(sig); return g.length === s.length && crypto.timingSafeEqual(g, s); };
const requireAdmin = (req, res, next) => validAdmin(req.cookies.admin) ? next() : res.status(401).json({ error: 'unauthorized' });
app.post('/api/admin/login', limiter(15, 10), (req, res) => {
  if (crypto.timingSafeEqual(sha(String(req.body?.password ?? '').trim()), sha(ADMIN_PASSWORD))) {
    const exp = String(Date.now() + 12 * 3600e3); res.cookie('admin', `${exp}.${adminSign(exp)}`, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 12 * 3600e3, path: '/' }); return res.json({ ok: true });
  }
  res.status(401).json({ error: 'رمز اشتباه است' });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('admin', { path: '/' }); res.json({ ok: true }); });
app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ ok: true }));
app.get('/api/admin/stats', requireAdmin, (req, res) => res.json({
  products: db.prepare('SELECT COUNT(*) n FROM products').get().n, users: db.prepare('SELECT COUNT(*) n FROM users').get().n, orders: db.prepare('SELECT COUNT(*) n FROM orders').get().n,
  revenue: db.prepare("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status!='canceled'").get().n,
  carts: db.prepare('SELECT COUNT(*) n FROM carts c WHERE EXISTS (SELECT 1 FROM cart_items WHERE cart_id=c.id)').get().n }));

// آپلود با بهینه‌سازی (شفافیت PNG حفظ می‌شود)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 8 },
  fileFilter: (q, f, cb) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype) ? cb(null, true) : cb(new Error('فقط تصویر JPG، PNG یا WebP مجاز است')) }).array('images', 8);
app.post('/api/admin/upload', requireAdmin, (req, res) => upload(req, res, async err => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'حجم هر تصویر حداکثر ۱۰ مگابایت است' : err.message });
  const done = [];
  try {
    for (const f of req.files || []) {
      const name = crypto.randomBytes(12).toString('hex') + '.webp', dest = path.join(UPLOAD_DIR, name), img = sharp(f.buffer, { limitInputPixels: 40e6 });
      const meta = await img.metadata(); if (!['jpeg', 'png', 'webp'].includes(meta.format)) throw new Error('format');
      const out = await img.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toFile(dest);
      done.push({ url: '/uploads/' + name, before: f.size, after: out.size });
    }
  } catch (e) { done.forEach(d => fs.unlink(path.join(UPLOAD_DIR, path.basename(d.url)), () => {})); return res.status(400).json({ error: 'فایل تصویر معتبر نیست' }); }
  res.json({ urls: done.map(d => d.url), info: done });
}));

const cleanI18n = raw => Object.fromEntries(LANGS.map(l => [l, { title: str(raw?.[l]?.title, 150), description: str(raw?.[l]?.description, 600), details: str(raw?.[l]?.details, 1200) }]));
const cleanSizes = a => { const seen = new Set(); return (Array.isArray(a) ? a : []).slice(0, 20).map(s => ({ size: str(s?.size, 10).toUpperCase(), stock: int(s?.stock, 9999) })).filter(s => s.size && !seen.has(s.size) && seen.add(s.size)); };
const cleanProduct = b => ({ category: CATS[b.category] ? b.category : 'women', price: int(b.price), old_price: int(b.old_price), tone: /^#[0-9a-f]{6}$/i.test(b.tone || '') ? b.tone : '#ece4d6', sort: int(b.sort, 9999),
  active: b.active ? 1 : 0, featured: b.featured ? 1 : 0, is_new: b.is_new ? 1 : 0, images: JSON.stringify((Array.isArray(b.images) ? b.images : []).filter(u => typeof u === 'string' && IMG_RE.test(u)).slice(0, 8)),
  sizes: JSON.stringify(cleanSizes(b.sizes)), i18n: JSON.stringify(cleanI18n(b.i18n)) });
const checkProduct = p => { const i = parse(p.i18n, {}); return !i.fa?.title ? 'عنوان فارسی الزامی است' : !p.price ? 'قیمت لازم است' : parse(p.sizes, []).length === 0 ? 'حداقل یک سایز لازم است' : null; };
app.get('/api/admin/products', requireAdmin, (req, res) => res.json(db.prepare('SELECT * FROM products ORDER BY sort, id DESC').all()));
app.post('/api/admin/products', requireAdmin, (req, res) => {
  const p = cleanProduct(req.body || {}), err = checkProduct(p); if (err) return res.status(400).json({ error: err });
  p.slug = uniqueSlug(str(req.body.slug, 80) || parse(p.i18n, {}).en?.title || `product-${Date.now()}`);
  const cols = Object.keys(p), r = db.prepare(`INSERT INTO products (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(p); res.json({ id: r.lastInsertRowid, slug: p.slug });
});
app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id), old = db.prepare('SELECT slug FROM products WHERE id=?').get(id); if (!old) return res.status(404).json({ error: 'پیدا نشد' });
  const p = cleanProduct(req.body || {}), err = checkProduct(p); if (err) return res.status(400).json({ error: err });
  p.slug = str(req.body.slug, 80) ? uniqueSlug(req.body.slug, id) : old.slug;
  db.prepare(`UPDATE products SET ${Object.keys(p).map(c => `${c}=@${c}`).join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ ...p, id }); res.json({ ok: true, slug: p.slug });
});
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => { db.prepare('DELETE FROM products WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });

app.get('/api/admin/carts', requireAdmin, (req, res) => {
  const carts = db.prepare(`SELECT c.id,c.updated_at,c.user_id,u.name,u.email FROM carts c LEFT JOIN users u ON u.id=c.user_id WHERE EXISTS (SELECT 1 FROM cart_items WHERE cart_id=c.id) ORDER BY c.updated_at DESC LIMIT 200`).all();
  res.json(carts.map(c => { const l = cartLines(c.id, 'fa'); return { ...c, count: l.count, total: l.subtotal, items: l.lines.map(x => ({ title: x.p.title, size: x.size, qty: x.qty, price: x.p.price, image: x.p.images[0] || '' })) }; }));
});
app.delete('/api/admin/carts/:id', requireAdmin, (req, res) => { db.prepare('DELETE FROM cart_items WHERE cart_id=?').run(Number(req.params.id)); touch(Number(req.params.id)); res.json({ ok: true }); });
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all(), items = db.prepare('SELECT * FROM order_items WHERE order_id=?');
  res.json(orders.map(o => ({ ...o, items: items.all(o.id) })));
});
const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'canceled'];
app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(Number(req.params.id)), st = req.body?.status;
  if (!o || !STATUSES.includes(st)) return res.status(400).json({ error: 'bad request' });
  if (o.status === 'canceled' && st !== 'canceled') return res.status(400).json({ error: 'سفارش لغوشده را نمی‌شود دوباره فعال کرد' });
  db.transaction(() => {
    if (st === 'canceled' && o.status !== 'canceled') for (const i of db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id)) { // برگرداندن موجودی
      const p = db.prepare('SELECT sizes FROM products WHERE id=?').get(i.product_id); if (!p) continue;
      const sizes = parse(p.sizes, []), s = sizes.find(x => x.size === i.size); if (s) { s.stock += i.qty; db.prepare('UPDATE products SET sizes=? WHERE id=?').run(JSON.stringify(sizes), i.product_id); }
    }
    db.prepare('UPDATE orders SET status=? WHERE id=?').run(st, o.id);
  })();
  res.json({ ok: true });
});
app.get('/api/admin/users', requireAdmin, (req, res) => res.json(db.prepare('SELECT u.id,u.name,u.email,u.created_at,(SELECT COUNT(*) FROM orders WHERE user_id=u.id) orders FROM users u ORDER BY u.id DESC LIMIT 300').all()));

app.use(L, (req, res) => notFound(req, res, req.params.lang));
app.use((req, res) => res.status(404).type('text').send('Not found'));
app.use((err, req, res, next) => { if (err.type === 'entity.parse.failed' || err.status === 400) return res.status(400).json({ error: 'e_generic' }); console.error(err); res.status(500).json({ error: 'server' }); });
app.listen(PORT, '127.0.0.1', () => console.log(`shop demo on 127.0.0.1:${PORT}`));
