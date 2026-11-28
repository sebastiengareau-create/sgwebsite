// Bandeau d'en-tête des écrans de l'Immobilier et de la Copropriété : la
// couleur de la marque du module en ciel de fin de journée, avec une
// silhouette d'immeubles aux fenêtres allumées (au lieu du dégradé brun et de
// l'icône en filigrane de BandeauSection, commun aux autres sections).
//   variante « immobilier » : violet, plex à corniche
//   variante « copropriete » : bleu, tours en copropriété à balcons vitrés

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
          {variante === "copropriete" ? <SilhouetteTours /> : <SilhouettePlex />}
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
