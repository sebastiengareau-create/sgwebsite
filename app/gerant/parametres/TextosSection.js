"use client";

import { useState } from "react";
import Link from "next/link";
import { numeroLisible } from "@/lib/textos";
import { TitrePanneau, stylePanneau, TEINTES, Pastille } from "../../components/StyleSection";

const DATE_HEURE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
export const LIBELLES_TYPES = {
  MESSAGE: "Message", VEHICULE_PRET: "Véhicule prêt", RAPPEL_RDV: "Rappel de rendez-vous", LIEN: "Lien au client",
  RAPPEL: "Rappel", ESSAI: "Essai", AUTO_REPONSE: "Réponse automatique", REPONSE: "Réponse du client",
};
export const STATUTS_TEXTO = {
  ENVOYE: { libelle: "Envoyé", couleur: "var(--text-muted)", fond: "var(--surface-alt)" },
  LIVRE: { libelle: "Livré", couleur: "var(--success)", fond: "var(--success-fond)" },
  ECHEC: { libelle: "Échec", couleur: "var(--danger)", fond: "var(--danger-fond)" },
  RECU: { libelle: "Reçu", couleur: "var(--info, var(--text))", fond: "var(--surface-alt)" },
};
const HEURES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

const CHOIX = [
  { cle: "envoiDirect", titre: "Envoyer depuis l'appli", detail: "Les boutons « 💬 Texto » (lien de soumission, rapport d'inspection, facture à payer, rappels d'entretien et de pneus) envoient le texto du numéro de l'atelier, sans ouvrir Messages." },
  { cle: "vehiculePret", titre: "Véhicule prêt", detail: "Envoyé tout seul à la facturation du bon (pas les factures comptoir), une fois par bon. Avec le lien de paiement si le paiement en ligne est actif et qu'il reste un solde." },
  { cle: "rappelRdv", titre: "Rappel de rendez-vous", detail: "La veille de chaque rendez-vous confirmé, à partir de l'heure choisie." },
  { cle: "reponses", titre: "Réponses des clients", detail: "Les réponses arrivent dans la page Textos, avec un avis à l'atelier. Sinon, le client reçoit une réponse automatique avec le numéro de l'atelier." },
];

