// Bandeau d'en-tête des écrans de l'Immobilier : le violet de la marque
// Immobilier en ciel de fin de journée, avec une petite silhouette de plex
// aux fenêtres allumées (au lieu du dégradé brun et de l'icône en filigrane
// de BandeauSection, commun aux autres sections).

const SILHOUETTE = [
  // [x, largeur, hauteur, corniche]
  [0, 46, 58, true], [50, 38, 74, true], [92, 52, 50, true], [148, 34, 88, false], [186, 48, 64, true], [238, 40, 80, true], [282, 50, 56, true],
];
// Fenêtres allumées : [immeuble, colonne, rangée]
const ALLUMEES = [[0, 0, 0], [0, 1, 1], [1, 0, 2], [1, 1, 0], [2, 1, 0], [3, 0, 3], [3, 0, 1], [4, 1, 1], [4, 0, 2], [5, 1, 0], [5, 0, 3], [6, 0, 1], [6, 1, 0]];

export default function BandeauImmo({ icone, titre, sousTitre, children }) {
  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 16, padding: "22px 20px", marginBottom: 16,
      background: "linear-gradient(118deg, #22195a 0%, #4f3398 38%, #9a4a9c 70%, #ec8a5c 100%)", border: "1px solid var(--border)",
    }}>
      <svg viewBox="0 0 332 100" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" style={{ position: "absolute", right: 0, bottom: 0, height: "100%", width: "min(60%, 340px)" }}>
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
      </svg>
      <div style={{ position: "relative" }}>
        <h1 style={{ fontSize: 21, margin: 0, color: "#fff", textShadow: "0 1px 8px rgba(20,10,50,0.35)" }}>{icone} {titre}</h1>
        {sousTitre && <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: "4px 0 0", maxWidth: 560 }}>{sousTitre}</p>}
        {children}
      </div>
    </div>
  );
}
