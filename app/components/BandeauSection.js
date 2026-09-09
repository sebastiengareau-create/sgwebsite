// Bandeau d'en-tête réutilisé en haut de chaque section principale du menu
// (Paie, Calendrier, Bons de commande, Clients, Fournisseurs, Inventaire,
// Comptabilité, Employés, Rapports) — même dégradé, même icône décorative en
// filigrane, pour une identité visuelle cohérente d'une section à l'autre.
export default function BandeauSection({ icone, titre, sousTitre, children }) {
  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 16, padding: "22px 20px", marginBottom: 16,
      background: "linear-gradient(135deg, #241b0f 0%, var(--accent-ombre) 100%)", border: "1px solid var(--border)",
    }}>
      <div style={{ position: "absolute", right: -18, top: "50%", transform: "translateY(-50%)", fontSize: 92, opacity: 0.16, lineHeight: 1 }}>
        {icone}
      </div>
      <div style={{ position: "relative" }}>
        <h1 style={{ fontSize: 21, margin: 0, color: "#fff" }}>{icone} {titre}</h1>
        {sousTitre && (
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, margin: "4px 0 0" }}>
            {sousTitre}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
