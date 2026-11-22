"use client";

import { useState } from "react";
import { argent } from "@/lib/format";
import { TitrePanneau, stylePanneau, TEINTES, Pastille } from "../../components/StyleSection";

const DATE_HEURE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
const STATUTS = {
  PAYE: { libelle: "Payé", couleur: "var(--success)", fond: "var(--success-fond)" },
  A_TRAITER: { libelle: "À traiter", couleur: "var(--danger)", fond: "var(--danger-fond)" },
  OUVERT: { libelle: "Ouvert", couleur: "var(--text-muted)", fond: "var(--surface-alt)" },
  EXPIRE: { libelle: "Abandonné", couleur: "var(--text-muted)", fond: "var(--surface-alt)" },
};

// Paramètres → Paiement en ligne (module Paiement en ligne,
// lib/paiementEnLigne.js) : mode, avis de Stripe, dépôt demandé, derniers
// paiements
export default function PaiementEnLigneSection({ modeTest, adresseAvis, pourcentInitial, paiements }) {
  const [pourcent, setPourcent] = useState(pourcentInitial == null ? "" : String(pourcentInitial).replace(".", ","));
  const [message, setMessage] = useState(null);

  async function enregistrer(e) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/parametres/paiement-en-ligne", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pourcentDepot: pourcent }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setMessage(res?.ok ? { texte: "Enregistré." } : { texte: data?.erreur || "Rien n'a été enregistré.", erreur: true });
  }

  return (
    <div id="paiement-en-ligne" className="conteneur-page-large" style={{ margin: "0 auto", padding: "0 16px" }}>
      <div style={stylePanneau}>
        <TitrePanneau
          icone="banque" teinte={TEINTES.vert} titre="Paiement en ligne"
          sousTitre={modeTest ? "Stripe en mode test : aucune carte n'est réellement débitée" : "Stripe en mode réel"}
        />
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
          Dans Stripe (Développeurs → Webhooks), l&apos;avis de paiement doit pointer vers <b style={{ color: "var(--text)", overflowWrap: "anywhere" }}>{adresseAvis}</b>,
          avec les événements checkout.session.completed, checkout.session.async_payment_succeeded et checkout.session.expired.
          Les paiements arrivent dans le compte de trésorerie « Paiements en ligne (Stripe) » ; les frais de Stripe passent en frais bancaires.
        </p>
        <form onSubmit={enregistrer} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13.5 }}>
          Dépôt demandé à l&apos;approbation d&apos;une soumission ou des travaux d&apos;une inspection :
          <input value={pourcent} onChange={(e) => setPourcent(e.target.value)} inputMode="decimal" placeholder="ex. 25" className="champ" style={{ width: 80, fontSize: 14, textAlign: "right" }} />
          % du total
          <button type="submit" className="bouton-3d" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Enregistrer</button>
        </form>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>Vide : pas de dépôt demandé. Le client peut toujours payer le solde de sa facture en ligne.</p>
        {message && <p role={message.erreur ? "alert" : "status"} style={{ fontSize: 12.5, margin: "6px 0 0", color: message.erreur ? "var(--danger)" : "var(--success)" }}>{message.texte}</p>}

        <div style={{ fontSize: 13.5, fontWeight: 800, margin: "16px 0 6px" }}>Derniers paiements en ligne</div>
        {paiements.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Aucun pour l&apos;instant.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {paiements.map((p) => {
              const s = STATUTS[p.statut] || STATUTS.OUVERT;
              return (
                <div key={p.id} style={{ fontSize: 13, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <b style={{ fontVariantNumeric: "tabular-nums" }}>{argent(p.montant)}</b>
                    <span style={{ flex: 1, minWidth: 0 }}>{p.libelle}</span>
                    <Pastille couleur={s.couleur} fond={s.fond}>{s.libelle}</Pastille>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {DATE_HEURE.format(new Date(p.payeLe || p.creeLe))}{p.fraisStripe != null ? ` · frais Stripe ${argent(p.fraisStripe)}` : ""}{p.paymentIntentId ? ` · ${p.paymentIntentId}` : ""}
                  </div>
                  {p.erreur && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 2 }}>{p.erreur} — à inscrire à la main (ou à rembourser dans Stripe).</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
