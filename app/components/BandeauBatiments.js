// Bandeau d'en-tête des écrans de l'Immobilier et de la Copropriété : la
// couleur de la marque du module en ciel de fin de journée, avec une
// silhouette d'immeubles aux fenêtres allumées (au lieu du dégradé brun et de
// l'icône en filigrane de BandeauSection, commun aux autres sections).
//   variante « immobilier » : violet, plex à corniche
//   variante « copropriete » : bleu, tours en copropriété à balcons vitrés
//   variante « ferme » : vert et blé, grange, silo et vaches au pâturage

const SILHOUETTE = [
  // [x, largeur, hauteur, corniche]
  [0, 46, 58, true], [50, 38, 74, true], [92, 52, 50, true], [148, 34, 88, false], [186, 48, 64, true], [238, 40, 80, true], [282, 50, 56, true],
];
// Fenêtres allumées : [immeuble, colonne, rangée]
const ALLUMEES = [[0, 0, 0], [0, 1, 1], [1, 0, 2], [1, 1, 0], [2, 1, 0], [3, 0, 3], [3, 0, 1], [4, 1, 1], [4, 0, 2], [5, 1, 0], [5, 0, 3], [6, 0, 1], [6, 1, 0]];

// Tours en copropriété : [x, largeur, hauteur]
const TOURS = [[4, 52, 70], [62, 44, 92], [112, 60, 58], [178, 46, 84], [230, 56, 66], [292, 40, 78]];

const FONDS = {
  immobilier: "linear-gradient(118deg, #22195a 0%, #4f3398 38%, #9a4a9c 70%, #ec8a5c 100%)",
  copropriete: "linear-gradient(118deg, #0d2350 0%, #1d4d98 40%, #2b86c4 72%, #5cc4c4 100%)",
  ferme: "linear-gradient(118deg, #10301a 0%, #2a5e2c 38%, #5f9a3e 70%, #e0b04f 100%)",
};

function SilhouettePlex() {
  return (
    <>
      <circle cx="300" cy="22" r="11" fill="#ffe2b0" opacity="0.85" />
      {SILHOUETTE.map(([x, l, h, corniche]) => (
        <g key={x}>
          <rect x={x} y={100 - h} width={l} height={h} fill="#1a1240" opacity="0.6" />
          {corniche && <rect x={x - 2} y={100 - h - 3} width={l + 4} height={4} fill="#1a1240" opacity="0.6" />}
        </g>
      ))}
      {ALLUMEES.map(([i, c, r]) => {
        const [x, , h] = SILHOUETTE[i];
        return <rect key={`${i}-${c}-${r}`} x={x + 8 + c * 16} y={100 - h + 9 + r * 17} width={8} height={10} rx={1} fill="#ffd36b" opacity="0.9" />;
      })}
    </>
  );
}

function SilhouetteTours() {
  return (
    <>
      <circle cx="44" cy="20" r="10" fill="#fff4cf" opacity="0.8" />
      {TOURS.map(([x, l, h], i) => (
        <g key={x}>
          <rect x={x} y={100 - h} width={l} height={h} fill="#0b1a3d" opacity="0.55" />
          {/* Balcons vitrés et fenêtres allumées, un étage sur deux */}
          {Array.from({ length: Math.floor((h - 10) / 12) }, (_, e) => (
            <g key={e}>
              <rect x={x + 3} y={100 - h + 8 + e * 12} width={l - 6} height={2} fill="#bfe6ff" opacity="0.35" />
              {(e + i) % 2 === 0 && <rect x={x + 6 + ((e * 7 + i * 5) % Math.max(6, l - 18))} y={100 - h + 2 + e * 12} width={7} height={6} rx={1} fill="#ffd36b" opacity="0.9" />}
            </g>
          ))}
        </g>
      ))}
    </>
  );
}

// Grange à comble brisé, silo, clôture et quelques vaches
function SilhouetteFerme() {
  const ombre = "#0c2210";
  const vache = (x, y, e, sens = 1) => (
    <g key={x} transform={`translate(${x} ${y}) scale(${sens * e} ${e})`} fill={ombre} opacity="0.62">
      <rect x={-19} y={-26} width={38} height={17} rx={8.5} />
      {[-14, -9, 8, 13].map((px) => <rect key={px} x={px} y={-11} width={3.6} height={11} />)}
      <rect x={16} y={-33} width={13} height={10.5} rx={4.2} />
    </g>
  );
  return (
    <>
      <circle cx="290" cy="22" r="11" fill="#fff1c4" opacity="0.85" />
      <g fill={ombre} opacity="0.62">
        <rect x="150" y="56" width="70" height="44" />
        <polygon points="146,57 158,38 185,29 212,38 224,57" />
        <rect x="226" y="34" width="16" height="66" />
        <path d="M226 34 a8 7 0 0 1 16 0 z" />
      </g>
      <rect x="177" y="72" width="16" height="12" fill="#ffd36b" opacity="0.85" />
      {vache(60, 98, 0.62)}
      {vache(100, 96, 0.5, -1)}
      {vache(272, 99, 0.6, -1)}
      {vache(310, 97, 0.46)}
      <g stroke={ombre} strokeWidth="1.6" opacity="0.55">
        <line x1="0" y1="90" x2="140" y2="90" />
        {[6, 30, 54, 78, 102, 126].map((x) => <line key={x} x1={x} y1="86" x2={x} y2="100" />)}
      </g>
    </>
  );
}

export default function BandeauBatiments({ icone, titre, sousTitre, children, variante = "immobilier" }) {
  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 16, padding: "22px 20px", marginBottom: 16,
      background: FONDS[variante] || FONDS.immobilier, border: "1px solid var(--border)",
    }}>
      <svg viewBox="0 0 332 100" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" style={{ position: "absolute", right: 0, bottom: 0, height: "100%", width: "min(60%, 340px)" }}>
        {/* Côté gauche estompé : le texte qui passe devant reste lisible */}
        <defs>
          <linearGradient id={`fondu-${variante}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id={`masque-${variante}`}><rect x="0" y="0" width="332" height="100" fill={`url(#fondu-${variante})`} /></mask>
        </defs>
        <g mask={`url(#masque-${variante})`}>
          {variante === "copropriete" ? <SilhouetteTours /> : variante === "ferme" ? <SilhouetteFerme /> : <SilhouettePlex />}
        </g>
      </svg>
      <div style={{ position: "relative" }}>
        <h1 style={{ fontSize: 21, margin: 0, color: "#fff", textShadow: "0 1px 8px rgba(20,10,50,0.35)" }}>{icone} {titre}</h1>
        {sousTitre && <p style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, margin: "4px 0 0", maxWidth: 500 }}>{sousTitre}</p>}
        {children}
      </div>
    </div>
  );
}
