import { CLIENT } from "@/lib/client";

// Éléments communs aux factures imprimées (facture d'un bon, facture de
// vente d'un véhicule) — même chose dans le PDF, lib/pdfFacture.js.

// Libellé d'une ligne de taxe, avec le numéro d'inscription de l'entreprise
// juste à côté (« TPS (5 %) · 123456789 RT0001 ») s'il est saisi
export function LibelleTaxe({ libelle, numero }) {
  return (
    <span>
      {libelle}
      {numero && <span style={{ fontSize: 10, color: "#888" }}> · n° {numero}</span>}
    </span>
  );
}

// Bas de la facture : une ligne « Signature » pour signer (profil
// signatureFacture), sinon la mention « document généré le … »
export default function PiedFacture({ nomEntreprise }) {
  if (CLIENT.signatureFacture) {
    return (
      <div style={{ marginTop: 50, display: "flex", alignItems: "flex-end", gap: 10, fontSize: 13, pageBreakInside: "avoid" }}>
        <span style={{ fontWeight: 600 }}>Signature :</span>
        <span style={{ flex: 1, maxWidth: 360, borderBottom: "1px solid #17150f", height: 28 }} />
      </div>
    );
  }
  return (
    <p style={{ fontSize: 10, color: "#999", marginTop: 30, textAlign: "center" }}>
      {nomEntreprise} — document généré le {new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
    </p>
  );
}
