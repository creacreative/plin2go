let moneda = 'RON';

function convert(p) {
    if (p == null) return null;
    if (moneda === 'EUR' && window.PECO_DATA.curs_eur) return p / window.PECO_DATA.curs_eur;
    return p;
}

function simbol() {
    return moneda === 'EUR' ? '€' : 'lei';
}

function fmtAmount(p, zecimaleRon, zecimaleEur) {
    const v = convert(p);
    if (v == null) return '—';
    return v.toFixed(moneda === 'EUR' ? zecimaleEur : zecimaleRon) + ' ' + simbol();
}

function fmt(p) {
    return fmtAmount(p, 2, 3); // pret per litru
}

function range(obj) {
    if (!obj) return '—';
    return obj.min === obj.max ? fmt(obj.min) : fmt(obj.min) + ' – ' + fmt(obj.max);
}

function renderCheapest(judet) {
    const el = document.getElementById('cheapest');
    const items = [
        { label: 'Cea mai ieftină benzină', d: judet.cel_mai_ieftin.benzina },
        { label: 'Cea mai ieftină motorină', d: judet.cel_mai_ieftin.motorina }
    ];
    el.innerHTML = items.map(({ label, d }) => {
        if (!d) return '';
        return `<div class="cheapest-box">
            <h3>${label} din ${judet.judet}</h3>
            <div class="price">${fmt(d.pret)}</div>
            <div class="station">${d.brand || ''} ${d.statie || ''}</div>
            <div class="addr">${d.adresa || ''}</div>
        </div>`;
    }).join('');
}

const BRAND_COLORS = {
    PETROM: '#E31937', OMV: '#003B7E', ROMPETROL: '#0066B3', MOL: '#00843D',
    LUKOIL: '#D42927', SOCAR: '#009639', GAZPROM: '#0071CE', OSCAR: '#C8102E'
};

function mapsSearchUrl(brand, judetNume) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(brand + ' ' + judetNume);
}

function renderCards(judet) {
    const el = document.getElementById('cards');
    if (!judet.brands.length) {
        el.innerHTML = '<p class="legend">Nu avem date pentru acest județ momentan.</p>';
        return;
    }
    el.innerHTML = judet.brands.map(b => {
        const url = mapsSearchUrl(b.brand, judet.judet);
        const brandColor = BRAND_COLORS[b.brand] || 'var(--accent)';
        return `
        <div class="card" style="--brand-color:${brandColor}">
            <div class="card-head">
                <span class="brand-name">${b.brand}</span>
                ${b.are_gpl ? '<span class="badge gpl">⛽ GPL</span>' : '<span class="badge">fără GPL</span>'}
            </div>
            <div class="fuel-row"><span>Benzină</span><span class="price">${range(b.benzina)}</span></div>
            <div class="fuel-row"><span>Benzină premium</span><span class="price">${range(b.benzina_premium)}</span></div>
            <div class="fuel-row"><span>Motorină</span><span class="price">${range(b.motorina)}</span></div>
            <div class="fuel-row"><span>Motorină premium</span><span class="price">${range(b.motorina_premium)}</span></div>
            ${b.are_gpl ? `<div class="fuel-row gpl"><span>GPL</span><span class="price">${range(b.gpl)}</span></div>` : ''}
            <div class="card-foot">
                <a class="addr-link" href="${url}" target="_blank" rel="noopener">📍 Stații ${b.brand} în ${judet.judet}</a>
                <button class="copy-btn" data-url="${url}" title="Copiază linkul">🔗</button>
            </div>
        </div>`;
    }).join('');

    el.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(btn.getAttribute('data-url'));
                const old = btn.textContent;
                btn.textContent = '✅';
                setTimeout(() => { btn.textContent = old; }, 1200);
            } catch (e) {
                alert('Nu am putut copia linkul.');
            }
        });
    });
}

let currentSlug = null;

function renderCalc(judet) {
    const box = document.getElementById('calc');
    const litriInput = document.getElementById('calc-litri');
    const resultsEl = document.getElementById('calc-results');

    const benzina = judet.cel_mai_ieftin.benzina?.pret;
    const motorina = judet.cel_mai_ieftin.motorina?.pret;
    if (benzina == null && motorina == null) {
        box.hidden = true;
        return;
    }
    box.hidden = false;

    function update() {
        const litri = Math.max(1, parseFloat(litriInput.value) || 50);
        const rows = [];
        if (benzina != null) rows.push(['Benzină (cel mai ieftin preț)', benzina]);
        if (motorina != null) rows.push(['Motorină (cel mai ieftin preț)', motorina]);
        resultsEl.innerHTML = rows.map(([label, pret]) =>
            `<div class="calc-row"><span>${label}</span><span class="calc-total">${fmtAmount(litri * pret, 1, 2)}</span></div>`
        ).join('');
    }
    litriInput.oninput = update;
    update();
}