// Paramètres → Textos automatiques (module Textos automatiques,
// lib/textosAuto.js) : ce qui part tout seul, texto d'essai, journal
export default function TextosSection({ numeroEnvoi, adresseEntrant, reglagesInit, journal, mois, nbRefus }) {
  const [reglages, setReglages] = useState(reglagesInit);
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [numeroEssai, setNumeroEssai] = useState("");
  const [messageEssai, setMessageEssai] = useState(null);

  async function enregistrer(suivants) {
    setReglages(suivants);
    setEnCours(true);
    setMessage(null);
    const res = await fetch("/api/parametres/textos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(suivants) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(false);
    if (res?.ok) {
      setReglages(data.reglages);
      setMessage({ texte: "Enregistré." });
    } else {
      setReglages(reglages);
      setMessage({ texte: data?.erreur || "Rien n'a été enregistré.", erreur: true });
    }
  }

  async function essayer(e) {
    e.preventDefault();
    setMessageEssai(null);
    const res = await fetch("/api/parametres/textos/essai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telephone: numeroEssai }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setMessageEssai(res?.ok ? { texte: `Texto d'essai envoyé au ${numeroLisible(data.texto.telephone)}.` } : { texte: data?.erreur || "Le texto n'a pas pu être envoyé.", erreur: true });
  }

  return (
    <div id="textos" className="conteneur-page-large" style={{ margin: "0 auto", padding: "0 16px" }}>
      <div style={stylePanneau}>
        <TitrePanneau icone="bulle" teinte={TEINTES.bleu} titre="Textos automatiques" sousTitre={numeroEnvoi ? `Envoyés par Twilio du ${numeroLisible(numeroEnvoi)}` : "Envoyés par Twilio"} />
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 12px" }}>
          Dans Twilio (Phone Numbers → le numéro → Messaging), « A message comes in » doit pointer vers{" "}
          <b style={{ color: "var(--text)", overflowWrap: "anywhere" }}>{adresseEntrant}</b> (HTTP POST) pour recevoir les réponses et les ARRET.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CHOIX.map((c) => (
            <div key={c.cle} style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 12 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input
                  type="checkbox" checked={reglages[c.cle]} disabled={enCours}
                  onChange={(e) => enregistrer({ ...reglages, [c.cle]: e.target.checked })}
                  style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{c.titre}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>{c.detail}</span>
                </span>
              </label>
              {c.cle === "rappelRdv" && reglages.rappelRdv && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 0 0 28px", fontSize: 13 }}>
                  Envoyé la veille à partir de
                  <select
                    value={reglages.heureRappel} disabled={enCours}
                    onChange={(e) => enregistrer({ ...reglages, heureRappel: Number(e.target.value) })}
                    className="champ" style={{ fontSize: 13, padding: "4px 8px", width: "auto" }}
                  >
                    {HEURES.map((h) => <option key={h} value={h}>{h} h</option>)}
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>
        {message && <p role={message.erreur ? "alert" : "status"} style={{ fontSize: 12.5, margin: "6px 0 0", color: message.erreur ? "var(--danger)" : "var(--success)" }}>{message.texte}</p>}

        <form onSubmit={essayer} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13.5, marginTop: 14 }}>
          Texto d&apos;essai au
          <input value={numeroEssai} onChange={(e) => setNumeroEssai(e.target.value)} inputMode="tel" placeholder="514 555-1234" aria-label="Numéro pour le texto d'essai" className="champ" style={{ width: 150, fontSize: 14 }} />
          <button type="submit" disabled={!numeroEssai.trim()} className="bouton-3d" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Envoyer</button>
        </form>
        {messageEssai && <p role={messageEssai.erreur ? "alert" : "status"} style={{ fontSize: 12.5, margin: "6px 0 0", color: messageEssai.erreur ? "var(--danger)" : "var(--success)" }}>{messageEssai.texte}</p>}

        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", margin: "16px 0 6px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, flex: 1 }}>Ce mois-ci</div>
          <Link href="/textos" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>Ouvrir les conversations →</Link>
        </div>
        <p style={{ fontSize: 13, margin: "0 0 10px" }}>
          {mois.envoyes} envoyé{mois.envoyes > 1 ? "s" : ""} · {mois.recus} reçu{mois.recus > 1 ? "s" : ""}
          {mois.echecs > 0 ? ` · ${mois.echecs} échec${mois.echecs > 1 ? "s" : ""}` : ""}
          <span style={{ color: "var(--text-muted)" }}> — environ {mois.segments} texto{mois.segments > 1 ? "s" : ""} facturé{mois.segments > 1 ? "s" : ""} par Twilio (un long message en compte plusieurs)</span>
          {nbRefus > 0 && <span style={{ color: "var(--text-muted)" }}> · {nbRefus} client{nbRefus > 1 ? "s ont" : " a"} répondu ARRET</span>}
        </p>
        {journal.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Aucun texto pour l&apos;instant.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {journal.map((t) => {
              const s = STATUTS_TEXTO[t.statut] || STATUTS_TEXTO.ENVOYE;
              return (
                <div key={t.id} style={{ fontSize: 13, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span aria-hidden>{t.direction === "ENTRANT" ? "↙" : "↗"}</span>
                    <b style={{ flex: 1, minWidth: 0 }}>{t.clientNom || numeroLisible(t.telephone)}</b>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{LIBELLES_TYPES[t.type] || t.type}</span>
                    <Pastille couleur={s.couleur} fond={s.fond}>{s.libelle}</Pastille>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                    {DATE_HEURE.format(new Date(t.creeLe))}{t.employeNom ? ` · ${t.employeNom}` : t.direction === "SORTANT" ? " · automatique" : ""} — {t.corps.length > 110 ? `${t.corps.slice(0, 110)}…` : t.corps}
                  </div>
                  {t.erreur && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 2 }}>{t.erreur}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
