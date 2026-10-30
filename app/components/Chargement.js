// Écran affiché dès le clic sur un lien, le temps que le serveur prépare la
// page (loading.js de chaque section). Il reprend la forme de l'en-tête et de
// la barre latérale (EnTete), pour que l'écran ne saute pas à l'arrivée de
// la page. Sans lui, l'écran restait figé sur l'ancienne page jusqu'à la
// réponse du serveur, comme si le clic n'avait pas fonctionné.
const LIGNES_MENU = [70, 55, 62, 48, 66, 52];
const BLOCS = [44, 88, 88, 88, 88];

export default function Chargement() {
  return (
    <div role="status" aria-label="Chargement…">
      <nav className="barre-laterale" aria-hidden="true">
        <div className="squelette" style={{ height: 16, width: "60%", margin: "4px 12px 18px" }} />
        {LIGNES_MENU.map((largeur, i) => (
          <div key={i} className="squelette" style={{ height: 14, width: `${largeur}%`, margin: "11px 12px" }} />
        ))}
      </nav>
      <div style={{ borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, padding: "14px 16px" }}>
        <div className="squelette" style={{ width: 72, height: 48 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="squelette" style={{ width: 120, height: 13 }} />
          <div className="squelette" style={{ width: 70, height: 10 }} />
        </div>
      </div>
      <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {BLOCS.map((hauteur, i) => (
          <div key={i} className="squelette" style={{ height: hauteur, borderRadius: 10 }} />
        ))}
      </div>
    </div>
  );
}
