// Scraper gratuit (fara cont/API key) pentru preturi carburanti, pe toate cele 41 de judete + Bucuresti.
// Sursa: pretbenzina.ro (POST public, fara token) - date agregate pe RETEA (brand), nu pe statie individuala.
// shortcut: date pe brand, nu pe fiecare statie cu adresa; upgrade cand avem acces la statii individuale (ex. cheie API pretcarburant.ro)
const fs = require('fs');
const path = require('path');

const JUDETE = [
    ['alba', 'Alba'], ['arad', 'Arad'], ['arges', 'Argeș'], ['bacau', 'Bacău'],
    ['bihor', 'Bihor'], ['bistrita', 'Bistrița-Năsăud'], ['botosani', 'Botoșani'],
    ['brasov', 'Brașov'], ['braila', 'Brăila'], ['bucuresti', 'București'],
    ['buzau', 'Buzău'], ['caras-severin', 'Caraș-Severin'], ['cluj', 'Cluj'],
    ['constanta', 'Constanța'], ['covasna', 'Covasna'], ['calarasi', 'Călărași'],
    ['dolj', 'Dolj'], ['dambovita', 'Dâmbovița'], ['galati', 'Galați'],
    ['giurgiu', 'Giurgiu'], ['gorj', 'Gorj'], ['harghita', 'Harghita'],
    ['hunedoara', 'Hunedoara'], ['ialomita', 'Ialomița'], ['iasi', 'Iași'],
    ['ilfov', 'Ilfov'], ['maramures', 'Maramureș'], ['mehedinti', 'Mehedinți'],
    ['mures', 'Mureș'], ['neamt', 'Neamț'], ['olt', 'Olt'], ['prahova', 'Prahova'],
    ['satu-mare', 'Satu Mare'], ['sibiu', 'Sibiu'], ['suceava', 'Suceava'],
    ['salaj', 'Sălaj'], ['teleorman', 'Teleorman'], ['timis', 'Timiș'],
    ['tulcea', 'Tulcea'], ['vaslui', 'Vaslui'], ['vrancea', 'Vrancea'], ['valcea', 'Vâlcea']
];

function decodeEntities(str) {
    return str.replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
}

async function fetchHtml(judetValue) {
    // Site-ul seteaza judetul printr-un cookie (nu prin query) si face redirect 302,
    // iar fetch() nu retrimite automat Set-Cookie pe redirect, asa ca facem pasii manual.
    const postRes = await fetch('https://www.pretbenzina.ro/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `county=${judetValue}&_redirect=%2F`,
        redirect: 'manual'
    });
    const setCookie = postRes.headers.get('set-cookie') || '';
    const countyCookie = (/county=[^;]+/.exec(setCookie) || [])[0] || `county=${judetValue}`;

    const getRes = await fetch('https://www.pretbenzina.ro/', { headers: { Cookie: countyCookie } });
    if (!getRes.ok) throw new Error('HTTP ' + getRes.status);
    return getRes.text();
}

function parseSection(html, sectionTitle) {
    const titleIdx = html.indexOf(`>${sectionTitle}</h2>`);
    if (titleIdx === -1) return [];
    const blockStart = html.indexOf('<div class="price-boxes">', titleIdx);
    const blockEnd = html.indexOf('<!-- .price-boxes -->', blockStart);
    const block = html.slice(blockStart, blockEnd);

    const boxes = [];
    const pieces = block.split('<div class="price-box">').slice(1);
    const altRegex = /alt="([^"]+)"/;
    const minRegex = /price-row-min"><span class="price-label">min<\/span>([\d.]+)/;
    const maxRegex = /price-row-max"><span class="price-label">max<\/span>([\d.]+)/;

    for (const boxHtml of pieces) {
        const brand = (altRegex.exec(boxHtml) || [])[1];
        const min = parseFloat((minRegex.exec(boxHtml) || [])[1]);
        const max = parseFloat((maxRegex.exec(boxHtml) || [])[1]);
        if (brand && !Number.isNaN(min)) {
            boxes.push({ brand, min, max: Number.isNaN(max) ? min : max });
        }
    }
    return boxes;
}

function parseCheapest(html, label) {
    const idx = html.indexOf(label);
    if (idx === -1) return null;
    const chunk = html.slice(idx, idx + 700);
    const price = (/cheapest-price">([\d.]+)/.exec(chunk) || [])[1];
    const station = (/cheapest-station">([^<]+)</.exec(chunk) || [])[1];
    const address = (/cheapest-address">([^<]+)</.exec(chunk) || [])[1];
    const logoAlt = (/cheapest-logo"><img[^>]*alt="([^"]+)"/.exec(chunk) || [])[1];
    if (!price) return null;
    return {
        pret: parseFloat(price),
        brand: logoAlt,
        statie: station ? station.trim() : null,
        adresa: address ? decodeEntities(address.trim()) : null
    };
}

function parseJudet(rawHtml, label) {
    const html = decodeEntities(rawHtml);
    const sections = {
        benzina: parseSection(html, 'Preț Benzină standard'),
        benzina_premium: parseSection(html, 'Preț Benzină premium'),
        motorina: parseSection(html, 'Preț Motorină standard'),
        motorina_premium: parseSection(html, 'Preț Motorină premium'),
        gpl: parseSection(html, 'Preț GPL')
    };

    const brandNames = new Set();
    Object.values(sections).forEach(list => list.forEach(b => brandNames.add(b.brand)));

    const brands = Array.from(brandNames).sort().map(name => {
        const entry = { brand: name };
        for (const fuel of Object.keys(sections)) {
            const found = sections[fuel].find(b => b.brand === name);
            entry[fuel] = found ? { min: found.min, max: found.max } : null;
        }
        entry.are_gpl = !!entry.gpl;
        return entry;
    });

    return {
        judet: label,
        cel_mai_ieftin: {
            benzina: parseCheapest(html, 'Cea mai ieftină benzină din'),
            motorina: parseCheapest(html, 'Cea mai ieftină motorină din')
        },
        brands
    };
}

async function fetchCursEur() {
    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=RON', { redirect: 'follow' });
        const json = await res.json();
        return { curs: json.rates.RON, data: json.date };
    } catch (err) {
        console.log('Nu am putut lua cursul EUR:', err.message);
        return { curs: null, data: null };
    }
}

async function main() {
    const result = {};
    for (const [slug, label] of JUDETE) {
        process.stdout.write(`Fetch ${label}... `);
        try {
            const html = await fetchHtml(slug);
            result[slug] = parseJudet(html, label);
            console.log(result[slug].brands.length + ' retele');
        } catch (err) {
            console.log('EROARE: ' + err.message);
        }
    }

    const { curs: cursEur, data: cursData } = await fetchCursEur();

    const data = {
        actualizat_la: new Date().toISOString(),
        sursa: 'pretbenzina.ro (date pe retea/brand, agregate pe judet)',
        curs_eur: cursEur,
        curs_eur_data: cursData,
        curs_eur_sursa: 'Banca Centrala Europeana, prin frankfurter.app',
        judete: result
    };

    const outPath = path.join(__dirname, '..', 'site', 'data.js');
    fs.writeFileSync(outPath, 'window.PECO_DATA = ' + JSON.stringify(data, null, 2) + ';\n');

    // scris si ca JSON simplu, ca pagina deschisa sa poata relua datele fara reload
    const jsonPath = path.join(__dirname, '..', 'site', 'data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(data));

    console.log('\nScris', outPath, 'si', jsonPath, '-', Object.keys(result).length, 'judete.');
}

main().catch(err => {
    console.error('Eroare la scraping:', err.message);
    process.exit(1);
});
