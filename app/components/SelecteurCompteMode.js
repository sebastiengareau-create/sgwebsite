"use client";

import { MODES_PAIEMENT } from "@/lib/modesPaiement";

const LABEL_CATEGORIE = { CAISSE: "Caisse", BANQUE: "Banque", CARTE_CREDIT: "Carte de crédit" };

// Paire de menus déroulants "compte de trésorerie" + "mode de paiement",
// réutilisée par les formulaires d'encaissement (facture) et de décaissement
// (dépense) — voir app/bons/BonDetailClient.js, app/secretaire/factures/FacturesClient.js,
// app/gerant/comptabilite/comptes-a-payer/ComptesAPayerClient.js.
export default function SelecteurCompteMode({ comptes, compteTresorerieId, setCompteTresorerieId, modePaiement, setModePaiement }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select value={compteTresorerieId} onChange={(e) => setCompteTresorerieId(e.target.value)} style={{ ...champStyle, flex: 1 }}>
        {comptes.map((c) => (
          <option key={c.id} value={c.id}>{c.nom} ({LABEL_CATEGORIE[c.categorie] || c.categorie})</option>
        ))}
      </select>
      <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} style={{ ...champStyle, flex: 1 }}>
        {MODES_PAIEMENT.map((m) => (
          <option key={m.valeur} value={m.valeur}>{m.label}</option>
        ))}
      </select>
    </div>
  );
}

// Compte par défaut suggéré à l'ouverture du formulaire — le premier compte
// "Banque" actif (le plus courant), sinon le premier compte actif tout court.
export function compteParDefaut(comptes) {
  return comptes.find((c) => c.categorie === "BANQUE")?.id || comptes[0]?.id || "";
}

const champStyle = {
  padding: "8px 9px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 12.5,
};
