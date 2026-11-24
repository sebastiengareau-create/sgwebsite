"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LigneInfo } from "../../../components/ui";
import {
  STATUTS_BAIL, REPONSES_AVIS, MODES_PAIEMENT, CHAUFFAGES, ANIMAUX, FUMEUR, argent, libelle, dateLisible, dureeMois, etatFinBail, fenetreAvis, hausseLisible,
  datesRenouvellement, servicesLisibles, soldeBail, releveBail, dateCourte, etatCompte, etatRetard,
} from "@/lib/immobilierCalculs";
import { champStyle, BoutonEnvoyer } from "../../ui";
import {
  Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, PastilleCode, PastilleEtat, Vide, Tableau, cellule, celluleDroite, aujourdhui, useApi, Erreur,
  ChampsFormulaire, boutonPrincipal, FormulaireBail, FormulaireDocument, ListeDocuments, champsPaiement, champsCharge, Solde, nomLogement, lien,
} from "../../ui";

export default function BailClient({ bail, locataires, suivant, precedent, courriel }) {
  // Envoi par courriel possible : configuré, et au moins un locataire a un courriel
  const envoi = courriel && bail.locataires.some((l) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.courriel || ""));
  const compte = etatCompte(bail);
  const etat = etatFinBail(bail);
  return (
    <div className="conteneur-page">
      <Retour href={`/immobilier/logements/${bail.logement.id}`}>{bail.logement.immeuble.nom} · {nomLogement(bail.logement)}</Retour>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, margin: "10px 0 6px", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>✍️ Bail — {bail.locataires.map((l) => l.nom).join(", ")}</h1>
        <span style={{ fontSize: 13 }}><Solde compte={compte} /></span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <PastilleCode liste={STATUTS_BAIL} code={bail.statut} />
        {bail.statut === "ACTIF" && <PastilleEtat etat={etat} />}
        <PastilleEtat etat={etatRetard(compte)} />
        {precedent && <Link href={`/immobilier/baux/${precedent.id}`} style={{ fontSize: 12, ...lien }}>← bail précédent ({argent(precedent.loyer)})</Link>}
        {suivant && <Link href={`/immobilier/baux/${suivant.id}`} style={{ fontSize: 12, ...lien }}>bail suivant ({argent(suivant.loyer)}) →</Link>}
      </div>
      <Details bail={bail} locataires={locataires} />
      {bail.statut === "ACTIF" && <Renouvellement bail={bail} etat={etat} />}
      <Compte bail={bail} envoi={envoi} />
      <EtatsLieux bail={bail} />
      <GenerateurDocuments bail={bail} envoi={envoi} />
      <Documents bail={bail} envoi={envoi} />
      <Envois bail={bail} courriel={courriel} envoi={envoi} />
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
          <Mentions bail={bail} />
          {bail.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}><span style={{ color: "var(--text-muted)" }}>Notes internes : </span>{bail.notes}</p>}
        </>
      )}
    </Section>
  );
}

