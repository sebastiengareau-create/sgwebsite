"use client";

import { useState } from "react";
import { argent } from "@/lib/format";
import { MESSAGES_TEXTO } from "@/lib/textos";
import { nomClientBon } from "@/lib/nomClient";
import BoutonTexto from "../components/BoutonTexto";

// Paiement en ligne d'une facture impayée (module Paiement en ligne,
// lib/paiementEnLigne.js) : le lien de sa page de paiement, à envoyer par
// texto ou à copier. Le courriel de la facture le contient déjà.
export default function LienPaiementFacture({ bon, nomEntreprise }) {
  const [message, setMessage] = useState(null);
  const solde = Math.max(0, Math.round((bon.facture.totalAvecTaxes - (bon.facture.montantPaye || 0)) * 100) / 100);

  async function lien() {
    const res = await fetch(`/api/factures/${bon.facture.id}/lien-paiement`, { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) throw new Error(data?.erreur || "Le lien n'a pas pu être préparé.");
    return data.lien;
  }

  async function copier() {
    setMessage(null);
    try {
      const l = await lien();
      const copie = await navigator.clipboard?.writeText(l).then(() => true).catch(() => false);
      setMessage(copie ? "Lien copié." : l);
    } catch (e) {
      setMessage(e.message);
    }
  }

  return (
    <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)" }}>
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>💳 Paiement en ligne — solde {argent(solde)}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 8px" }}>
        Le client paie par carte sur une page sécurisée ; le paiement s&apos;inscrit tout seul sur la facture. Le courriel de la facture contient déjà le lien.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <BoutonTexto
          telephone={bon.client.telephone}
          message={async () => MESSAGES_TEXTO.paiement({ nom: nomClientBon(bon), numero: bon.facture.numero, solde: argent(solde), lien: await lien(), nomEntreprise })}
          libelle="💬 Envoyer le lien par texto" type="LIEN" bonId={bon.id} clientId={bon.clientId}
          style={bouton}
        />
        <button type="button" onClick={copier} style={bouton}>🔗 Copier le lien</button>
        {message && <span role="status" style={{ flexBasis: "100%", fontSize: 12, color: "var(--text-muted)", overflowWrap: "anywhere" }}>{message}</span>}
      </div>
    </div>
  );
}

const bouton = { fontSize: 12.5, fontWeight: 700, padding: "7px 12px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" };
