"use client";

import { useState } from "react";
import { argent } from "@/lib/format";

// Dépôt en ligne, après l'approbation d'une soumission ou des travaux d'une
// inspection (lib/paiementEnLigne.js) : « Verser un dépôt par carte » ouvre
// la page de paiement de Stripe. depot : { montant, total } ou null (rien à
// verser) ; route : POST qui renvoie { url } ; retour : « reussi » ou
// « annule » au retour de Stripe.
export default function DepotEnLigne({ depot, pourcent, route, retour, modeTest }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function verser() {
    setErreur("");
    setEnCours(true);
    const res = await fetch(route, { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok || !data?.url) {
      setEnCours(false);
      return setErreur(data?.erreur || "Le paiement n'a pas pu être ouvert. Vérifiez votre connexion et réessayez.");
    }
    window.location.href = data.url;
  }

  if (retour === "reussi") {
    return (
      <div role="status" style={{ ...cadre, borderColor: "var(--success)" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--success)" }}>Dépôt reçu — merci !</div>
        <div style={{ fontSize: 13.5, marginTop: 2 }}>Il sera déduit de votre facture.</div>
      </div>
    );
  }
  if (!depot) return null;
  return (
    <div style={cadre}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>Verser un dépôt</div>
      <p style={{ fontSize: 13.5, margin: "4px 0 10px", color: "var(--text-muted)" }}>
        Pour confirmer les travaux, un dépôt de {argent(depot.montant)} ({String(pourcent).replace(".", ",")} % du total de {argent(depot.total)}) peut être versé maintenant. Il sera déduit de votre facture.
      </p>
      {retour === "annule" && <p style={{ fontSize: 13, margin: "0 0 8px" }}>Paiement annulé : rien n&apos;a été débité.</p>}
      {erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 13.5, margin: "0 0 8px" }}>{erreur}</p>}
      <button
        type="button" onClick={verser} disabled={enCours}
        style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "var(--success)", color: "#fff", fontSize: 15.5, fontWeight: 800, cursor: "pointer" }}
      >
        {enCours ? "Ouverture du paiement…" : `Verser ${argent(depot.montant)} par carte`}
      </button>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "6px 0 0", textAlign: "center" }}>
        Paiement sécurisé par Stripe : vos informations de carte ne passent pas par nous.{modeTest ? " Mode test : aucune carte ne sera réellement débitée." : ""}
      </p>
    </div>
  );
}

const cadre = { border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginTop: 16, background: "var(--surface)" };
