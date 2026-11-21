"use client";

import { useState } from "react";
import { argent } from "@/lib/format";

const DATE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" });

// Solde d'une facture et bouton « Payer par carte » (page de Stripe)
export default function PaiementClient({ jeton, retour, facture, actif, modeTest, telephone }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function payer() {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/paiement-en-ligne/facture/${jeton}`, { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok || !data?.url) {
      setEnCours(false);
      return setErreur(data?.erreur || "Le paiement n'a pas pu être ouvert. Vérifiez votre connexion et réessayez.");
    }
    window.location.href = data.url;
  }

  return (
    <div>
      {facture.payee ? (
        <Bandeau couleur="var(--success)" titre={retour === "reussi" ? "Paiement reçu — merci !" : "Cette facture est payée"}>
          Merci de votre confiance.
        </Bandeau>
      ) : retour === "reussi" ? (
        <Bandeau couleur="var(--success)" titre="Paiement reçu — merci !">
          Votre paiement est en cours de confirmation ; la facture sera marquée payée dans quelques instants.
        </Bandeau>
      ) : retour === "annule" ? (
        <Bandeau couleur="var(--text-muted)" titre="Paiement annulé">Rien n&apos;a été débité. Vous pouvez réessayer quand vous voulez.</Bandeau>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Facture {facture.numero}</h1>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{DATE.format(new Date(facture.date))}</span>
      </div>
      <div style={{ fontSize: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700 }}>{facture.client}</div>
        {facture.vehicule && <div style={{ color: "var(--text-muted)" }}>{facture.vehicule}</div>}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
        <Ligne libelle="Total de la facture" montant={facture.total} />
        {facture.paye > 0.005 && <Ligne libelle="Déjà payé" montant={-facture.paye} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Solde à payer</span>
          <span style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{argent(facture.solde)}</span>
        </div>
      </div>
      <a href={`/api/paiement-en-ligne/facture/${jeton}/pdf`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>
        Voir la facture (PDF)
      </a>

      {facture.solde > 0 && (actif ? (
        <div style={{ marginTop: 18 }}>
          {erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 13.5, margin: "0 0 10px" }}>{erreur}</p>}
          <button
            type="button" onClick={payer} disabled={enCours}
            style={{ width: "100%", padding: 15, borderRadius: 14, border: "none", background: "var(--success)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}
          >
            {enCours ? "Ouverture du paiement…" : `Payer ${argent(facture.solde)} par carte`}
          </button>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0", textAlign: "center" }}>
            Paiement sécurisé par Stripe : vos informations de carte ne passent pas par nous. Apple Pay et Google Pay acceptés selon votre appareil.
          </p>
          {modeTest && <p style={{ fontSize: 12, color: "var(--avertissement)", margin: "6px 0 0", textAlign: "center" }}>Mode test : aucune carte ne sera réellement débitée.</p>}
        </div>
      ) : (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 16 }}>
          Pour payer, communiquez avec nous{telephone ? ` au ${telephone}` : ""}.
        </p>
      ))}
    </div>
  );
}

function Bandeau({ couleur, titre, children }) {
  return (
    <div role="status" style={{ border: `1px solid ${couleur}`, borderLeft: `5px solid ${couleur}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16, background: "var(--surface)" }}>
      <div style={{ fontSize: 15.5, fontWeight: 800, color: couleur }}>{titre}</div>
      <div style={{ fontSize: 13.5, marginTop: 3 }}>{children}</div>
    </div>
  );
}

function Ligne({ libelle, montant }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, marginTop: 4 }}>
      <span style={{ color: "var(--text-muted)" }}>{libelle}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{argent(montant)}</span>
    </div>
  );
}
