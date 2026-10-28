// Istoric zilnic (30 zile) la nivel national, preluat de pe o pagina publica
// (nu API-ul rate-limitat) de pe pretcarburant.ro - continut afisat normal pe pagina,
// nu date private sau protejate. Fara regex pe cod JS executabil - doar extragem numere.
const fs = require('fs');
const path = require('path');

async function fetchIstoric() {
    const res = await fetch('https://pretcarburant.ro/blog/preturi-azi');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();

    const seriiStart = html.indexOf('var serii = [');
    const seriiEnd = html.indexOf('].filter(', seriiStart);
    if (seriiStart === -1 || seriiEnd === -1) throw new Error('Nu am gasit blocul "serii" in pagina.');
    const seriiBlock = html.slice(seriiStart, seriiEnd);

    const etichIdx = html.indexOf('etichete: [', seriiEnd);
    const etichEnd = html.indexOf(']', etichIdx);
    const etichBlock = html.slice(etichIdx, etichEnd + 1);
    const etichete = Array.from(etichBlock.matchAll(/"(\d{4}-\d{2}-\d{2})"/g)).map(m => m[1]);

    const serii = {};
    const blocuri = seriiBlock.split('{nume:').slice(1);
    for (const bloc of blocuri) {
        const entitate = (/entitate:\s*'([a-z_]+)'/.exec(bloc) || [])[1];
        const valoriStr = (/valori:\s*\[([^\]]*)\]/.exec(bloc) || [])[1];
        if (!entitate || valoriStr == null) continue;
        serii[entitate] = valoriStr.split(',').map(s => {
            const t = s.trim();
            return t === 'null' || t === '' ? null : parseFloat(t);
        });
    }

    return { etichete, serii };
}

async function main() {
    const { etichete, serii } = await fetchIstoric();
    const data = {
        actualizat_la: new Date().toISOString(),
        sursa: 'pretcarburant.ro (medie nationala, ultimele 30 de zile)',
        etichete,
        serii
    };
    const outPath = path.join(__dirname, '..', 'site', 'istoric.json');
    fs.writeFileSync(outPath, JSON.stringify(data));

    const jsPath = path.join(__dirname, '..', 'site', 'istoric.js');
    fs.writeFileSync(jsPath, 'window.PECO_ISTORIC = ' + JSON.stringify(data) + ';\n');

    console.log('Scris', outPath, 'si', jsPath, '-', etichete.length, 'zile.');
}

main().catch(err => {
    console.error('Eroare la istoric:', err.message);
    process.exit(1);
});