function renderGplSavings(judet) {
    const box = document.getElementById('gpl-calc');
    const kmInput = document.getElementById('gpl-km');
    const consumInput = document.getElementById('gpl-consum');
    const resultsEl = document.getElementById('gpl-results');

    const benzina = judet.cel_mai_ieftin.benzina?.pret;
    const gplPreturi = judet.brands.filter(b => b.are_gpl && b.gpl).map(b => b.gpl.min);
    if (benzina == null || !gplPreturi.length) {
        box.hidden = true;
        return;
    }
    const gpl = Math.min(...gplPreturi);
    box.hidden = false;

    const CONSUM_GPL_PLUS = 1.15; // GPL consuma cu ~15% mai mult pe litru decat benzina

    function update() {
        const km = Math.max(100, parseFloat(kmInput.value) || 15000);
        const consum = Math.max(1, parseFloat(consumInput.value) || 7);
        const litriBenzina = km / 100 * consum;
        const litriGpl = litriBenzina * CONSUM_GPL_PLUS;
        const costBenzina = litriBenzina * benzina;
        const costGpl = litriGpl * gpl;
        const economie = costBenzina - costGpl;
        resultsEl.innerHTML = `
            <div class="calc-row"><span>Cost anual benzină</span><span class="calc-total">${fmtAmount(costBenzina, 0, 0)}</span></div>
            <div class="calc-row"><span>Cost anual GPL</span><span class="calc-total">${fmtAmount(costGpl, 0, 0)}</span></div>
            <div class="calc-row gpl-save"><span>Economie pe an</span><span class="calc-total">${fmtAmount(economie, 0, 0)}</span></div>
        `;
    }
    kmInput.oninput = update;
    consumInput.oninput = update;
    update();
}

function deselectJudet() {
    currentSlug = null;
    document.querySelectorAll('.judet-region.selected').forEach(n => n.classList.remove('selected'));
    document.getElementById('judet-title').textContent = 'Alege un județ pe hartă';
    document.getElementById('cheapest').innerHTML = '';
    document.getElementById('cards').innerHTML = '';
    document.getElementById('calc').hidden = true;
    document.getElementById('gpl-calc').hidden = true;
}

function selectJudet(slug, nume) {
    currentSlug = slug;
    const judet = window.PECO_DATA.judete[slug];
    document.getElementById('judet-title').textContent = 'Prețuri în ' + (judet ? judet.judet : nume);

    document.querySelectorAll('.judet-region.selected').forEach(n => n.classList.remove('selected'));
    const region = document.querySelector(`.judet-region[data-slug="${slug}"]`);
    if (region) {
        region.classList.add('selected');
        region.parentNode.appendChild(region); // il aduce deasupra vecinilor cand se ridica
    }

    if (!judet) {
        document.getElementById('cheapest').innerHTML = '';
        document.getElementById('cards').innerHTML = '<p class="legend">Nu avem date pentru acest județ momentan.</p>';
        document.getElementById('calc').hidden = true;
        document.getElementById('gpl-calc').hidden = true;
        return;
    }
    renderCheapest(judet);
    renderCards(judet);
    renderCalc(judet);
    renderGplSavings(judet);
}

