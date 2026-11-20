"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LigneInfo } from "../../../components/ui";
import { TYPES_LOGEMENT, STATUTS_BAIL, argent, libelle, trouver, dateLisible, bailActuel, nomsLocataires, etatFinBail, servicesLisibles } from "@/lib/immobilierCalculs";
import {
  Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, PastilleCode, PastilleEtat, Vide, valeursDe, champsLogement, FormulaireBail, FormulaireReparation,
  FormulaireDocument, ListeDocuments, ListeReparations, Solde, nomLogement, lien,
} from "../../ui";

export default function LogementClient({ logement, locataires, soldes }) {
  const bail = bailActuel(logement);
  const type = trouver(TYPES_LOGEMENT, logement.type);
  return (
    <div className="conteneur-page">
      <Retour href={`/immobilier/immeubles/${logement.immeuble.id}`}>{logement.immeuble.nom}</Retour>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, margin: "10px 0 14px", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>{type?.icone} {nomLogement(logement)}{logement.pieces && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> · {logement.pieces}</span>}</h1>
        <span style={{ fontSize: 13, fontWeight: 700, color: bail ? "var(--success)" : "var(--accent)" }}>{bail ? `Loué · ${argent(bail.loyer)} / mois` : "Vacant"}</span>
      </div>
      <BailActuel logement={logement} bail={bail} locataires={locataires} soldes={soldes} />
      <Fiche logement={logement} />
      <Historique logement={logement} bail={bail} soldes={soldes} />
      <Reparations logement={logement} locataires={locataires} bail={bail} />
      <Documents logement={logement} bail={bail} />
    </div>
  );
}

function BailActuel({ logement, bail, locataires, soldes }) {
  const router = useRouter();
  const [nouveau, setNouveau] = useState(false);
  if (!bail) {
    return (
      <Section titre="Bail" droite={<BoutonTexte onClick={() => setNouveau((v) => !v)}>{nouveau ? "Annuler" : "+ Nouveau bail"}</BoutonTexte>}>
        {nouveau
          ? <FormulaireBail cadre={false} logementId={logement.id} locataires={locataires} loyerSuggere={logement.loyerVise} onFini={(d) => router.push(`/immobilier/baux/${d.id}`)} />
          : <Vide>Logement vacant{logement.loyerVise ? `, affiché à ${argent(logement.loyerVise)} par mois` : ""}. Crée le bail quand il sera loué.</Vide>}
      </Section>
    );
  }
  const etat = etatFinBail(bail);
  return (
    <Section titre="Bail en cours" droite={<Link href={`/immobilier/baux/${bail.id}`} style={{ fontSize: 12, ...lien, fontWeight: 700 }}>Ouvrir le bail →</Link>}>
      <LigneInfo label="Locataires" valeur={bail.locataires.map((l, i) => <span key={l.id}>{i > 0 && ", "}<Link href={`/immobilier/locataires/${l.id}`} style={lien}>{l.nom}</Link></span>)} />
      <LigneInfo label="Durée" valeur={`${dateLisible(bail.dateDebut)} → ${bail.dateFin ? dateLisible(bail.dateFin) : "indéterminée"}`} />
      <LigneInfo label="Loyer" valeur={`${argent(bail.loyer)} / mois, le ${bail.jourPaiement}`} />
      <LigneInfo label="Comprend" valeur={servicesLisibles(bail.services) || "—"} />
      <LigneInfo label="Compte" valeur={<Solde solde={soldes[bail.id]} />} />
      <div style={{ marginTop: 8 }}><PastilleEtat etat={etat} /></div>
    </Section>
  );
}

function Fiche({ logement }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const champs = champsLogement();
  return (
    <Section titre="Fiche du logement" droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
      {edition ? (
        <>
          <Formulaire cadre={false} champs={champs} initial={valeursDe(logement, champs)} url={`/api/immobilier/logements/${logement.id}`} methode="PATCH" onFini={() => setEdition(false)} />
          <div style={{ marginTop: 10 }}>
            <BoutonSupprimer url={`/api/immobilier/logements/${logement.id}`} confirmation={`Supprimer ${nomLogement(logement)} ?`} onFini={() => router.push(`/immobilier/immeubles/${logement.immeuble.id}`)}>Supprimer le logement</BoutonSupprimer>
          </div>
        </>
      ) : (
        <>
          <LigneInfo label="Type" valeur={libelle(TYPES_LOGEMENT, logement.type)} />
          <LigneInfo label="Pièces" valeur={logement.pieces} />
          <LigneInfo label="Étage" valeur={logement.etage} />
          <LigneInfo label="Superficie" valeur={logement.superficie && `${String(logement.superficie).replace(".", ",")} pi²`} />
          <LigneInfo label="Loyer demandé" valeur={logement.loyerVise != null && argent(logement.loyerVise)} />
          <LigneInfo label="Adresse du logement" valeur={logement.adresseCivique} />
          <LigneInfo label="N° de logement (relevé 31)" valeur={logement.numeroLogementRq} />
          {logement.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{logement.notes}</p>}
        </>
      )}
    </Section>
  );
}

function Historique({ logement, bail, soldes }) {
  const anciens = logement.baux.filter((b) => b.id !== bail?.id);
  if (anciens.length === 0) return null;
  return (
    <Section titre="Baux précédents">
      {anciens.map((b) => (
        <Link key={b.id} href={`/immobilier/baux/${b.id}`} className="ligne-info ligne-pastilles" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
          <span style={{ minWidth: 0 }}>{nomsLocataires(b)} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {dateLisible(b.dateDebut)} → {b.dateFin ? dateLisible(b.dateFin) : "—"} · {argent(b.loyer)}</span></span>
          <span style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {Math.abs(soldes[b.id] || 0) > 0.005 && <Solde solde={soldes[b.id]} />}
            <PastilleCode liste={STATUTS_BAIL} code={b.statut} />
          </span>
        </Link>
      ))}
    </Section>
  );
}

function Reparations({ logement, locataires, bail }) {
  const [ajout, setAjout] = useState(false);
  return (
    <Section titre="Réparations" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Réparation"}</BoutonTexte>}>
      {ajout && <FormulaireReparation immeubles={[]} locataires={bail ? bail.locataires : locataires} fixe={{ immeubleId: logement.immeuble.id, logementId: logement.id }} />}
      <ListeReparations reparations={logement.reparations} lieu="aucun" vide="Aucune réparation pour ce logement." />
    </Section>
  );
}

function Documents({ logement, bail }) {
  const [ajout, setAjout] = useState(false);
  return (
    <Section titre="Documents" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Document"}</BoutonTexte>}>
      {ajout && <FormulaireDocument fixe={{ logementId: logement.id, ...(bail ? { bailId: bail.id } : {}) }} categorie={bail ? "BAIL" : "ETAT_LIEUX"} onFini={() => setAjout(false)} />}
      <ListeDocuments documents={logement.documents} />
    </Section>
  );
}
