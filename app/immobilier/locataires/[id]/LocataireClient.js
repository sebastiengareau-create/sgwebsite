"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LigneInfo } from "../../../components/ui";
import { STATUTS_BAIL, argent, dateLisible, etatFinBail, additionnerComptes } from "@/lib/immobilierCalculs";
import {
  Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, PastilleCode, PastilleEtat, Vide, valeursDe, champsLocataire, FormulaireDocument, ListeDocuments, ListeReparations,
  Solde, nomLogement, lien as styleLien, useApi, Erreur, LigneMouvement,
} from "../../ui";

// Titre d'un bloc de la fiche (mêmes blocs que le formulaire)
function TitreBloc({ children, premier }) {
  return <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--text-muted)", margin: premier ? "0 0 6px" : "12px 0 6px", paddingTop: premier ? 0 : 10, borderTop: premier ? "none" : "1px solid var(--border)" }}>{children}</div>;
}

export default function LocataireClient({ locataire, comptes, lien, courrielConfigure }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const [ajoutDoc, setAjoutDoc] = useState(false);
  const compte = additionnerComptes(locataire.baux.map((b) => comptes[b.id]));
  return (
    <div className="conteneur-page">
      <Retour href="/immobilier/locataires">Locataires</Retour>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, margin: "10px 0 14px", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>🧑 {locataire.nom}</h1>
        <span style={{ fontSize: 13 }}><Solde compte={compte} /></span>
      </div>

      <Section titre="Coordonnées" droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
        {edition ? (
          <>
            <Formulaire cadre={false} champs={champsLocataire} initial={valeursDe(locataire, champsLocataire)} url={`/api/immobilier/locataires/${locataire.id}`} methode="PATCH" onFini={() => setEdition(false)} />
            <div style={{ marginTop: 10 }}>
              <BoutonSupprimer url={`/api/immobilier/locataires/${locataire.id}`} confirmation={`Supprimer ${locataire.nom} ?`} onFini={() => router.push("/immobilier/locataires")}>Supprimer le locataire</BoutonSupprimer>
            </div>
          </>
        ) : (
          <>
            <TitreBloc premier>Pour le joindre</TitreBloc>
            <LigneInfo label="Téléphone" valeur={locataire.telephone && <a href={`tel:${locataire.telephone}`} style={styleLien}>{locataire.telephone}</a>} />
            <LigneInfo label="Autre téléphone" valeur={locataire.telephone2} />
            <LigneInfo label="Courriel" valeur={locataire.courriel && <a href={`mailto:${locataire.courriel}`} style={styleLien}>{locataire.courriel}</a>} />
            <LigneInfo label="En cas d'urgence" valeur={locataire.contactUrgence} />
            <LigneInfo label="Suivi des réparations" valeur={locataire.avisCourriel ? "Par courriel" : "Pas de courriel"} />
            <TitreBloc>Adresse actuelle</TitreBloc>
            {locataire.adresse || locataire.ville
              ? <p style={{ fontSize: 13, margin: "0 0 4px", lineHeight: 1.5 }}>
                  {[locataire.adresse, locataire.appartement && `app. ${locataire.appartement}`].filter(Boolean).join(", ")}
                  <br />{[locataire.ville, locataire.province, locataire.codePostal].filter(Boolean).join(" ")}
                </p>
              : <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 4px" }}>Pas encore inscrite — elle va à la section A du bail (Modifier).</p>}
            {locataire.notes && <>
              <TitreBloc>Notes</TitreBloc>
              <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>{locataire.notes}</p>
            </>}
          </>
        )}
      </Section>

      <Portail l={locataire} lien={lien} courrielConfigure={courrielConfigure} />

      <Section titre="Baux">
        {locataire.baux.length === 0 ? <Vide>Aucun bail. Le bail se crée depuis la fiche du logement.</Vide> : locataire.baux.map((b) => {
          const autres = b.locataires.filter((l) => l.id !== locataire.id);
          return (
            <Link key={b.id} href={`/immobilier/baux/${b.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <LigneMouvement
                titre={<strong>{b.logement.immeuble.nom} · {nomLogement(b.logement)}</strong>}
                detail={`${dateLisible(b.dateDebut)} → ${b.dateFin ? dateLisible(b.dateFin) : "durée indéterminée"} · ${argent(b.loyer)} par mois${autres.length > 0 ? ` · avec ${autres.map((l) => l.nom).join(", ")}` : ""}`}
                montant={b.statut === "ACTIF" ? <PastilleEtat etat={etatFinBail(b)} /> : <PastilleCode liste={STATUTS_BAIL} code={b.statut} />}
                sousMontant={Math.abs(comptes[b.id]?.solde || 0) > 0.005 ? <Solde compte={comptes[b.id]} /> : null}
              />
            </Link>
          );
        })}
      </Section>

      <Section titre="Réparations signalées">
        <ListeReparations reparations={locataire.reparations} vide="Aucune réparation signalée." />
      </Section>

      <Section titre="Documents" droite={<BoutonTexte onClick={() => setAjoutDoc((v) => !v)}>{ajoutDoc ? "Annuler" : "+ Document"}</BoutonTexte>}>
        {ajoutDoc && <FormulaireDocument fixe={{ locataireId: locataire.id }} categorie="LOCATAIRE" onFini={() => setAjoutDoc(false)} />}
        <ListeDocuments documents={locataire.documents} envoi={courrielConfigure && Boolean(locataire.courriel)} vide="Enquête de crédit, références, pièces d'identité…" />
      </Section>
    </div>
  );
}

// Accès du locataire à son portail : lien secret à copier, envoyer, renouveler ou retirer
function Portail({ l, lien, courrielConfigure }) {
  const { appeler, enCours, erreur } = useApi();
  const [message, setMessage] = useState("");
  async function action(a, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    setMessage("");
    const r = await appeler(`/api/immobilier/locataires/${l.id}/portail`, "POST", { action: a });
    if (r && a === "envoyer") setMessage(`Lien envoyé à ${l.courriel}.`);
  }
  async function copier() {
    try { await navigator.clipboard.writeText(lien); setMessage("Lien copié."); } catch { setMessage(lien); }
  }
  return (
    <Section titre="Portail du locataire">
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Espace sécurisé par un lien personnel : son bail et son compte de loyer (avec ses reçus), les documents marqués « 👁 locataire », ses demandes de réparation et leur suivi, et sa réponse à un avis de modification du bail.
        {l.dernierAccesPortail && ` Dernière visite : ${dateLisible(l.dernierAccesPortail)}.`}
      </p>
      {lien ? (
        <>
          <div style={{ fontSize: 12, wordBreak: "break-all", background: "var(--surface-alt)", padding: "8px 10px", borderRadius: 8, marginBottom: 10 }}>{lien}</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <BoutonTexte onClick={copier}>Copier le lien</BoutonTexte>
            <a href={lien} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Ouvrir</a>
            {l.courriel && courrielConfigure && <BoutonTexte onClick={() => action("envoyer")} disabled={enCours}>Envoyer par courriel</BoutonTexte>}
            <BoutonTexte onClick={() => action("activer", "Créer un nouveau lien ? L'ancien ne fonctionnera plus.")} disabled={enCours}>Nouveau lien</BoutonTexte>
            <BoutonTexte couleur="var(--danger)" onClick={() => action("desactiver", "Retirer l'accès au portail ?")} disabled={enCours}>Retirer l'accès</BoutonTexte>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => action("activer")} disabled={enCours} className="bouton-3d" style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>Activer l'accès au portail</button>
      )}
      {message && <p style={{ fontSize: 12, color: "var(--success)", margin: "8px 0 0" }}>{message}</p>}
      <Erreur texte={erreur} />
    </Section>
  );
}