// Mentions du bail complet remplies (sections B à G du formulaire du TAL)
function Mentions({ bail }) {
  const [tout, setTout] = useState(false);
  const lignes = [
    ["Accessoires", bail.accessoires],
    ["Usage", bail.usageMixte ? "Habitation et usage professionnel ou commercial" : null],
    ["Paiement", [bail.modePaiement && libelle(MODES_PAIEMENT, bail.modePaiement), bail.lieuPaiement, bail.chequesPostdates && "chèques postdatés acceptés", bail.premierPaiementLe && `1er paiement le ${dateLisible(bail.premierPaiementLe)}`].filter(Boolean).join(" · ")],
    ["Chauffage", bail.chauffage && libelle(CHAUFFAGES, bail.chauffage)],
    ["Animaux", bail.animaux && libelle(ANIMAUX, bail.animaux)],
    ["Tabac", bail.fumeur && libelle(FUMEUR, bail.fumeur)],
    ["Assurance", bail.assuranceResponsabilite ? "Responsabilité civile exigée" : null],
    ["Règlement", bail.reglementRemisLe && `Remis le ${dateLisible(bail.reglementRemisLe)}`],
    ["Travaux promis", bail.travauxPromis],
    ["Conditions", bail.conditions],
    ["Immeuble neuf (F)", bail.immeubleNeuf ? `Oui${bail.hausseMaximaleF ? ` — hausse maximale : ${bail.hausseMaximaleF}` : " — hausse maximale à indiquer"}` : null],
    ["Loyer antérieur (G)", bail.loyerAncien != null ? `${argent(bail.loyerAncien)}${bail.loyerAncienNote ? ` — ${bail.loyerAncienNote}` : ""}` : bail.loyerAncienNote],
    ["Caution", bail.caution],
  ].filter(([, v]) => v);
  if (lignes.length === 0) return <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "8px 0 0" }}>Mentions du bail complet (accessoires, animaux, règlement, sections F et G…) : à remplir dans Modifier, pour générer le bail de logement.</p>;
  return (
    <>
      {(tout ? lignes : lignes.slice(0, 4)).map(([l, v]) => <LigneInfo key={l} label={l} valeur={<span style={{ whiteSpace: "pre-wrap" }}>{v}</span>} />)}
      {lignes.length > 4 && <BoutonTexte onClick={() => setTout((x) => !x)}>{tout ? "Moins de détails" : `Toutes les mentions du bail (${lignes.length})`}</BoutonTexte>}
    </>
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
      {bail.logement.type === "LOGEMENT" && !bail.avisEnvoyeLe && (
        <p style={{ fontSize: 13, margin: "0 0 10px" }}>
          <Link href={`/immobilier/immeubles/${bail.logement.immeuble.id}/hausses?bail=${bail.id}`} style={{ ...lien, fontWeight: 700 }}>🧮 Calculer la hausse selon la méthode du TAL</Link>
          <span style={{ color: "var(--text-muted)" }}> — pourcentage de base, taxes, assurances et travaux de l'immeuble ; le nouveau loyer s'inscrit ici.</span>
        </p>
      )}
      <Formulaire cadre={false} champs={champs} initial={initial} url={`/api/immobilier/baux/${bail.id}`} methode="PATCH" bouton="Enregistrer l'avis" />
      {bail.nouveauLoyer != null && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "8px 0 0" }}>Hausse proposée : {hausseLisible(bail.loyer, bail.nouveauLoyer)}</p>}
      {bail.reponseAvisLe && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid var(--success)", background: "var(--bg)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {bail.reponseAvisSignature && <img src={bail.reponseAvisSignature} alt="Signature" style={{ width: 150, height: "auto", background: "#fff", border: "1px solid var(--border)", borderRadius: 8 }} />}
          <span style={{ fontSize: 13 }}>
            ✍️ <strong>{libelle(REPONSES_AVIS, bail.reponseAvis)}</strong> — réponse signée en ligne par <strong>{bail.reponseAvisPar}</strong> le {new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeStyle: "short", timeZone: "America/Toronto" }).format(new Date(bail.reponseAvisLe))}
            {bail.reponseAvisIp && <span style={{ color: "var(--text-muted)", fontSize: 12 }}> · IP {bail.reponseAvisIp}</span>}
          </span>
        </div>
      )}
      {f && bail.nouveauLoyer != null && <BoutonAvis bail={bail} />}
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

