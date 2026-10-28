// Construieste harta SVG interactiva a Romaniei (41 judete + Bucuresti) din
// paths.json (contururile, extrase din Wikimedia Commons "Romania counties.svg", CC/PD)
// si labels.json (pozitiile etichetelor de judet din acelasi fisier).
// Fiecare judet devine un singur <path> real (gasit prin point-in-polygon, nu o cutie
// aproximativa), ca sa poti da click oriunde pe bucata lui, cu numele complet scris pe el.
const fs = require('fs');
const path = require('path');

const paths = JSON.parse(fs.readFileSync(path.join(__dirname, 'paths.json'), 'utf8'));
const labels = JSON.parse(fs.readFileSync(path.join(__dirname, 'labels.json'), 'utf8'));

const JUDETE = {
    ALBA: { slug: 'alba', nume: 'Alba' },
    ARAD: { slug: 'arad', nume: 'Arad' },
    ARGES: { slug: 'arges', nume: 'Argeș' },
    BACAU: { slug: 'bacau', nume: 'Bacău' },
    BIHOR: { slug: 'bihor', nume: 'Bihor' },
    BISTRITA: { slug: 'bistrita', nume: 'Bistrița-Năsăud' },
    BOTOSANI: { slug: 'botosani', nume: 'Botoșani' },
    BRASOV: { slug: 'brasov', nume: 'Brașov' },
    BRAILA: { slug: 'braila', nume: 'Brăila' },
    BUZAU: { slug: 'buzau', nume: 'Buzău' },
    CARAS: { slug: 'caras-severin', nume: 'Caraș-Severin' },
    CALARASI: { slug: 'calarasi', nume: 'Călărași' },
    CLUJ: { slug: 'cluj', nume: 'Cluj' },
    CONSTANTA: { slug: 'constanta', nume: 'Constanța' },
    COVASNA: { slug: 'covasna', nume: 'Covasna' },
    DAMBOVITA: { slug: 'dambovita', nume: 'Dâmbovița' },
    DOLJ: { slug: 'dolj', nume: 'Dolj' },
    GALATI: { slug: 'galati', nume: 'Galați' },
    GIURGIU: { slug: 'giurgiu', nume: 'Giurgiu' },
    GORJ: { slug: 'gorj', nume: 'Gorj' },
    HARGHITA: { slug: 'harghita', nume: 'Harghita' },
    HUNEDOARA: { slug: 'hunedoara', nume: 'Hunedoara' },
    IALOMITA: { slug: 'ialomita', nume: 'Ialomița' },
    IASI: { slug: 'iasi', nume: 'Iași' },
    ILFOV: { slug: 'ilfov', nume: 'Ilfov' },
    MARAMURES: { slug: 'maramures', nume: 'Maramureș' },
    MEHEDINTI: { slug: 'mehedinti', nume: 'Mehedinți' },
    MURES: { slug: 'mures', nume: 'Mureș' },
    NEAMT: { slug: 'neamt', nume: 'Neamț' },
    OLT: { slug: 'olt', nume: 'Olt' },
    PRAHOVA: { slug: 'prahova', nume: 'Prahova' },
    'SATU MARE': { slug: 'satu-mare', nume: 'Satu Mare' },
    SALAJ: { slug: 'salaj', nume: 'Sălaj' },
    SIBIU: { slug: 'sibiu', nume: 'Sibiu' },
    SUCEAVA: { slug: 'suceava', nume: 'Suceava' },
    TELEORMAN: { slug: 'teleorman', nume: 'Teleorman' },
    TIMIS: { slug: 'timis', nume: 'Timiș' },
    TULCEA: { slug: 'tulcea', nume: 'Tulcea' },
    VASLUI: { slug: 'vaslui', nume: 'Vaslui' },
    VALCEA: { slug: 'valcea', nume: 'Vâlcea' },
    VRANCEA: { slug: 'vrancea', nume: 'Vrancea' }
};

// --- parser minimal de path SVG (doar M/L/C/Z, absolute - tot ce foloseste sursa) ---
function cubicPoint(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const x = mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0];
    const y = mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1];
    return [x, y];
}

function parseSubpaths(d) {
    const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) || [];
    let i = 0, cmd = null, cur = [0, 0];
    const subpaths = [];
    let poly = [];
    const num = () => parseFloat(tokens[i++]);
    while (i < tokens.length) {
        if (/[A-Za-z]/.test(tokens[i])) { cmd = tokens[i]; i++; }
        if (cmd === 'M') {
            cur = [num(), num()];
            if (poly.length) subpaths.push(poly);
            poly = [cur];
            cmd = 'L';
        } else if (cmd === 'L') {
            cur = [num(), num()];
            poly.push(cur);
        } else if (cmd === 'C') {
            const p1 = [num(), num()], p2 = [num(), num()], p3 = [num(), num()];
            for (let s = 1; s <= 8; s++) poly.push(cubicPoint(cur, p1, p2, p3, s / 8));
            cur = p3;
        } else if (cmd === 'Z' || cmd === 'z') {
            if (poly.length) subpaths.push(poly);
            poly = [];
        } else {
            i++; // siguranta la token necunoscut
        }
    }
    if (poly.length) subpaths.push(poly);
    return subpaths;
}

