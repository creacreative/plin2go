// Reimprospateaza preturile o data pe ora: ruleaza fetch-all.js acum, apoi la fiecare ora.
// Porneste-l manual (node watch.js) si lasa-l deschis cat timp vrei preturi proaspete pe site.
const { spawnSync } = require('child_process');
const path = require('path');

const ORA = 60 * 60 * 1000;

function ruleazaScraperul() {
    const ora = new Date().toLocaleString('ro-RO');
    console.log(`\n[${ora}] Reimprospatez preturile...`);
    const res = spawnSync(process.execPath, [path.join(__dirname, 'fetch-all.js')], { stdio: 'inherit' });
    if (res.status !== 0) console.log('Scraper-ul de preturi a esuat, incerc din nou peste o ora.');

    const resIstoric = spawnSync(process.execPath, [path.join(__dirname, 'fetch-istoric.js')], { stdio: 'inherit' });
    if (resIstoric.status !== 0) console.log('Scraper-ul de istoric a esuat, incerc din nou peste o ora.');
}

ruleazaScraperul();
setInterval(ruleazaScraperul, ORA);
console.log(`\nPornit. Preturile se reimprospateaza automat la fiecare ora. Lasa fereastra asta deschisa.`);
