// Generates one SVG thumbnail per seeded course into public/thumbs.
// Run from the client folder: node scripts/make-thumbs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { CATALOG, thumbName } = require('../../server/src/seed/catalog.js');

const PALETTES = [
  ['#166534', '#4ade80'], ['#0e7490', '#67e8f9'], ['#15803d', '#bbf7d0'], ['#a16207', '#fde047'],
  ['#1d4ed8', '#93c5fd'], ['#0369a1', '#7dd3fc'], ['#7c3aed', '#c4b5fd'], ['#0f766e', '#5eead4'],
  ['#b45309', '#fcd34d'], ['#be123c', '#fda4af'], ['#c2410c', '#fdba74'], ['#4338ca', '#a5b4fc'],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// splits a long title over two lines at a space near the middle
function wrap(title) {
  if (title.length <= 26) return [title];
  const mid = Math.floor(title.length / 2);
  let cut = title.lastIndexOf(' ', mid + 4);
  if (cut < 8) cut = title.indexOf(' ', mid);
  return [title.slice(0, cut), title.slice(cut + 1)];
}

function svg([title, category, level, , , label], i) {
  const [dark, light] = PALETTES[i % PALETTES.length];
  const lines = wrap(title);
  const titleText = lines.map((l, n) => `<text x="36" y="${290 + n * 30}" font-size="26" font-weight="700" fill="#fff">${esc(l)}</text>`).join('');
  const labelSize = label.length > 12 ? 32 : label.length > 9 ? 40 : 54;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" font-family="'Segoe UI', system-ui, -apple-system, Arial, sans-serif">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${dark}"/><stop offset="1" stop-color="${light}"/></linearGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient></defs>
<rect width="640" height="360" fill="url(#g)"/>
<circle cx="560" cy="60" r="120" fill="#fff" opacity=".08"/><circle cx="610" cy="200" r="70" fill="#fff" opacity=".07"/>
<rect x="36" y="34" width="300" height="168" rx="14" fill="#0f172a" opacity=".92"/>
<circle cx="58" cy="56" r="5" fill="#f87171"/><circle cx="76" cy="56" r="5" fill="#fbbf24"/><circle cx="94" cy="56" r="5" fill="#4ade80"/>
<text x="58" y="125" font-size="${labelSize}" font-weight="800" fill="${light}" font-family="Consolas, 'Courier New', monospace">${esc(label)}</text>
<rect x="58" y="150" width="150" height="8" rx="4" fill="#334155"/><rect x="58" y="168" width="220" height="8" rx="4" fill="#1e293b"/>
<rect x="0" y="200" width="640" height="160" fill="url(#fade)"/>
<rect x="36" y="214" width="${(category.length + level.length + 3) * 8 + 28}" height="26" rx="13" fill="#fff" opacity=".9"/>
<text x="50" y="232" font-size="13" font-weight="700" fill="${dark}">${esc(category)} · ${esc(level)}</text>
${titleText}
</svg>
`;
}

const out = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../public/thumbs');
fs.mkdirSync(out, { recursive: true });
CATALOG.forEach((c, i) => fs.writeFileSync(path.join(out, `${thumbName(c[0])}.svg`), svg(c, i)));
console.log(`wrote ${CATALOG.length} thumbnails to ${out}`);
