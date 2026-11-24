// Rendu des cartes préparées par cartes.py : PDF recto-verso et aperçus PNG.
// node rendre.js <dossier> '["garage","ferme"]'
const { chromium } = require('playwright');

const dir = process.argv[2];
const secteurs = JSON.parse(process.argv[3]);

(async () => {
  const b = await chromium.launch();
  for (const s of secteurs) {
    const p = await b.newPage({ viewport: { width: 360, height: 216 }, deviceScaleFactor: 4 });
    await p.goto(`file://${dir}/carte-${s}.html`);
    const format = { width: '3.75in', height: '2.25in', printBackground: true };
    await p.pdf({ ...format, path: `${dir}/kontrolshop-carte-${s}.pdf` });
    // Recto et verso en fichiers séparés, comme les demandent la plupart des imprimeurs
    await p.pdf({ ...format, pageRanges: '1', path: `${dir}/kontrolshop-carte-${s}-recto.pdf` });
    await p.pdf({ ...format, pageRanges: '2', path: `${dir}/kontrolshop-carte-${s}-verso.pdf` });
    const cartes = await p.$$('.carte');
    await cartes[0].screenshot({ path: `${dir}/apercu-${s}-recto.png` });
    await cartes[1].screenshot({ path: `${dir}/apercu-${s}-verso.png` });
  }
  await b.close();
})();