function Compte({ bail, envoi }) {
  const [ajout, setAjout] = useState(null); // "PAIEMENT" | "CHARGE"
  const lignes = releveBail(bail);
  const solde = soldeBail(bail);
  const basculer = (x) => setAjout((v) => (v === x ? null : x));
  return (
    <Section titre="Compte" droite={<span style={{ display: "flex", gap: 12 }}><BoutonTexte onClick={() => basculer("PAIEMENT")}>+ Paiement</BoutonTexte><BoutonTexte onClick={() => basculer("CHARGE")}>+ Frais</BoutonTexte></span>}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <a href={`/api/immobilier/baux/${bail.id}/releve`} target="_blank" rel="noreferrer" style={{ ...lien, fontSize: 12, fontWeight: 700 }}>📄 Relevé de compte (PDF)</a>
        {envoi && <BoutonEnvoyer url={`/api/immobilier/baux/${bail.id}/releve`} confirmation="Envoyer le relevé de compte des 12 derniers mois par courriel aux locataires ?">✉️ Envoyer le relevé par courriel</BoutonEnvoyer>}
      </div>
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
              <td style={{ ...cellule, textAlign: "right", whiteSpace: "nowrap" }}>
                {l.genre === "paiement" && <><a href={`/api/immobilier/paiements/${l.id}/recu`} target="_blank" rel="noreferrer" style={{ ...lien, fontSize: 12, fontWeight: 700 }} title="Reçu de loyer (PDF)">🧾 Reçu</a>{envoi && <>{" "}<BoutonEnvoyer url={`/api/immobilier/paiements/${l.id}/recu`} confirmation="Envoyer ce reçu par courriel aux locataires ?">✉️</BoutonEnvoyer></>}{" · "}</>}
                <BoutonSupprimer url={`/api/immobilier/${l.genre === "paiement" ? "paiements" : "charges"}/${l.id}`} confirmation={`Supprimer « ${l.libelle} » (${argent(Math.abs(l.montant))}) ?`}>✕</BoutonSupprimer>
              </td>
            </tr>
          ))}
        </Tableau>
      )}
    </Section>
  );
}

function Documents({ bail, envoi }) {
  const [ajout, setAjout] = useState(false);
  return (
    <Section titre="Documents du bail" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Document"}</BoutonTexte>}>
      {ajout && <FormulaireDocument fixe={{ bailId: bail.id, logementId: bail.logement.id }} categorie="BAIL" onFini={() => setAjout(false)} />}
      <ListeDocuments documents={bail.documents} envoi={envoi} signataires={bail.locataires} vide="Dépose ici le bail signé, les avis et l'état des lieux, ou génère le bail de logement plus haut." />
    </Section>
  );
}

