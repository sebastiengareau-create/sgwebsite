"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LigneInfo } from "../../../components/ui";
import {
  STATUTS_BAIL, REPONSES_AVIS, argent, libelle, dateLisible, dureeMois, etatFinBail, fenetreAvis, hausseLisible, datesRenouvellement, servicesLisibles,
  soldeBail, releveBail, dateCourte,
} from "@/lib/immobilierCalculs";
import {
  Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, PastilleCode, PastilleEtat, Vide, Tableau, cellule, celluleDroite, aujourdhui, useApi, Erreur,
  ChampsFormulaire, boutonPrincipal, FormulaireBail, FormulaireDocument, ListeDocuments, champsPaiement, champsCharge, Solde, nomLogement, lien,
} from "../../ui";

export default function BailClient({ bail, locataires, suivant, precedent }) {
  const solde = soldeBail(bail);
  const etat = etatFinBail(bail);
  return (
    <div className="conteneur-page">
      <Retour href={`/immobilier/logements/${bail.logement.id}`}>{bail.logement.immeuble.nom} · {nomLogement(bail.logement)}</Retour>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, margin: "10px 0 6px", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>✍️ Bail — {bail.locataires.map((l) => l.nom).join(", ")}</h1>
        <span style={{ fontSize: 13 }}><Solde solde={solde} /></span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <PastilleCode liste={STATUTS_BAIL} code={bail.statut} />
        {bail.statut === "ACTIF" && <PastilleEtat etat={etat} />}
        {precedent && <Link href={`/immobilier/baux/${precedent.id}`} style={{ fontSize: 12, ...lien }}>← bail précédent ({argent(precedent.loyer)})</Link>}
        {suivant && <Link href={`/immobilier/baux/${suivant.id}`} style={{ fontSize: 12, ...lien }}>bail suivant ({argent(suivant.loyer)}) →</Link>}
      </div>
      <Details bail={bail} locataires={locataires} />
      {bail.statut === "ACTIF" && <Renouvellement bail={bail} etat={etat} />}
      <Compte bail={bail} />
      <Documents bail={bail} />
      {bail.statut === "ACTIF" && <Fin bail={bail} />}
    </div>
  );
}

function Details({ bail, locataires }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const duree = dureeMois(bail);
  return (
    <Section titre="Bail" droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
      {edition ? (
        <>
          <FormulaireBail cadre={false} initial={bail} locataires={locataires} onFini={() => setEdition(false)} />
          <div style={{ marginTop: 10 }}>
            <BoutonSupprimer url={`/api/immobilier/baux/${bail.id}`} confirmation="Supprimer ce bail ? Ses loyers inscrits disparaissent aussi (un bail avec des paiements ne peut pas être supprimé : termine-le plutôt)." onFini={() => router.push(`/immobilier/logements/${bail.logement.id}`)}>Supprimer le bail</BoutonSupprimer>
          </div>
        </>
      ) : (
        <>
          <LigneInfo label="Logement" valeur={<><Link href={`/immobilier/logements/${bail.logement.id}`} style={lien}>{nomLogement(bail.logement)}</Link>{bail.logement.pieces && ` · ${bail.logement.pieces}`}, {[bail.logement.immeuble.adresse, bail.logement.immeuble.ville].filter(Boolean).join(", ") || bail.logement.immeuble.nom}</>} />
          <LigneInfo label="Locataires" valeur={bail.locataires.map((l, i) => <span key={l.id}>{i > 0 && ", "}<Link href={`/immobilier/locataires/${l.id}`} style={lien}>{l.nom}</Link>{l.telephone && <span style={{ color: "var(--text-muted)" }}> ({l.telephone})</span>}</span>)} />
          <LigneInfo label="Début" valeur={dateLisible(bail.dateDebut)} />
          <LigneInfo label="Fin" valeur={bail.dateFin ? `${dateLisible(bail.dateFin)}${duree ? ` (${duree} mois)` : ""}` : "Durée indéterminée"} />
          <LigneInfo label="Loyer" valeur={`${argent(bail.loyer)} par mois, payable le ${bail.jourPaiement}`} />
          <LigneInfo label="Le loyer comprend" valeur={servicesLisibles(bail.services) || "—"} />
          {bail.terminaisonLe && <LigneInfo label="Départ" valeur={dateLisible(bail.terminaisonLe)} />}
          {bail.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{bail.notes}</p>}
        </>
      )}
    </Section>
  );
}