function stripDiacritics(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function setupSearch() {
    const input = document.getElementById('search');
    const resultsBox = document.getElementById('search-results');
    const regions = Array.from(document.querySelectorAll('.judet-region'));

    input.addEventListener('input', () => {
        const q = stripDiacritics(input.value.trim());

        if (!q) {
            regions.forEach(r => r.classList.remove('dimmed'));
            resultsBox.innerHTML = '';
            resultsBox.classList.remove('open');
            return;
        }

        const matches = [];
        regions.forEach(r => {
            const nume = r.getAttribute('data-nume');
            const isMatch = stripDiacritics(nume).startsWith(q);
            r.classList.toggle('dimmed', !isMatch);
            if (isMatch) matches.push({ slug: r.getAttribute('data-slug'), nume });
        });

        matches.sort((a, b) => a.nume.localeCompare(b.nume, 'ro'));
        resultsBox.innerHTML = matches.map(m =>
            `<button type="button" data-slug="${m.slug}" data-nume="${m.nume}">${m.nume}</button>`
        ).join('');
        resultsBox.classList.toggle('open', matches.length > 0);

        resultsBox.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                selectJudet(btn.getAttribute('data-slug'), btn.getAttribute('data-nume'));
                input.value = '';
                regions.forEach(r => r.classList.remove('dimmed'));
                resultsBox.innerHTML = '';
                resultsBox.classList.remove('open');
            });
        });
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const first = resultsBox.querySelector('button');
            if (first) first.click();
        } else if (e.key === 'Escape') {
            input.value = '';
            input.dispatchEvent(new Event('input'));
        }
    });
}

function updateCursInfo() {
    const el = document.getElementById('curs-info');
    if (window.PECO_DATA.curs_eur) {
        el.textContent = '1 € = ' + window.PECO_DATA.curs_eur.toFixed(4) + ' lei (curs BCE, ' + window.PECO_DATA.curs_eur_data + ')';
    } else {
        el.textContent = '';
    }
}

function setupCurrencyToggle() {
    const btn = document.getElementById('currency-toggle');
    updateCursInfo();
    btn.addEventListener('click', () => {
        if (!window.PECO_DATA.curs_eur) {
            alert('Nu avem cursul euro momentan.');
            return;
        }
        moneda = moneda === 'RON' ? 'EUR' : 'RON';
        btn.classList.toggle('eur', moneda === 'EUR');
        if (currentSlug) selectJudet(currentSlug, window.PECO_DATA.judete[currentSlug]?.judet || currentSlug);
    });
}

const JUDET_COORDS = {
    alba: [46.0697, 23.5805], arad: [46.1866, 21.3123], arges: [44.8565, 24.8692],
    bacau: [46.5670, 26.9146], bihor: [47.0458, 21.9189], bistrita: [47.1333, 24.5000],
    botosani: [47.7486, 26.6694], brasov: [45.6427, 25.5887], braila: [45.2692, 27.9575],
    bucuresti: [44.4268, 26.1025], buzau: [45.1500, 26.8167], 'caras-severin': [45.3000, 21.8833],
    cluj: [46.7712, 23.6236], constanta: [44.1733, 28.6383], covasna: [45.8667, 26.1833],
    calarasi: [44.2058, 27.3306], dolj: [44.3167, 23.8000], dambovita: [44.9167, 25.4500],
    galati: [45.4333, 28.0333], giurgiu: [43.9037, 25.9699], gorj: [45.0333, 23.2833],
    harghita: [46.3597, 25.8019], hunedoara: [45.7500, 22.9000], ialomita: [44.5833, 27.3833],
    iasi: [47.1585, 27.6014], ilfov: [44.5000, 26.1000], maramures: [47.6567, 23.5681],
    mehedinti: [44.6333, 22.6500], mures: [46.5425, 24.5575], neamt: [46.9759, 26.3819],
    olt: [44.4323, 24.3715], prahova: [44.9333, 26.0167], 'satu-mare': [47.7900, 22.8850],
    sibiu: [45.7983, 24.1256], suceava: [47.6500, 26.2500], salaj: [47.1833, 23.0500],
    teleorman: [43.8167, 25.3333], timis: [45.7489, 21.2087], tulcea: [45.1667, 28.8000],
    vaslui: [46.6333, 27.7333], vrancea: [45.7000, 27.1833], valcea: [45.1000, 24.3667]
};

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestJudet(lat, lng) {
    let best = null, bestDist = Infinity;
    for (const [slug, [jLat, jLng]] of Object.entries(JUDET_COORDS)) {
        const d = haversine(lat, lng, jLat, jLng);
        if (d < bestDist) { bestDist = d; best = slug; }
    }
    return best;
}

function setupNearMe() {
    const btn = document.getElementById('near-me-btn');
    btn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert('Browserul tău nu suportă geolocație.');
            return;
        }
        const old = btn.textContent;
        btn.textContent = '📍 Caut...';
        btn.disabled = true;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                btn.textContent = old;
                btn.disabled = false;
                const slug = nearestJudet(pos.coords.latitude, pos.coords.longitude);
                const nume = window.PECO_DATA.judete[slug]?.judet || slug;
                selectJudet(slug, nume);
                document.getElementById('detail').scrollIntoView({ behavior: 'smooth' });
            },
            () => {
                btn.textContent = old;
                btn.disabled = false;
                alert('Nu am putut afla locația ta. Verifică permisiunea de locație din browser.');
            },
            { timeout: 10000 }
        );
    });
}

