import Link from "next/link";

const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function HistoriqueFermeturesClient({ lignes }) {
  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite/fermeture" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour</Link>
      <h1 style={{ fontSize: 20, margin: "8px 0 16px" }}>Journal des fermetures</h1>

      {lignes.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune période fermée pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lignes.map(({ fermeture, reouverture, periode }) => (
            <div key={fermeture.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{NOMS_MOIS[periode.mois - 1]} {periode.annee}</span>
                <span style={{ fontSize: 11, color: reouverture ? "var(--danger)" : "var(--success)" }}>
                  {reouverture ? "🔄 Réouverte" : "🔒 Toujours fermée"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Fermée le {new Date(fermeture.creeLe).toLocaleString("fr-CA", { timeZone: "America/Toronto" })} par {fermeture.parNom}
              </div>
              {reouverture && (
                <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>
                  Réouverte le {new Date(reouverture.creeLe).toLocaleString("fr-CA", { timeZone: "America/Toronto" })} par {reouverture.parNom} — motif : {reouverture.motif}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