// Avis de modification et renouvellement (délais du Tribunal administratif du logement)
function Renouvellement({ bail, etat }) {
  const router = useRouter();
  const { appeler, enCours, erreur } = useApi();
  const f = fenetreAvis(bail);
  const champs = [
    { nom: "nouveauLoyer", label: "Nouveau loyer proposé ($)", type: "nombre" },
    { nom: "avisEnvoyeLe", label: "Avis envoyé le", type: "date" },
    { nom: "reponseAvis", label: "Réponse du locataire", type: "choix", vide: "— en attente —", options: REPONSES_AVIS },
  ];
  const initial = {
    nouveauLoyer: bail.nouveauLoyer != null ? String(bail.nouveauLoyer).replace(".", ",") : "",
    avisEnvoyeLe: bail.avisEnvoyeLe ? dateCourte(bail.avisEnvoyeLe) : "",
    reponseAvis: bail.reponseAvis || "",
  };
  const suite = bail.dateFin && datesRenouvellement(bail);
  async function renouveler() {
    const loyer = bail.nouveauLoyer ?? bail.loyer;
    if (!window.confirm(`Renouveler le bail du ${dateLisible(suite.dateDebut)} au ${dateLisible(suite.dateFin)} à ${argent(loyer)} par mois ? Le bail actuel passera à « Terminé ».`)) return;
    const data = await appeler(`/api/immobilier/baux/${bail.id}/renouveler`, "POST", { loyer });
    if (data) router.push(`/immobilier/baux/${data.id}`);
  }
  return (
    <Section titre="Renouvellement">
      {f ? (
        <p style={{ fontSize: 13, margin: "0 0 10px" }}>
          Bail de {f.longue ? "12 mois ou plus" : "moins de 12 mois"} : pour modifier le loyer ou une condition, l'avis doit être envoyé entre le <strong>{dateLisible(f.debut)}</strong> et le <strong>{dateLisible(f.fin)}</strong>.
          Le locataire a ensuite un mois pour répondre ; son silence vaut acceptation. Sans avis, le bail se reconduit aux mêmes conditions.
        </p>
      ) : (
        <p style={{ fontSize: 13, margin: "0 0 10px" }}>Bail à durée indéterminée : l'avis de modification s'envoie de un à deux mois avant la date de la modification.</p>
      )}
      <Formulaire cadre={false} champs={champs} initial={initial} url={`/api/immobilier/baux/${bail.id}`} methode="PATCH" bouton="Enregistrer l'avis" />
      {bail.nouveauLoyer != null && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "8px 0 0" }}>Hausse proposée : {hausseLisible(bail.loyer, bail.nouveauLoyer)}</p>}
      {suite && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          {bail.reponseAvis === "QUITTE"
            ? <p style={{ fontSize: 13, margin: 0 }}>Le locataire quitte à la fin du bail : termine le bail à son départ (plus bas), le logement redeviendra vacant.</p>
            : (
              <>
                <p style={{ fontSize: 13, margin: "0 0 8px" }}>
                  Renouveler crée le bail suivant ({dateLisible(suite.dateDebut)} → {dateLisible(suite.dateFin)}) à <strong>{argent(bail.nouveauLoyer ?? bail.loyer)}</strong>, avec les mêmes locataires et services.
                  {etat.code === "ECHU" && " La fin du bail est dépassée : renouvelle-le pour que les loyers des mois suivants s'inscrivent."}
                </p>
                <Erreur texte={erreur} />
                <button type="button" onClick={renouveler} disabled={enCours} className="bouton-3d" style={{ ...boutonPrincipal, width: "auto", padding: "10px 16px" }}>{enCours ? "…" : "🔁 Renouveler le bail"}</button>
              </>
            )}
        </div>
      )}
    </Section>
  );
}