function timpRelativ(dataIso) {
    const secunde = Math.max(0, Math.round((Date.now() - new Date(dataIso).getTime()) / 1000));
    if (secunde < 45) return 'chiar acum';
    const minute = Math.round(secunde / 60);
    if (minute < 60) return 'acum ' + minute + (minute === 1 ? ' minut' : ' minute');
    const ore = Math.round(minute / 60);
    if (ore < 24) return 'acum ' + ore + (ore === 1 ? ' oră' : ' ore');
    const zile = Math.round(ore / 24);
    return 'acum ' + zile + (zile === 1 ? ' zi' : ' zile');
}

function updateTimestampText() {
    document.getElementById('updated').textContent =
        'Prețuri actualizate ' + timpRelativ(window.PECO_DATA.actualizat_la) + ' · sursă: ' + window.PECO_DATA.sursa;
}

async function refreshData() {
    try {
        const res = await fetch('data.json', { cache: 'no-store' });
        if (!res.ok) return;
        const fresh = await res.json();
        if (fresh.actualizat_la === window.PECO_DATA.actualizat_la) return;
        window.PECO_DATA = fresh;
        updateTimestampText();
        updateCursInfo();
        if (currentSlug) selectJudet(currentSlug, window.PECO_DATA.judete[currentSlug]?.judet || currentSlug);
    } catch (e) {
        // normal cand pagina e deschisa direct ca fisier (file://), fara server - ignoram
    }
}

const STATS_SERIES = [
    { key: 'benzina', label: 'Benzină', color: '#f87171' },
    { key: 'motorina', label: 'Motorină', color: '#60a5fa' },
    { key: 'gpl', label: 'GPL', color: '#fbbf24' }
];

