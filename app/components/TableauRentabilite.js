import { argent, nombre } from "@/lib/format";

// Tableau de rentabilité sous le total d'une facture, d'un bon ou d'une
// soumission (gérant seulement) : coûtant des pièces + coût de la
// main-d'œuvre, comparés au montant avant taxes.
// `document` : « de la facture », « du bon », « de la soumission ».
export default function TableauRentabilite({ titre, document, coutPieces, coutMainOeuvre, libelleMainOeuvre, avantTaxes, note, style }) {
  const totalDepenses = coutPieces + coutMainOeuvre;
  const ratioDepenses = avantTaxes > 0 ? (totalDepenses / avantTaxes) * 100 : 0;
  const rentabilitePourcent = 100 - ratioDepenses;
  const ligne = { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, marginBottom: 3 };
  return (
    <div style={{ padding: 10, borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)", ...style }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }}>
        📊 {titre}
      </div>
      <div style={ligne}>
        <span style={{ color: "var(--text-muted)" }}>Coûtant des pièces vendues</span>
        <span>{argent(coutPieces)}</span>
      </div>
      <div style={ligne}>
        <span style={{ color: "var(--text-muted)" }}>{libelleMainOeuvre}</span>
        <span>{argent(coutMainOeuvre)}</span>
      </div>
      <div style={{ ...ligne, paddingTop: 5, marginTop: 3, borderTop: "1px solid var(--border)", marginBottom: 6 }}>
        <span style={{ color: "var(--text-muted)" }}>Total des dépenses</span>
        <span style={{ fontWeight: 600 }}>{argent(totalDepenses)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Rentabilité (dépenses = {nombre(ratioDepenses, 0)} % {document} avant taxes)
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: rentabilitePourcent >= 0 ? "var(--success)" : "var(--danger)" }}>
          {nombre(rentabilitePourcent, 0)} %
        </span>
      </div>
      {note && <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>{note}</div>}
    </div>
  );
}
