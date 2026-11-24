"use client";

import { useState } from "react";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { TEINTES, BoutonContour } from "../../components/StyleSection";
import { JOURS_RETARD_TAL } from "@/lib/immobilierCalculs";
import { NavImmo, Panneau, Interrupteur, useApi, Erreur, champStyle, lien } from "../ui";

const dateHeure = (d) => new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeStyle: "short", timeZone: "America/Toronto" }).format(new Date(d));

const liste = { fontSize: 13, margin: "0 0 0 18px", padding: 0, lineHeight: 1.65, color: "var(--text)" };
const note = { fontSize: 12.5, color: "var(--text-muted)", margin: "10px 0 0" };

export default function AutomatisationsClient({ reglages, dernier, courriel, notifications }) {
  const { appeler, enCours, erreur } = useApi();
  const [jours, setJours] = useState(String(reglages.joursRappel));
  const [resultat, setResultat] = useState(dernier);
  const basculer = (cle) => appeler("/api/immobilier/automatisations", "POST", { [cle]: !reglages[cle] });
  const joursModifies = Number(jours) !== reglages.joursRappel;

  async function verifier() {
    const data = await appeler("/api/immobilier/automatisations", "POST", { verifier: true });
    if (data?.resultat) setResultat(data.resultat);
  }

  return (
    <div className="conteneur-page">
      <BandeauSection icone="⚙️" titre="Automatisations" sousTitre="Ce que l'appli fait toute seule pour ton parc, une fois par jour." />
      <NavImmo actif="/immobilier/automatisations" />
      <Erreur texte={erreur} />

      <Panneau
        icone="calendrier" teinte={TEINTES.bleu} titre="Inscrire les loyers le 1er du mois"
        sousTitre={reglages.loyersAuto ? "Actif" : "Inactif — les loyers s'inscrivent à la main dans Loyers"}
        droite={<Interrupteur actif={reglages.loyersAuto} libelle="Inscrire les loyers tout seuls" onClick={() => basculer("loyersAuto")} disabled={enCours} />}
      >
        <ul style={liste}>
          <li>Le 1er de chaque mois, au matin, chaque bail en cours reçoit le loyer du mois, au prorata si le bail commence ou finit en cours de mois.</li>
          <li>Une seule fois par mois : un loyer que tu retires à la main n'est pas remis le lendemain. Un bail créé plus tard dans le mois s'inscrit dans <Link href="/immobilier/loyers" style={lien}>Loyers</Link>.</li>
          <li>Le loyer est « à recevoir » jusqu'au jour de paiement du bail, puis en retard dès le lendemain.</li>
        </ul>
      </Panneau>

      <Panneau
        icone="courriel" teinte={TEINTES.ambre} titre="Rappel aux locataires en retard"
        sousTitre={!courriel ? "L'envoi de courriel n'est pas configuré pour cette installation" : reglages.rappelRetard ? `Actif — ${reglages.joursRappel} jour${reglages.joursRappel > 1 ? "s" : ""} après l'échéance` : "Inactif"}
        droite={<Interrupteur actif={reglages.rappelRetard} libelle="Envoyer les rappels de retard" onClick={() => basculer("rappelRetard")} disabled={enCours || (!courriel && !reglages.rappelRetard)} />}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 10 }}>
          <span>Envoyer le rappel</span>
          <input type="number" min={1} max={60} value={jours} onChange={(e) => setJours(e.target.value)} aria-label="Jours après l'échéance" style={{ ...champStyle, width: 70, marginBottom: 0 }} />
          <span>jours après l'échéance du loyer impayé</span>
          {joursModifies && (
            <button type="button" onClick={() => appeler("/api/immobilier/automatisations", "POST", { joursRappel: jours })} disabled={enCours} className="bouton-3d" style={{ padding: "7px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
              {enCours ? "…" : "Enregistrer"}
            </button>
          )}
        </div>
        <ul style={liste}>
          <li>Les locataires du bail reçoivent par courriel un rappel poli avec leur relevé de compte en PDF et le lien de leur espace locataire.</li>
          <li>Un seul rappel par loyer impayé, seulement pour les baux en cours. Chaque rappel est consigné dans les courriels du bail (⏰), comme preuve d'envoi.</li>
          <li>Un locataire sans courriel n'est pas relancé : il paraît dans le résumé ci-dessous.</li>
        </ul>
        <p style={note}>La mise en demeure reste un geste à toi : elle se génère dans la fiche du bail, à envoyer par courrier recommandé.</p>
      </Panneau>

      <Panneau
        icone="cloche" teinte={TEINTES.vert} titre="M'aviser de ce qui demande une action"
        sousTitre={!notifications ? "Le module Notifications est désactivé (Administrateur → Modules)" : reglages.avisProprio ? "Actif — dans la cloche 🔔 et sur le téléphone" : "Inactif"}
        droite={<Interrupteur actif={reglages.avisProprio} libelle="Aviser le propriétaire" onClick={() => basculer("avisProprio")} disabled={enCours} />}
      >
        <p style={{ fontSize: 13, margin: "0 0 6px" }}>Un avis par jour au plus, et chaque situation une seule fois :</p>
        <ul style={liste}>
          <li>la période d'envoi d'un avis de modification s'ouvre, puis il en reste 15 jours ;</li>
          <li>un avis est sans réponse depuis plus d'un mois (le locataire est réputé accepter) ou il est refusé (un mois pour s'adresser au TAL) ;</li>
          <li>un bail arrive à sa fin et doit être renouvelé dans l'appli, ou sa fin est dépassée ;</li>
          <li>un loyer est en retard de plus de trois semaines ({JOURS_RETARD_TAL} jours) ;</li>
          <li>une assurance ou un contrat expire dans 60 jours ou est expiré ;</li>
          <li>et ce que les automatisations ont fait : loyers inscrits, rappels envoyés.</li>
        </ul>
        <p style={note}>Qui le reçoit : <Link href="/notifications" style={lien}>Notifications → Qui reçoit quoi</Link> (gérant et niveau 4 au départ).</p>
      </Panneau>

      <Panneau
        icone="horloge" teinte={TEINTES.neutre} titre="Dernière vérification"
        sousTitre={resultat?.le ? `${dateHeure(resultat.le)}${resultat.forcer ? " (lancée à la main)" : ""}` : "Pas encore faite"}
      >
        {resultat?.lignes?.length > 0 ? (
          <ul style={liste}>{resultat.lignes.map((l) => <li key={l}>{l}</li>)}</ul>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>La vérification se fait toute seule chaque jour, entre 8 h et 18 h.</p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <BoutonContour onClick={verifier} icone="echange">{enCours ? "Vérification…" : "Vérifier maintenant"}</BoutonContour>
          <span style={{ ...note, margin: 0, flex: "1 1 220px" }}>Fait tout de suite la vérification du jour ; rien n'est fait deux fois (loyers, rappels et avis déjà faits restent faits).</span>
        </div>
      </Panneau>
    </div>
  );
}
