// Ilustrações vetoriais geradas no navegador para a demonstração (o link de
// demonstração não pode carregar fotos externas). Cada URL vira sempre a mesma imagem.

const INTERIOR = ['1600607687939', '1600566753190', '1600210492486', '1493809842364', '1484154218962', '1586023492125', '1556909114', '1560185007', '1507089947368'];
const APARTMENT = ['1545324418', '1522708323590', '1502672260266', '1560448204'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const SKIES = [
  ['#1d1b2e', '#5a4a6b', '#d9926a', '#f2c48d'],
  ['#14213a', '#3f5a7d', '#c98a6a', '#efc79a'],
  ['#231a26', '#6b4a52', '#d48b5c', '#f0b878'],
  ['#18263a', '#4f6d8f', '#b9a28c', '#e9d3b0'],
];
const FACADES = ['#d8d0c3', '#cfc6b6', '#e6e0d5', '#b9ab98'];
const WOODS = ['#7b4f32', '#8e5d3a', '#6a452d'];
const GLOW = '<linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2b0"/><stop offset="1" stop-color="#e99a52"/></linearGradient>';

function sky(r: () => number) {
  const s = SKIES[Math.floor(r() * SKIES.length)];
  return `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s[0]}"/><stop offset=".45" stop-color="${s[1]}"/><stop offset=".8" stop-color="${s[2]}"/><stop offset="1" stop-color="${s[3]}"/></linearGradient>`;
}

function tree(x: number, y: number, s: number, c = '#1c2a22') {
  return `<rect x="${x - 3 * s}" y="${y - 40 * s}" width="${6 * s}" height="${40 * s}" fill="#2a211b"/><ellipse cx="${x}" cy="${y - 60 * s}" rx="${34 * s}" ry="${42 * s}" fill="${c}"/><ellipse cx="${x - 16 * s}" cy="${y - 44 * s}" rx="${22 * s}" ry="${24 * s}" fill="${c}" opacity=".9"/>`;
}

function windows(x: number, y: number, w: number, h: number, cols: number) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#glow)"/>`;
  for (let i = 1; i < cols; i++) s += `<rect x="${x + (w / cols) * i - 1.5}" y="${y}" width="3" height="${h}" fill="#2b2622"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#2b2622" stroke-width="4"/>`;
  return s;
}

function house(r: () => number) {
  const facade = FACADES[Math.floor(r() * FACADES.length)];
  const wood = WOODS[Math.floor(r() * WOODS.length)];
  const layout = Math.floor(r() * 3);
  const pool = r() > 0.4;
  let b = '';
  b += `<path d="M0 360 Q200 300 400 340 T800 320 V600 H0Z" fill="#232823" opacity=".8"/>`;
  b += tree(70, 470, 1.4) + tree(735, 470, 1.6, '#17241d');
  b += `<rect x="0" y="460" width="800" height="140" fill="#1b211c"/>`;
  if (layout === 0) {
    // dois pavimentos com balanço
    b += `<rect x="150" y="300" width="420" height="170" fill="${facade}"/>`;
    b += windows(180, 330, 250, 125, 5);
    b += `<rect x="450" y="320" width="100" height="150" fill="${wood}"/>`;
    b += `<rect x="230" y="190" width="440" height="110" fill="#2f2a26"/>`;
    b += windows(260, 210, 300, 70, 6);
    b += `<rect x="580" y="210" width="70" height="80" fill="${wood}"/>`;
    b += `<rect x="215" y="180" width="470" height="12" fill="#ece6dc"/><rect x="135" y="292" width="450" height="10" fill="#ece6dc"/>`;
  } else if (layout === 1) {
    // térrea longa
    b += `<rect x="90" y="330" width="620" height="140" fill="${facade}"/>`;
    b += `<rect x="70" y="316" width="660" height="16" fill="#efe9df"/>`;
    b += windows(120, 352, 300, 105, 6);
    b += `<rect x="440" y="352" width="110" height="118" fill="${wood}"/>`;
    b += windows(570, 352, 110, 80, 2);
  } else {
    // contemporânea com telhado inclinado
    b += `<path d="M180 470 V280 L380 170 L580 280 V470Z" fill="${facade}"/>`;
    b += `<path d="M160 290 L380 160 L600 290" fill="none" stroke="#2f2a26" stroke-width="18" stroke-linejoin="round"/>`;
    b += windows(250, 270, 260, 190, 4);
    b += `<rect x="580" y="340" width="150" height="130" fill="#2f2a26"/>` + windows(600, 360, 110, 80, 2);
  }
  if (pool) {
    b += `<linearGradient id="pool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd3d6"/><stop offset="1" stop-color="#2d7f8f"/></linearGradient>`;
    b += `<path d="M120 500 H690 L740 560 H70Z" fill="#d9d0c2"/><path d="M150 507 H660 L700 552 H110Z" fill="url(#pool)"/>`;
    b += `<path d="M260 520 h120 M420 535 h140" stroke="#ffe2b0" stroke-width="3" opacity=".6"/>`;
  } else {
    b += `<path d="M330 470 L300 600 H470 L430 470Z" fill="#c8bfb0" opacity=".6"/>`;
  }
  b += `<circle cx="660" cy="110" r="26" fill="#fff3d6" opacity=".55"/>`;
  return b;
}

