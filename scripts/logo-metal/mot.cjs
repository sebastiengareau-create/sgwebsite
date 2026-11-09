// Déclinaison du logo métal kontrolshop : rend le mot du secteur en lettres chromées
// et les deux traits, en PNG transparent 1774×887 (à superposer au logo).
// Usage : node scripts/logo-metal/mot.cjs FERME mot.png [taille=78] [espacement=0.6]
// Rend un mot chromé (style de GARAGE) + les deux traits, en PNG transparent 1774×887
const { chromium } = require('playwright');
const fs = require('fs');
const [,, mot, sortie, tailleArg, espArg] = process.argv;
const taille = Number(tailleArg || 74), esp = Number(espArg || 0.62);
const police = fs.readFileSync('/usr/share/fonts/opentype/inter/Inter-ExtraBoldItalic.otf').toString('base64');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1774, height: 887 } });
  await p.setContent(`<html><head><style>
  @font-face{font-family:K;src:url(data:font/otf;base64,${police})}
  body{margin:0;background:transparent;width:1774px;height:887px;position:relative;overflow:hidden}
  #mot{position:absolute;left:0;right:0;top:${783 - taille*0.5}px;text-align:center;font-family:K;font-size:${taille}px;line-height:1;
    letter-spacing:${esp}em;padding-left:${esp}em;white-space:nowrap}
  #mot span{display:inline-block;transform:scaleX(1.24) skewX(-6deg);
    background:linear-gradient(180deg,#fdfdfd 0%,#e9eaec 35%,#a9adb2 52%,#d9dbde 70%,#f4f4f4 100%);
    -webkit-background-clip:text;color:transparent;-webkit-text-stroke:1.2px rgba(40,40,44,.55);
    filter:drop-shadow(3px 5px 3px rgba(0,0,0,.55))}
  .trait{position:absolute;top:770px;height:14px;filter:drop-shadow(2px 4px 3px rgba(0,0,0,.5))}
  </style></head><body><div id="mot"><span>${mot}</span></div>
  <svg class="trait" id="g" height="14"><defs><linearGradient id="d" x1="0" x2="1"><stop offset="0" stop-color="#9da1a6" stop-opacity=".2"/><stop offset=".7" stop-color="#e6e7e9"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs><polygon id="pg" fill="url(#d)"/></svg>
  <svg class="trait" id="dr" height="14"><defs><linearGradient id="e" x1="1" x2="0"><stop offset="0" stop-color="#9da1a6" stop-opacity=".2"/><stop offset=".7" stop-color="#e6e7e9"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs><polygon id="pd" fill="url(#e)"/></svg>
  </body></html>`);
  await p.evaluate(() => document.fonts.ready);
  const r = await p.evaluate(() => { const s = document.querySelector('#mot span').getBoundingClientRect(); return { g: s.left, d: s.right }; });
  await p.evaluate(({ g, d }) => {
    const ecart = 58, gx0 = 70, dx1 = 1704;
    const L = g - ecart - gx0, R = dx1 - (d + ecart);
    const sg = document.getElementById('g'); sg.style.left = gx0 + 'px'; sg.setAttribute('width', L);
    document.getElementById('pg').setAttribute('points', `0,7 ${L-16},1 ${L},1 ${L-7},13 ${L-24},13`);
    const sd = document.getElementById('dr'); sd.style.left = (d + ecart) + 'px'; sd.setAttribute('width', R);
    document.getElementById('pd').setAttribute('points', `${R},7 16,1 ${24},1 ${7},13 0,13`);
  }, r);
  await p.screenshot({ path: sortie, omitBackground: true });
  await b.close();
})();