// États des lieux numériques du bail (lib/etatsLieux.js) : à l'entrée et à
// la sortie, remplis sur place au téléphone, avec photos
function EtatsLieux({ bail }) {
  const router = useRouter();
  const { appeler, enCours, erreur } = useApi();
  const liste = bail.etatsLieux || [];
  const commencer = async (moment) => {
    const data = await appeler(`/api/immobilier/baux/${bail.id}/etats-lieux`, "POST", { moment });
    if (data) router.push(`/immobilier/etats-lieux/${data.id}`);
  };
  const aEntree = liste.some((e) => e.moment === "ENTREE");
  return (
    <Section titre="États des lieux" droite={
      <span style={{ display: "flex", gap: 12 }}>
        <BoutonTexte disabled={enCours} onClick={() => commencer("ENTREE")}>+ Entrée</BoutonTexte>
        <BoutonTexte disabled={enCours} onClick={() => commencer("SORTIE")}>+ Sortie</BoutonTexte>
      </span>
    }>
      <Erreur texte={erreur} />
      {liste.length === 0 ? (
        <Vide>Fais l'état des lieux sur place, au téléphone : pièce par pièce, l'état de chaque élément et des photos. Il devient un PDF à faire signer en ligne. À la sortie, l'appli reprend la grille de l'entrée et montre ce qui s'est dégradé.</Vide>
      ) : liste.map((e) => (
        <Link key={e.id} href={`/immobilier/etats-lieux/${e.id}`} className="ligne-info ligne-pastilles" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
          <span>📋 <strong>{e.moment === "SORTIE" ? "Sortie" : "Entrée"}</strong> <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {dateLisible(e.date)}{e._count?.photos ? ` · ${e._count.photos} photo${e._count.photos > 1 ? "s" : ""}` : ""}</span></span>
          <PastilleEtat etat={e.statut === "TERMINE" ? { label: "Terminé", couleur: "#6FA96B" } : { label: "En cours", couleur: "#D98A2B" }} />
        </Link>
      ))}
      {liste.length > 0 && !aEntree && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>Sans état des lieux d'entrée dans l'appli, la sortie ne peut pas être comparée.</p>}
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

// Ouvre un document généré dans un nouvel onglet (fenêtre ouverte avant l'appel :
// sinon le navigateur bloque la fenêtre surgissante)
async function generer(appeler, bailId, corps) {
  const fenetre = window.open("", "_blank");
  const data = await appeler(`/api/immobilier/baux/${bailId}/documents`, "POST", corps);
  if (data && fenetre) fenetre.location.href = `/api/immobilier/documents/${data.id}`;
  else fenetre?.close();
  return data;
}

function BoutonAvis({ bail }) {
  const { appeler, enCours, erreur } = useApi();
  return (
    <div style={{ marginTop: 8 }}>
      <BoutonTexte disabled={enCours} onClick={() => generer(appeler, bail.id, { type: "AVIS_MODIFICATION", nouveauLoyer: bail.nouveauLoyer, dateAvis: bail.avisEnvoyeLe ? dateCourte(bail.avisEnvoyeLe) : aujourdhui() })}>
        {enCours ? "…" : "📄 Générer l'avis de modification (PDF)"}
      </BoutonTexte>
      <Erreur texte={erreur} />
    </div>
  );
}

// signature : se fait signer en ligne (lib/signatureImmo.js)
const TYPES_GENERES = [
  { code: "BAIL_LOGEMENT", label: "Bail de logement complet (à faire signer)", signature: true },
  { code: "AVIS_MODIFICATION", label: "Avis de modification du bail (hausse de loyer)", actif: true, signature: true },
  { code: "AVIS_ACCES", label: "Avis d'accès au logement (24 h)" },
  { code: "RAPPEL_RETARD", label: "Rappel de loyer en retard", retard: true },
  { code: "MISE_EN_DEMEURE", label: "Mise en demeure de payer", retard: true },
  { code: "ETAT_LIEUX", label: "État des lieux papier (grille vierge à imprimer)" },
  { code: "AVIS_REPRISE", label: "Avis de reprise du logement", actif: true },
  { code: "FICHE_BAIL", label: "Fiche de bail (pour remplir le formulaire officiel du TAL)" },
];

const MOTIFS = [
  { code: "VERIFICATION", label: "Vérifier l'état du logement" },
  { code: "TRAVAUX", label: "Effectuer des travaux" },
  { code: "VISITE_LOCATAIRE", label: "Visite d'un locataire éventuel" },
  { code: "VISITE_ACHETEUR", label: "Visite d'un acheteur éventuel" },
];

// Délai d'avis de reprise : 6 mois avant la fin (bail de plus de 6 mois ou
// indéterminé), 1 mois sinon
function limiteReprise(bail) {
  if (!bail.dateFin) return null;
  const duree = dureeMois(bail) ?? 12;
  const lendemain = new Date(new Date(bail.dateFin).getTime() + 86400000);
  return { date: new Date(new Date(lendemain).setUTCMonth(lendemain.getUTCMonth() - (duree > 6 ? 6 : 1))), mois: duree > 6 ? 6 : 1 };
}

function GenerateurDocuments({ bail, envoi }) {
  const [envoyer, setEnvoyer] = useState(false);
  const [faireSigner, setFaireSigner] = useState(true);
  const [type, setType] = useState("");
  const [v, setV] = useState({});
  const { appeler, enCours, erreur, setErreur } = useApi();
  // Rappel et mise en demeure : seulement s'il y a un montant en retard (pas un loyer pas encore échu)
  const enRetard = etatCompte(bail).enRetard;
  const offerts = TYPES_GENERES.filter((t) => (!t.actif || bail.statut === "ACTIF") && (!t.retard || enRetard > 0.005) && (t.code !== "AVIS_MODIFICATION" || bail.dateFin));
  const maj = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const fin = bail.dateFin ? dateCourte(bail.dateFin) : "";
  const choisir = (code) => {
    setType(code);
    setErreur("");
    const auj = aujourdhui();
    setV({
      dateAvis: auj,
      ...(code === "AVIS_MODIFICATION" ? { nouveauLoyer: String(bail.nouveauLoyer ?? bail.loyer).replace(".", ","), duree: String(dureeMois(bail) || 12), autresModifications: "" } : {}),
      ...(code === "AVIS_ACCES" ? { dateAcces: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), heure: "entre 10 h et 12 h", motif: "VERIFICATION", details: "" } : {}),
      ...(code === "RAPPEL_RETARD" || code === "MISE_EN_DEMEURE" ? { delaiJours: "10" } : {}),
      ...(code === "ETAT_LIEUX" ? { moment: bail.statut === "ACTIF" && new Date(bail.dateDebut) > new Date(Date.now() - 60 * 86400000) ? "ENTREE" : "SORTIE", dateVisite: auj } : {}),
      ...(code === "AVIS_REPRISE" ? { beneficiaire: "", lien: "", dateReprise: fin ? dateCourte(new Date(new Date(bail.dateFin).getTime() + 86400000)) : "" } : {}),
    });
  };
  const champs = {
    AVIS_MODIFICATION: [
      { nom: "nouveauLoyer", label: "Nouveau loyer ($ / mois)", type: "nombre" },
      { nom: "duree", label: "Durée du bail reconduit (mois)", type: "nombre" },
      { nom: "dateAvis", label: "Date de l'avis", type: "date" },
      { nom: "autresModifications", label: "Autre modification (facultatif)", type: "long", lignes: 2 },
    ],
    AVIS_ACCES: [
      { nom: "motif", label: "Motif", type: "choix", options: MOTIFS },
      { nom: "dateAcces", label: "Date de la visite", type: "date" },
      { nom: "heure", label: "Heure", placeholder: "entre 10 h et 12 h" },
      { nom: "dateAvis", label: "Date de l'avis", type: "date" },
      { nom: "details", label: "Précisions (travaux, entrepreneur…)", type: "long", lignes: 2 },
    ],
    RAPPEL_RETARD: [{ nom: "delaiJours", label: "Délai pour payer (jours)", type: "nombre" }, { nom: "dateAvis", label: "Date", type: "date" }],
    MISE_EN_DEMEURE: [{ nom: "delaiJours", label: "Délai pour payer (jours)", type: "nombre" }, { nom: "dateAvis", label: "Date", type: "date" }],
    ETAT_LIEUX: [{ nom: "moment", label: "Moment", type: "choix", options: [{ code: "ENTREE", label: "À l'entrée du locataire" }, { code: "SORTIE", label: "À la sortie du locataire" }] }, { nom: "dateVisite", label: "Date de la visite", type: "date" }],
    AVIS_REPRISE: [
      { nom: "beneficiaire", label: "Qui habitera le logement" },
      { nom: "lien", label: "Lien avec le propriétaire", placeholder: "moi-même, ma fille…" },
      { nom: "dateReprise", label: "Date de la reprise", type: "date" },
      { nom: "dateAvis", label: "Date de l'avis", type: "date" },
    ],
    FICHE_BAIL: [{ nom: "dateAvis", label: "Date", type: "date" }],
    BAIL_LOGEMENT: [{ nom: "dateAvis", label: "Date du bail", type: "date" }, { nom: "lieu", label: "Signé à (ville)", placeholder: "Saint-Jean-sur-Richelieu" }],
  }[type] || [];
  const def = TYPES_GENERES.find((t) => t.code === type);
  const signer = Boolean(def?.signature && faireSigner);
  // Bail de logement : mentions importantes encore vides
  const manquantes = type === "BAIL_LOGEMENT" ? [
    !bail.immeubleNeuf && bail.loyerAncien == null && !bail.loyerAncienNote && "le loyer le plus bas des 12 derniers mois (section G)",
    bail.immeubleNeuf && !bail.hausseMaximaleF && "la hausse maximale de loyer de l'immeuble neuf (section F)",
    !bail.modePaiement && "le mode de paiement",
  ].filter(Boolean) : [];

  const lim = type === "AVIS_REPRISE" && limiteReprise(bail);
  const fenetre = type === "AVIS_MODIFICATION" && fenetreAvis(bail);
  return (
    <Section titre="Générer un document">
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Bail complet et lettres prêts à imprimer, à envoyer ou à faire signer en ligne, remplis avec les données du bail et rangés dans ses documents. Le suivi des signatures se fait dans Documents du bail.
      </p>
      <select value={type} onChange={(e) => choisir(e.target.value)} style={{ ...champStyle, marginBottom: 10 }}>
        <option value="">— Choisir un document —</option>
        {offerts.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
      </select>
      {type && (
        <>
          {fenetre && <p style={{ fontSize: 12.5, margin: "0 0 8px" }}>À envoyer entre le <strong>{dateLisible(fenetre.debut)}</strong> et le <strong>{dateLisible(fenetre.fin)}</strong>. Le bail sera noté « avis envoyé » à la date de l'avis.</p>}
          {lim && <p style={{ fontSize: 12.5, margin: "0 0 8px" }}>À envoyer au moins {lim.mois} mois avant la fin du bail, au plus tard le <strong>{dateLisible(lim.date)}</strong>. La reprise ne peut prendre effet qu'à la fin du bail.</p>}
          {type === "MISE_EN_DEMEURE" && <p style={{ fontSize: 12.5, margin: "0 0 8px" }}>Envoie-la par courrier recommandé et garde la preuve de réception : elle servira au TAL.</p>}
          {type === "BAIL_LOGEMENT" && (
            <p style={{ fontSize: 12.5, margin: "0 0 8px" }}>
              Le bail reprend les sections A à H du formulaire obligatoire du TAL, remplies avec la fiche du bail et ses mentions (Bail → Modifier → Mentions du bail complet).
              {manquantes.length > 0 && <strong style={{ color: "var(--danger)" }}> À compléter avant : {manquantes.join(", ")}.</strong>}
            </p>
          )}
          <ChampsFormulaire champs={champs} valeurs={v} maj={maj} />
          {def?.signature && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={faireSigner} onChange={(e) => setFaireSigner(e.target.checked)} />
              {type === "AVIS_MODIFICATION" ? "Demander aux locataires une réponse signée en ligne" : "Faire signer en ligne par les locataires et le locateur"}{envoi ? " (lien envoyé par courriel, PDF joint)" : " (liens à transmettre)"}
            </label>
          )}
          {envoi && !signer && type !== "FICHE_BAIL" && type !== "ETAT_LIEUX" && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={envoyer} onChange={(e) => setEnvoyer(e.target.checked)} /> Envoyer aussi par courriel aux locataires (PDF joint)
            </label>
          )}
          {envoyer && !signer && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>Le courriel est une preuve écrite d'envoi, consignée ci-dessous. Pour une mise en demeure ou si le locataire conteste la réception, envoie aussi une copie par courrier recommandé.</p>}
          <Erreur texte={erreur} />
          <button type="button" disabled={enCours} onClick={async () => { if (await generer(appeler, bail.id, { type, ...v, faireSigner: signer, envoyer: !signer && envoyer && type !== "FICHE_BAIL" && type !== "ETAT_LIEUX" })) { setType(""); setEnvoyer(false); } }} className="bouton-3d" style={boutonPrincipal}>
            {enCours ? "Préparation…" : "📄 Générer le PDF"}
          </button>
        </>
      )}
    </Section>
  );
}

const TYPES_ENVOI = { DOCUMENT: "📄", RELEVE: "📊", RECU: "🧾", SIGNATURE: "✍️", RAPPEL: "⏰" };

// Journal des courriels envoyés : la preuve d'envoi
function Envois({ bail, courriel, envoi }) {
  if (!courriel) {
    return (
      <Section titre="Courriels aux locataires">
        <Vide>L'envoi de courriel n'est pas configuré pour cette installation : télécharge les PDF et envoie-les toi-même, ou demande à l'administrateur de configurer l'envoi.</Vide>
      </Section>
    );
  }
  return (
    <Section titre="Courriels envoyés">
      {!envoi && <Vide>Aucun locataire de ce bail n'a de courriel : ajoute-le à sa fiche pour lui envoyer avis, relevés et reçus.</Vide>}
      {bail.envois.length === 0 ? (envoi && <Vide>Aucun courriel envoyé pour ce bail.</Vide>) : bail.envois.map((e) => (
        <div key={e.id} className="ligne-info ligne-pastilles" style={{ gap: 8 }}>
          <span style={{ minWidth: 0 }}>
            {TYPES_ENVOI[e.type]} {e.sujet}
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}> · {new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }).format(new Date(e.date))} · à {e.destinataires}{e.envoyePar && ` · par ${e.envoyePar}`}</span>
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: e.erreur ? "var(--danger)" : "var(--success)" }} title={e.erreur || ""}>{e.erreur ? "⚠️ échec" : "✓ envoyé"}</span>
        </div>
      ))}
    </Section>
  );
}