function tower(r: () => number) {
  let b = `<path d="M0 420 H800 V600 H0Z" fill="#1c201d"/>`;
  b += `<rect x="40" y="250" width="140" height="200" fill="#3a3a44" opacity=".7"/><rect x="620" y="220" width="150" height="230" fill="#3a3a44" opacity=".7"/>`;
  const x = 250, w = 300, top = 70;
  b += `<rect x="${x}" y="${top}" width="${w}" height="${470 - top}" fill="#e7e1d6"/>`;
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 4; col++) {
      const lit = r() > 0.45;
      b += `<rect x="${x + 22 + col * 70}" y="${top + 24 + row * 33}" width="54" height="22" rx="2" fill="${lit ? 'url(#glow)' : '#4a5363'}"/>`;
    }
    b += `<rect x="${x - 8}" y="${top + 48 + row * 33}" width="${w + 16}" height="5" fill="#cfc7b9"/>`;
  }
  b += tree(200, 520, 1.1) + tree(610, 520, 1.3, '#17241d');
  b += `<rect x="0" y="515" width="800" height="85" fill="#161a17"/>`;
  return b;
}

function interior(r: () => number) {
  const walls = [['#d9cdbd', '#bfae98'], ['#cdbfae', '#a99683'], ['#e2d8ca', '#c4b49e']][Math.floor(r() * 3)];
  const sofa = ['#e9e1d3', '#8c7a66', '#c7b7a0', '#5f6b5c'][Math.floor(r() * 4)];
  const left = r() > 0.5;
  let b = `<linearGradient id="wall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${walls[0]}"/><stop offset="1" stop-color="${walls[1]}"/></linearGradient>`;
  b += `<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9b7454"/><stop offset="1" stop-color="#5e4331"/></linearGradient>`;
  b += `<radialGradient id="lamp" cx=".5" cy=".3" r=".6"><stop offset="0" stop-color="#ffe7bf" stop-opacity=".55"/><stop offset="1" stop-color="#ffe7bf" stop-opacity="0"/></radialGradient>`;
  b += `<rect width="800" height="600" fill="url(#wall)"/>`;
  const wx = left ? 60 : 470;
  b += `<rect x="${wx}" y="70" width="270" height="300" fill="url(#sky)"/>`;
  b += `<path d="M${wx} 300 Q${wx + 80} 270 ${wx + 150} 290 T${wx + 270} 280 V370 H${wx}Z" fill="#2e3a33" opacity=".8"/>`;
  b += `<rect x="${wx}" y="70" width="270" height="300" fill="none" stroke="#3a322b" stroke-width="10"/><rect x="${wx + 132}" y="70" width="6" height="300" fill="#3a322b"/>`;
  b += `<rect x="${left ? 440 : 120}" y="140" width="170" height="120" fill="#efe8dc" stroke="#3a322b" stroke-width="6"/><path d="M${left ? 460 : 140} 240 l40 -50 l30 30 l40 -60 l40 70Z" fill="#b8866a" opacity=".8"/>`;
  b += `<rect y="430" width="800" height="170" fill="url(#floor)"/>`;
  b += `<ellipse cx="400" cy="520" rx="300" ry="50" fill="#d8cbb6" opacity=".55"/>`;
  b += `<rect x="190" y="360" width="420" height="90" rx="26" fill="${sofa}"/><rect x="170" y="390" width="460" height="80" rx="24" fill="${sofa}"/><rect x="190" y="400" width="420" height="40" rx="14" fill="#000" opacity=".08"/>`;
  b += `<rect x="215" y="470" width="10" height="22" fill="#2f2620"/><rect x="575" y="470" width="10" height="22" fill="#2f2620"/>`;
  b += `<ellipse cx="400" cy="512" rx="110" ry="18" fill="#3b2f27"/><rect x="392" y="512" width="16" height="30" fill="#3b2f27"/>`;
  b += `<line x1="400" y1="0" x2="400" y2="150" stroke="#2a241f" stroke-width="3"/><path d="M330 200 Q400 120 470 200Z" fill="#cfc6b8"/><rect width="800" height="600" fill="url(#lamp)"/>`;
  b += `<rect x="${left ? 690 : 60}" y="360" width="50" height="70" rx="8" fill="#6b5a4a"/><ellipse cx="${left ? 715 : 85}" cy="320" rx="45" ry="60" fill="#3e5a42"/>`;
  return b;
}

const cache = new Map<string, string>();
export function demoImage(src: string) {
  const hit = cache.get(src);
  if (hit) return hit;
  const id = src.match(/photo-(\d+)/)?.[1] ?? src;
  const r = rng(hash(src));
  const kind = INTERIOR.includes(id) ? 'in' : APARTMENT.includes(id) ? 'apt' : 'house';
  const body = kind === 'in' ? interior(r) : kind === 'apt' ? tower(r) : house(r);
  const defs = `<defs>${sky(r)}${GLOW}</defs>`;
  const bg = kind === 'in' ? '' : '<rect width="800" height="600" fill="url(#sky)"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">${defs}${bg}${body}</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(src, url);
  return url;
}
