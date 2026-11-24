// تولید تصاویر PNG شفاف و اورجینال برای محصولات نمونه (CC0 — بدون مشکل کپی‌رایت)
const sharp = require('sharp'), fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'public', 'demo'); fs.mkdirSync(OUT, { recursive: true });
const W = 600, H = 760;
const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
const shade = (hex, p) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = p < 0 ? 0 : 255, q = Math.abs(p); r = clamp((t - r) * q + r); g = clamp((t - g) * q + g); b = clamp((t - b) * q + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); };
const DEFS = `<linearGradient id="sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset=".72" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>
<linearGradient id="hi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".35" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
const svg = (inner, defs = '', gy = 738, rx = 200) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${DEFS}${defs}</defs><ellipse cx="300" cy="${gy}" rx="${rx}" ry="13" fill="#000" opacity=".12"/>${inner}</svg>`;
// بدنه با سایه‌روشن و خط دوخت
const part = (d, c, extra = '') => `<path d="${d}" fill="${c}" stroke="${shade(c, -.32)}" stroke-width="2.5" stroke-linejoin="round" ${extra}/><path d="${d}" fill="url(#sh)"/><path d="${d}" fill="url(#hi)"/>`;
const line = (d, c, w = 3, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const stitch = (d, c) => line(d, shade(c, -.28), 2.2, 'stroke-dasharray="7 6"');

const NECK = 'M250 110 Q300 175 350 110';
function tee({ c, print = '', scale = 1 }) {
  const body = 'M250 110 L184 130 L78 212 L128 290 L176 252 L176 600 Q300 630 424 600 L424 252 L472 290 L522 212 L416 130 L350 110 Q300 175 250 110 Z';
  const g = part(body, c) + line(NECK, shade(c, -.12), 14) + line(NECK, shade(c, -.3), 2) + line('M184 130 Q172 195 176 252', shade(c, -.3), 2) + line('M416 130 Q428 195 424 252', shade(c, -.3), 2)
    + stitch('M176 582 Q300 612 424 582', c) + stitch('M98 220 L142 274', c) + stitch('M502 220 L458 274', c) + print;
  return svg(scale === 1 ? g : `<g transform="translate(${300 * (1 - scale)} ${60 * (1 - scale) + 20}) scale(${scale})">${g}</g>`, '', scale === 1 ? 616 : 548, scale === 1 ? 190 : 165);
}
function longTop({ c, by = 600, hood, zip, collar, coat, shirt, rib, knit, pocket, buttons = 0, accent }) {
  const body = `M250 110 L202 126 L150 160 Q100 320 92 500 L150 515 Q158 360 178 268 L178 ${by} Q300 ${by + 28} 422 ${by} L422 268 Q442 360 450 515 L508 500 Q500 320 450 160 L398 126 L350 110 Q300 175 250 110 Z`;
  let s = '';
  if (hood) s += part('M232 118 Q205 6 300 14 Q395 6 368 118 Q300 165 232 118 Z', shade(c, -.1)) + `<path d="M254 112 Q300 160 346 112 Q338 60 300 56 Q262 60 254 112 Z" fill="${shade(c, -.5)}"/>`;
  s += part(body, c);
  if (knit) s += `<path d="${body}" fill="url(#knit)" opacity=".7"/>`;
  if (rib) {
    s += `<path d="M196 ${by - 30} L404 ${by - 30} L404 ${by} Q300 ${by + 28} 196 ${by} Z" fill="${shade(c, -.1)}" stroke="${shade(c, -.32)}" stroke-width="2"/>`;
    s += `<path d="M90 486 L151 502 L146 530 L85 514 Z M510 486 L449 502 L454 530 L515 514 Z" fill="${shade(c, -.1)}" stroke="${shade(c, -.32)}" stroke-width="2"/>`;
  }
  s += line('M202 126 Q184 200 178 268', shade(c, -.3), 2) + line('M398 126 Q416 200 422 268', shade(c, -.3), 2);
  if (!hood && !collar && !shirt) s += line(NECK, shade(c, -.14), rib || knit ? 18 : 12) + line(NECK, shade(c, -.32), 2);
  if (hood) s += line('M250 112 Q300 170 350 112', shade(c, -.3), 3) + line('M284 150 L282 245', '#f1ece4', 5) + line('M316 150 L318 245', '#f1ece4', 5)
    + part('M226 440 L374 440 L398 540 L202 540 Z', shade(c, -.06)) + line('M240 442 L220 530 M360 442 L380 530', shade(c, -.32), 2);
  if (zip) s += line(`M300 150 L300 ${by + 26}`, shade(c, -.45), 4) + stitch(`M308 160 L308 ${by + 22}`, c) + line(`M230 480 L270 480 M330 480 L370 480`, shade(c, -.4), 4)
    + `<path d="M250 110 L244 78 Q300 62 356 78 L350 110 Q300 175 250 110 Z" fill="${shade(c, -.05)}" stroke="${shade(c, -.32)}" stroke-width="2.5"/>`;
  if (coat) s += `<path d="M250 112 L298 350 L220 270 L194 190 Z M350 112 L302 350 L380 270 L406 190 Z" fill="${shade(c, -.1)}" stroke="${shade(c, -.35)}" stroke-width="2.5" stroke-linejoin="round"/>`
    + [400, 490, 580].map(y => `<circle cx="300" cy="${y}" r="9" fill="${shade(c, -.55)}"/><circle cx="297" cy="${y - 3}" r="3" fill="#fff" opacity=".35"/>`).join('')
    + line('M230 560 L286 560 M314 560 L370 560', shade(c, -.38), 3);
  if (shirt) s += `<path d="M250 108 L300 160 L350 108 L376 140 L300 206 L224 140 Z" fill="#fbfbfa" stroke="${shade(c, -.35)}" stroke-width="2.5" stroke-linejoin="round"/>` + line(`M300 206 L300 ${by + 24}`, shade(c, -.3), 2)
    + Array.from({ length: buttons }, (_, i) => `<circle cx="300" cy="${250 + i * 70}" r="5" fill="${shade(c, -.5)}"/>`).join('')
    + `<path d="M206 330 L262 330 L262 380 L234 392 L206 380 Z" fill="none" stroke="${shade(c, -.3)}" stroke-width="2"/>` + `<path d="M92 486 L151 502 L146 532 L86 516 Z M508 486 L449 502 L454 532 L514 516 Z" fill="${shade(c, -.06)}" stroke="${shade(c, -.32)}" stroke-width="2"/>`;
  if (accent) s += `<path d="M178 330 L422 330 L422 360 L178 360 Z" fill="${accent}" opacity=".92"/>`;
  const defs = knit ? `<pattern id="knit" width="14" height="18" patternUnits="userSpaceOnUse"><path d="M3 0 L7 9 L3 18 M11 0 L7 9 L11 18" stroke="${shade(c, -.16)}" fill="none" stroke-width="2"/></pattern>` : '';
  return svg(s, defs, by + 38, 185);
}
function pants({ c, len = 715, tight, denim, belt }) {
  const l = tight ? 24 : 0, y = len;
  const d = `M${205 + l} 70 L${395 - l} 70 L${412 - l * 1.4} 210 L${398 - l * 1.1} ${y} L312 ${y} L300 ${len < 600 ? 300 : 300} L288 ${y} L${202 + l * 1.1} ${y} L${188 + l * 1.4} 210 Z`;
  let s = part(d, c);
  if (denim) s += `<path d="${d}" fill="url(#shine)" opacity=".8"/>`;
  s += `<path d="M${205 + l} 70 L${395 - l} 70 L${396 - l} 114 L${203 + l} 114 Z" fill="${shade(c, -.1)}" stroke="${shade(c, -.32)}" stroke-width="2.5"/>`;
  if (!tight) s += [228, 300, 372].map(x => `<rect x="${x - 6}" y="64" width="12" height="56" rx="3" fill="${shade(c, -.18)}"/>`).join('')
    + line('M300 114 Q307 210 300 300', shade(c, -.3), 2.5) + line('M206 116 Q228 190 282 198', shade(c, -.3), 2.5) + line('M394 116 Q372 190 318 198', shade(c, -.3), 2.5)
    + stitch('M214 124 Q232 180 276 190', c) + stitch('M386 124 Q368 180 324 190', c);
  else s += line('M300 114 L300 300', shade(c, -.22), 2) + line('M236 120 Q246 400 238 690', '#fff', 6, 'opacity=".07"');
  s += stitch(`M${232 + l} 215 L${240 + l * .6} ${y - 24}`, c) + stitch(`M${368 - l} 215 L${360 - l * .6} ${y - 24}`, c)
    + stitch(`M${204 + l} ${y - 24} L288 ${y - 24}`, c) + stitch(`M312 ${y - 24} L${396 - l} ${y - 24}`, c);
  if (belt) s += `<rect x="${205 + l}" y="82" width="${190 - 2 * l}" height="16" fill="${belt}" opacity=".9"/><rect x="288" y="78" width="24" height="24" rx="3" fill="none" stroke="#d4b86a" stroke-width="4"/>`;
  return svg(s, '', y + 22, 170 - l);
}
function dress({ c, f1, f2 }) {
  const d = 'M250 96 L270 96 L280 170 Q300 196 320 170 L330 96 L350 96 L376 215 L362 300 Q470 470 515 715 Q300 748 85 715 Q130 470 238 300 L224 215 Z';
  const flowers = (x, y, col) => `<g transform="translate(${x} ${y})" fill="${col}">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-8" rx="5" ry="8" transform="rotate(${a})"/>`).join('')}<circle r="3.5" fill="#fff6d6"/></g>`;
  const pat = `<pattern id="fl" width="84" height="84" patternUnits="userSpaceOnUse">${flowers(20, 22, f1)}${flowers(62, 62, f2)}${flowers(64, 14, f2)}${flowers(14, 66, f1)}</pattern>`;
  let s = part(d, c) + `<path d="${d}" fill="url(#fl)"/><path d="${d}" fill="url(#sh)"/>`
    + `<path d="M242 300 L358 300 L352 332 L248 332 Z" fill="${shade(c, -.25)}" stroke="${shade(c, -.45)}" stroke-width="2"/>` + line('M280 170 Q300 196 320 170', shade(c, -.35), 3)
    + line('M250 705 Q300 726 360 712', shade(c, -.2), 2.5) + line('M300 332 Q280 520 230 712 M300 332 Q330 520 390 715', shade(c, -.25), 2, 'opacity=".4"');
  return svg(s, pat, 738, 200);
}
function sneaker({ c, sole = '#f4f1ea', accent }) {
  const up = 'M110 470 Q108 410 150 402 L225 390 Q255 345 305 335 Q335 360 372 392 Q440 440 530 452 Q572 460 574 498 L574 540 L100 540 L96 500 Z';
  let s = `<g transform="translate(0 -20)">` + part(up, c);
  s += `<path d="M440 440 Q530 452 574 498 L574 536 L472 536 Q452 486 440 440 Z" fill="${shade(c, .1)}" stroke="${shade(c, -.32)}" stroke-width="2.5"/>`
    + `<path d="M255 345 Q290 316 328 332 L308 374 Z" fill="${shade(c, -.1)}" stroke="${shade(c, -.32)}" stroke-width="2.5"/>`
    + ['M300 356 L338 378', 'M284 376 L324 398', 'M270 396 L310 418', 'M256 416 L296 438'].map(d => line(d, '#f7f7f3', 5)).join('')
    + (accent ? `<path d="M176 486 Q262 478 336 446 Q316 502 192 506 Z" fill="${accent}"/>` : '') + `<path d="M104 470 Q112 420 150 408 L156 470 Z" fill="${shade(c, -.14)}"/>`
    + `<path d="M92 520 L582 520 Q594 574 560 584 L122 584 Q86 574 92 520 Z" fill="${sole}" stroke="${shade(sole, -.3)}" stroke-width="2.5"/><path d="M92 520 L582 520 Q594 574 560 584 L122 584 Q86 574 92 520 Z" fill="url(#hi)"/>`
    + line('M100 560 L576 560', shade(sole, -.22), 3) + `</g>`;
  return svg(s, '', 576, 250);
}
function scarf({ c1, c2 }) {
  const pat = `<pattern id="pl" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="${c1}"/><rect width="14" height="48" x="6" fill="${c2}" opacity=".85"/><rect width="48" height="14" y="6" fill="${c2}" opacity=".85"/><rect width="3" height="48" x="32" fill="#f4ede0" opacity=".8"/><rect width="48" height="3" y="32" fill="#f4ede0" opacity=".8"/></pattern>`;
  const wrap = 'M190 90 Q300 30 410 90 L420 160 Q300 105 180 160 Z', t1 = 'M214 140 L336 156 L362 640 L242 650 Z', t2 = 'M322 150 L420 128 L452 560 L350 590 Z';
  const fr = (x1, y1, x2, y2) => Array.from({ length: 11 }, (_, i) => { const t = i / 10, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t; return line(`M${x} ${y} l${(t - .5) * 6} 34`, c2, 3); }).join('');
  const sp = d => `<path d="${d}" fill="url(#pl)" stroke="${shade(c1, -.35)}" stroke-width="2.5" stroke-linejoin="round"/><path d="${d}" fill="url(#sh)"/><path d="${d}" fill="url(#hi)"/>`;
  return svg(fr(242, 650, 362, 640) + fr(350, 590, 452, 560) + sp(t1) + sp(t2) + sp(wrap) + line('M180 160 Q300 105 420 160', shade(c1, -.3), 3), pat, 700, 150);
}
function cap({ c, brim }) {
  const dome = 'M150 440 Q148 250 320 240 Q478 250 482 440 Z';
  let s = `<g transform="translate(0 40)">` + `<path d="M310 430 Q440 396 578 452 Q592 482 560 488 Q430 456 310 466 Z" fill="${brim || shade(c, -.15)}" stroke="${shade(c, -.4)}" stroke-width="2.5" stroke-linejoin="round"/>` + part(dome, c)
    + line('M320 242 Q288 336 300 440', shade(c, -.3), 2.5) + line('M236 262 Q216 346 232 440', shade(c, -.3), 2.5) + line('M410 262 Q430 346 420 440', shade(c, -.3), 2.5)
    + `<circle cx="320" cy="242" r="11" fill="${shade(c, -.2)}" stroke="${shade(c, -.4)}" stroke-width="2"/>`
    + `<path d="M150 440 L482 440 L482 458 L150 458 Z" fill="${shade(c, -.12)}" stroke="${shade(c, -.38)}" stroke-width="2.5"/>` + stitch('M158 449 L476 449', c)
    + [[270, 300], [372, 302]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${shade(c, -.4)}"/>`).join('')
    + `<rect x="352" y="355" width="52" height="38" rx="6" fill="#f3efe6" opacity=".92"/><path d="M364 385 L378 363 L392 385 Z" fill="${shade(c, -.2)}"/></g>`;
  return svg(s, '', 536, 200);
}
const star = (cx, cy, r, col) => `<path d="${Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 5 * i - Math.PI / 2, R = i % 2 ? r * .45 : r; return (i ? 'L' : 'M') + (cx + R * Math.cos(a)).toFixed(1) + ' ' + (cy + R * Math.sin(a)).toFixed(1); }).join(' ')} Z" fill="${col}"/>`;