function renderStatsChart() {
    const istoric = window.PECO_ISTORIC;
    const scrollWrap = document.getElementById('stats-chart-scroll');
    const legendEl = document.getElementById('stats-legend');
    document.getElementById('stats-info').textContent =
        'Medie națională, din ' + istoric.sursa + ' · glisează/pinch pentru detalii';

    if (!istoric || !istoric.etichete || !istoric.etichete.length) {
        scrollWrap.innerHTML = '<p class="legend">Nu avem încă istoric salvat.</p>';
        legendEl.innerHTML = '';
        return;
    }

    // latime fixa, mai mare decat un telefon - asa graficul devine scrollabil orizontal
    // si fiecare zi are mai mult spatiu (mai usor de citit/apasat pe mobil)
    const W = 1400, H = 340, PAD_L = 60, PAD_R = 20, PAD_T = 20, PAD_B = 34;
    const n = istoric.etichete.length;
    const xAt = (i) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R);

    // normalizam fiecare serie ca variatie procentuala fata de prima zi,
    // ca sa poata fi comparate pe acelasi grafic (benzina ~10 lei, GPL ~4.7 lei)
    const seriesData = STATS_SERIES.map(s => {
        const valori = istoric.serii[s.key] || [];
        const prima = valori.find(v => v != null);
        const procente = valori.map(v => (v == null || prima == null) ? null : ((v - prima) / prima) * 100);
        return { ...s, valori, procente, ultima: [...valori].reverse().find(v => v != null) };
    }).filter(s => s.procente.some(v => v != null));

    const toate = seriesData.flatMap(s => s.procente).filter(v => v != null);
    const minV = Math.min(0, ...toate), maxV = Math.max(0, ...toate);
    const span = (maxV - minV) || 1;
    const yAt = (v) => PAD_T + (1 - (v - minV) / span) * (H - PAD_T - PAD_B);

    const zeroY = yAt(0);

    const pathFor = (procente) => {
        let d = '';
        procente.forEach((v, i) => {
            if (v == null) return;
            d += (d ? ' L ' : 'M ') + xAt(i).toFixed(1) + ' ' + yAt(v).toFixed(1);
        });
        return d;
    };

    // un punct de eticheta la fiecare ~4 zile, plus prima si ultima zi, ca sa se vada clar fiecare perioada
    const pas = Math.max(1, Math.round((n - 1) / 7));
    const xLabelsIdx = [];
    for (let i = 0; i < n; i += pas) xLabelsIdx.push(i);
    if (n - 1 - xLabelsIdx[xLabelsIdx.length - 1] >= pas / 2) xLabelsIdx.push(n - 1);
    else xLabelsIdx[xLabelsIdx.length - 1] = n - 1;

    const xLabels = xLabelsIdx.map(i =>
        `<text x="${xAt(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="chart-axis">${istoric.etichete[i].slice(5)}</text>`
    ).join('');

    const gridLines = xLabelsIdx.map(i =>
        `<line x1="${xAt(i).toFixed(1)}" y1="${PAD_T}" x2="${xAt(i).toFixed(1)}" y2="${H - PAD_B}" class="chart-grid"/>`
    ).join('');

    const lines = seriesData.map(s =>
        `<path d="${pathFor(s.procente)}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
    ).join('');

    // puncte pe fiecare zi; data-* duce la tooltip-ul propriu (apare la click/tap, nu doar la hover)
    const dots = seriesData.map(s =>
        s.procente.map((v, i) => {
            if (v == null) return '';
            const titlu = `${s.label}, ${istoric.etichete[i]}: ${fmt(s.valori[i])}`;
            return `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="4" fill="${s.color}" class="chart-dot" data-info="${titlu}"><title>${titlu}</title></circle>`;
        }).join('')
    ).join('');

    scrollWrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
        ${gridLines}
        <line x1="${PAD_L}" y1="${zeroY}" x2="${W - PAD_R}" y2="${zeroY}" class="chart-zero"/>
        <text x="${PAD_L - 8}" y="${zeroY + 4}" text-anchor="end" class="chart-axis">0%</text>
        ${lines}
        ${dots}
        ${xLabels}
    </svg>`;

    const tooltip = document.getElementById('chart-tooltip');
    scrollWrap.querySelectorAll('.chart-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            tooltip.textContent = dot.getAttribute('data-info');
            tooltip.hidden = false;
            const dotBox = dot.getBoundingClientRect();
            const wrapBox = tooltip.parentElement.getBoundingClientRect();
            tooltip.style.left = (dotBox.left - wrapBox.left + dotBox.width / 2) + 'px';
            tooltip.style.top = (dotBox.top - wrapBox.top) + 'px';
        });
    });
    document.addEventListener('click', () => { tooltip.hidden = true; });

    legendEl.innerHTML = seriesData.map(s => {
        const schimbare = s.procente[s.procente.length - 1];
        const semn = schimbare == null ? '' : (schimbare > 0 ? '+' : '') + schimbare.toFixed(1) + '%';
        return `<div class="item">
            <span class="swatch" style="background:${s.color}"></span>
            <span>${s.label}: ${fmt(s.ultima)} <span class="muted">(${semn} / 30 zile)</span></span>
        </div>`;
    }).join('');
}

function setupTabs() {
    const hartaBtn = document.getElementById('tab-harta-btn');
    const statsBtn = document.getElementById('tab-stats-btn');
    const hartaSection = document.getElementById('tab-harta');
    const statsSection = document.getElementById('tab-stats');
    let statsRendered = false;

    hartaBtn.addEventListener('click', () => {
        hartaBtn.classList.add('active');
        statsBtn.classList.remove('active');
        hartaSection.hidden = false;
        statsSection.hidden = true;
    });

    statsBtn.addEventListener('click', () => {
        statsBtn.classList.add('active');
        hartaBtn.classList.remove('active');
        hartaSection.hidden = true;
        statsSection.hidden = false;
        if (!statsRendered) { renderStatsChart(); statsRendered = true; }
    });
}

(function init() {
    updateTimestampText();
    setInterval(updateTimestampText, 30 * 1000); // actualizeaza textul "acum X minute" mereu
    setInterval(refreshData, 5 * 60 * 1000); // verifica date noi la fiecare 5 minute

    document.getElementById('map-wrap').innerHTML = window.PECO_MAP_SVG;

    document.querySelectorAll('.judet-region').forEach(node => {
        const slug = node.getAttribute('data-slug');
        const nume = node.getAttribute('data-nume');
        const toggle = () => {
            if (node.classList.contains('selected')) deselectJudet();
            else selectJudet(slug, nume);
        };
        node.addEventListener('click', toggle);
        node.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
    });

    setupSearch();
    setupNearMe();
    setupCurrencyToggle();
    setupTabs();
})();