function Compte({ bail }) {
  const [ajout, setAjout] = useState(null); // "PAIEMENT" | "CHARGE"
  const lignes = releveBail(bail);
  const solde = soldeBail(bail);
  const basculer = (x) => setAjout((v) => (v === x ? null : x));
  return (
    <Section titre="Compte" droite={<span style={{ display: "flex", gap: 12 }}><BoutonTexte onClick={() => basculer("PAIEMENT")}>+ Paiement</BoutonTexte><BoutonTexte onClick={() => basculer("CHARGE")}>+ Frais</BoutonTexte></span>}>
      {ajout === "PAIEMENT" && <Formulaire champs={champsPaiement} initial={{ date: aujourdhui(), montant: solde > 0 ? String(Math.min(solde, bail.loyer)).replace(".", ",") : String(bail.loyer).replace(".", ",") }} extra={{ bailId: bail.id }} url="/api/immobilier/paiements" bouton="Inscrire le paiement" onFini={() => setAjout(null)} />}
      {ajout === "CHARGE" && <Formulaire champs={champsCharge} initial={{ date: aujourdhui() }} extra={{ bailId: bail.id }} url="/api/immobilier/charges" bouton="Ajouter au compte" onFini={() => setAjout(null)} />}
      {lignes.length === 0 ? <Vide>Aucun loyer inscrit. Les loyers se génèrent chaque mois dans Loyers.</Vide> : (
        <Tableau entetes={["Date", "Détail", "Montant", "Solde", ""]} alignDroite={[2, 3]}>
          {[...lignes].reverse().map((l) => (
            <tr key={l.id}>
              <td style={{ ...cellule, whiteSpace: "nowrap" }}>{dateLisible(l.date)}</td>
              <td style={cellule}>{l.genre === "paiement" ? "💵 " : ""}{l.libelle}</td>
              <td style={{ ...celluleDroite, color: l.montant < 0 ? "var(--success)" : undefined }}>{l.montant < 0 ? `− ${argent(-l.montant)}` : argent(l.montant)}</td>
              <td style={{ ...celluleDroite, fontWeight: 700 }}>{argent(l.solde)}</td>
              <td style={{ ...cellule, textAlign: "right" }}>
                <BoutonSupprimer url={`/api/immobilier/${l.genre === "paiement" ? "paiements" : "charges"}/${l.id}`} confirmation={`Supprimer « ${l.libelle} » (${argent(Math.abs(l.montant))}) ?`}>✕</BoutonSupprimer>
              </td>
            </tr>
          ))}
        </Tableau>
      )}
    </Section>
  );
}

function Documents({ bail }) {
  const [ajout, setAjout] = useState(false);
  return (
    <Section titre="Documents du bail" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Document"}</BoutonTexte>}>
      {ajout && <FormulaireDocument fixe={{ bailId: bail.id, logementId: bail.logement.id }} categorie="BAIL" onFini={() => setAjout(false)} />}
      <ListeDocuments documents={bail.documents} vide="Dépose ici le bail signé, les avis et l'état des lieux." />
    </Section>
  );
}

// Fin du bail : départ du locataire (fin normale ou anticipée)
function Fin({ bail }) {
  const [ouvert, setOuvert] = useState(false);
  const [v, setV] = useState({ terminaisonLe: bail.dateFin ? dateCourte(bail.dateFin) : aujourdhui(), statut: "TERMINE" });
  const { appeler, enCours, erreur } = useApi();
  const champs = [
    { nom: "terminaisonLe", label: "Date du départ", type: "date" },
    { nom: "statut", label: "Fin", type: "choix", options: [{ code: "TERMINE", label: "Fin du bail (normale)" }, { code: "RESILIE", label: "Résiliation, cession ou départ anticipé" }] },
  ];
  async function terminer() {
    if (!window.confirm("Terminer ce bail ? Le logement redeviendra vacant. Les loyers déjà inscrits et le solde restent au compte.")) return;
    await appeler(`/api/immobilier/baux/${bail.id}`, "PATCH", v);
  }
  return (
    <Section titre="Fin du bail" droite={<BoutonTexte onClick={() => setOuvert((x) => !x)}>{ouvert ? "Annuler" : "Terminer le bail"}</BoutonTexte>}>
      {ouvert ? (
        <>
          <ChampsFormulaire champs={champs} valeurs={v} maj={(k, x) => setV((o) => ({ ...o, [k]: x }))} />
          <Erreur texte={erreur} />
          <button type="button" onClick={terminer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Terminer le bail"}</button>
        </>
      ) : <Vide>Au départ du locataire, termine le bail : le logement redevient vacant et l'historique reste.</Vide>}
    </Section>
  );
}