const items = {
  'classic-tee': [() => tee({ c: '#efece6' }), () => tee({ c: '#2f343c' })],
  'slim-jeans': [() => pants({ c: '#2f4c7a', denim: 1 }), () => pants({ c: '#7ea0c9', denim: 1 })],
  'oversized-hoodie': [() => longTop({ c: '#b4532a', hood: 1, rib: 1, by: 600 }), () => longTop({ c: '#d8d1c4', hood: 1, rib: 1, by: 600 })],
  'floral-dress': [() => dress({ c: '#f2d8cf', f1: '#c2410c', f2: '#e0678f' }), () => dress({ c: '#1f2a44', f1: '#f08fb0', f2: '#f2c230' })],
  'wool-coat': [() => longTop({ c: '#b88a5a', coat: 1, by: 700 }), () => longTop({ c: '#3b4049', coat: 1, by: 700 })],
  'leather-jacket': [() => longTop({ c: '#1d1d21', zip: 1, rib: 1, by: 560 }), () => longTop({ c: '#6a4130', zip: 1, rib: 1, by: 560 })],
  'white-sneakers': [() => sneaker({ c: '#f6f5f1', accent: '#c2410c' }), () => sneaker({ c: '#23262c', accent: '#f2c230', sole: '#eceae3' })],
  'knit-sweater': [() => longTop({ c: '#d8c7ad', knit: 1, rib: 1, by: 590 }), () => longTop({ c: '#35523f', knit: 1, rib: 1, by: 590 })],
  'chino-shorts': [() => pants({ c: '#b9a27a', len: 430, belt: '#5a4632' }), () => pants({ c: '#2c3a55', len: 430, belt: '#c9c2b2' })],
  'kids-star-tee': [() => tee({ c: '#f2c230', scale: .86, print: star(300, 330, 62, '#fff') }), () => tee({ c: '#7cc4e8', scale: .86, print: star(300, 330, 62, '#fff') })],
  'plaid-scarf': [() => scarf({ c1: '#a3302a', c2: '#1f2a44' }), () => scarf({ c1: '#d9a21b', c2: '#3b4a38' })],
  'baseball-cap': [() => cap({ c: '#223049' }), () => cap({ c: '#66704a' })],
  'sport-leggings': [() => pants({ c: '#1f2024', tight: 1 }), () => pants({ c: '#5b3b6e', tight: 1 })],
  'oxford-shirt': [() => longTop({ c: '#cfe0ee', shirt: 1, by: 600, buttons: 6 }), () => longTop({ c: '#f2eee6', shirt: 1, by: 600, buttons: 6 })]
};
(async () => {
  const sheet = [];
  for (const [slug, [a, b]] of Object.entries(items)) for (const [i, f] of [a, b].entries()) {
    const raw = await sharp(Buffer.from(f()), { density: 192 }).png().toBuffer();
    const fit = await sharp(raw).trim({ threshold: 6 }).resize({ width: 760, height: 980, fit: 'inside' }).png().toBuffer();
    const png = await sharp({ create: { width: 900, height: 1140, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: fit, gravity: 'centre' }]).png({ compressionLevel: 9 }).toBuffer();
    fs.writeFileSync(path.join(OUT, `${slug}-${i + 1}.png`), png); sheet.push(png);
  }
  const cols = 7, tw = 180, th = 228, rows = Math.ceil(sheet.length / cols);
  const comps = await Promise.all(sheet.map(async (p, i) => ({ input: await sharp(p).resize(tw, th).toBuffer(), left: (i % cols) * tw, top: Math.floor(i / cols) * th })));
  await sharp({ create: { width: cols * tw, height: rows * th, channels: 4, background: '#e9e4dc' } }).composite(comps).png().toFile('/tmp/sheet.png');
  console.log(sheet.length, 'images');
})();