function pointInPolygon(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        const intersect = ((yi > pt[1]) !== (yj > pt[1])) &&
            (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function pointInSubpaths(pt, subpaths) {
    return subpaths.some(poly => poly.length > 2 && pointInPolygon(pt, poly));
}

function bbox(subpaths) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const poly of subpaths) for (const [x, y] of poly) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// centrul de greutate (centroid) al poligonului cel mai mare al formei,
// mult mai fidel decat centrul cutiei pentru judete alungite/neregulate (ex. Tulcea).
function polygonCentroid(poly) {
    let area = 0, cx = 0, cy = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [x0, y0] = poly[j], [x1, y1] = poly[i];
        const cross = x0 * y1 - x1 * y0;
        area += cross;
        cx += (x0 + x1) * cross;
        cy += (y0 + y1) * cross;
    }
    area *= 0.5;
    if (Math.abs(area) < 1e-6) {
        const n = poly.length || 1;
        return { x: poly.reduce((s, p) => s + p[0], 0) / n, y: poly.reduce((s, p) => s + p[1], 0) / n, area: 0 };
    }
    return { x: cx / (6 * area), y: cy / (6 * area), area: Math.abs(area) };
}

function mainCentroid(subpaths) {
    let best = null;
    for (const poly of subpaths) {
        if (poly.length < 3) continue;
        const c = polygonCentroid(poly);
        if (!best || c.area > best.area) best = c;
    }
    return best || { x: 0, y: 0 };
}

// --- potrivire path colorat <-> eticheta de judet, prin point-in-polygon ---
const coloredPaths = paths.filter(p => p.fill);
const parsed = coloredPaths.map(p => ({ ...p, subpaths: parseSubpaths(p.d) }));

const counties = [];
for (const label of labels) {
    const info = JUDETE[label.name];
    if (!info) continue;
    const match = parsed.find(p => pointInSubpaths([label.x, label.y], p.subpaths));
    if (!match) {
        console.warn('Nu am gasit conturul pentru', label.name);
        continue;
    }
    const centroid = mainCentroid(match.subpaths);
    counties.push({ ...info, x: centroid.x, y: centroid.y, d: match.d, fill: match.fill, box: bbox(match.subpaths) });
}
console.log('Potrivite', counties.length, '/', labels.length, 'judete cu un contur real.');

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// numele lung se scrie pe 2 randuri (spatiu/cratima) ca sa incapa pe judetele mici
function nameLines(nume) {
    if (nume.length <= 7) return [nume];
    const sep = nume.includes('-') ? '-' : (nume.includes(' ') ? ' ' : null);
    if (!sep) return [nume];
    const idx = nume.indexOf(sep);
    const l1 = nume.slice(0, idx + (sep === '-' ? 1 : 0));
    const l2 = nume.slice(idx + 1);
    return [l1, l2];
}

const regionSvg = counties.map(c => {
    const lines = nameLines(c.nume);
    const fontSize = Math.max(9, Math.min(17, Math.min(c.box.w, c.box.h) / (lines.length > 1 ? 2.6 : 3.4)));
    const lineHeight = fontSize * 1.05;
    const startY = c.y - ((lines.length - 1) * lineHeight) / 2;
    const tspans = lines.map((line, idx) =>
        `<tspan x="${c.x}" y="${startY + idx * lineHeight}">${esc(line)}</tspan>`
    ).join('');
    return `<g class="judet-region" data-slug="${c.slug}" data-nume="${esc(c.nume)}" tabindex="0" role="button" aria-label="${esc(c.nume)}">
  <path class="judet-shape" d="${c.d}" fill="${c.fill}" />
  <text class="judet-label" font-size="${fontSize.toFixed(1)}">${tspans}</text>
</g>`;
}).join('\n');

// Bucuresti nu are contur separat pe harta sursa (e inclus vizual in Ilfov) - punct clickabil dedicat.
const ilfov = counties.find(c => c.slug === 'ilfov');
const bucurestiSvg = ilfov ? `<g class="judet-region bucuresti" data-slug="bucuresti" data-nume="București" tabindex="0" role="button" aria-label="București">
  <circle class="judet-shape" cx="${ilfov.x + 2}" cy="${ilfov.y + 26}" r="14" fill="#f59e0b" />
  <text class="judet-label" font-size="11" x="${ilfov.x + 2}" y="${ilfov.y + 30}">București</text>
</g>` : '';

const svg = `<svg viewBox="0 0 1300 1000" xmlns="http://www.w3.org/2000/svg" id="romaniaMap">
<g class="map-regions">
${regionSvg}
${bucurestiSvg}
</g>
</svg>`;

fs.writeFileSync(path.join(__dirname, '..', 'site', 'map.js'), 'window.PECO_MAP_SVG = ' + JSON.stringify(svg) + ';\n');
console.log('Scris site/map.js cu', counties.length + 1, 'zone (inclusiv Bucuresti).');
