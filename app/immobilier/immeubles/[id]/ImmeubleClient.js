"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LigneInfo } from "../../../components/ui";
import {
  TYPES_IMMEUBLE, CATEGORIES_DEPENSE, argent, libelle, trouver, dateLisible, bailActuel, nomsLocataires, etatFinBail, rendement, tauxOccupation, STATUTS_REPARATION_OUVERTS,
} from "@/lib/immobilierCalculs";
import { champsImmeuble } from "../ImmeublesClient";
import {
  Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, Vide, Tableau, cellule, celluleDroite, valeursDe, aujourdhui, Statistique,
  champsLogement, champsDepense, FormulaireReparation, FormulaireDocument, ListeDocuments, ListeReparations, PastilleEtat, Solde, nomLogement, lien,
} from "../../ui";

export default function ImmeubleClient({ immeuble, soldes, comptes, donnees, annee, locataires }) {
  const type = trouver(TYPES_IMMEUBLE, immeuble.type);
  const { lignes } = rendement({ immeubles: [immeuble], ...donnees });
  const r = lignes[0];
  const baux = immeuble.logements.map(bailActuel).filter(Boolean);
  const loyers = baux.reduce((s, b) => s + b.loyer, 0);
  return (
    <div className="conteneur-page">
      <Retour href="/immobilier/immeubles">Immeubles</Retour>
      <h1 style={{ fontSize: 21, margin: "10px 0 14px" }}>{type?.icone} {immeuble.nom}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Statistique valeur={argent(loyers)} label="Loyers par mois" note={`${argent(loyers * 12)} par année`} teinte="var(--success)" />
        <Statistique valeur={`${String(tauxOccupation(immeuble.logements)).replace(".", ",")} %`} label={`Occupation · ${immeuble.logements.length} logement${immeuble.logements.length > 1 ? "s" : ""}`} teinte="var(--bleu)" />
        <Statistique valeur={argent(r.net)} label={`Net ${annee} (perçu − dépenses)`} teinte={r.net < 0 ? "var(--danger)" : "var(--success)"} />
        {immeuble.valeurEstimee > 0 && <Statistique valeur={argent(immeuble.valeurEstimee - (immeuble.soldeHypotheque || 0))} label="Avoir net (valeur − hypothèque)" teinte="var(--accent)" />}
      </div>
      <Fiche immeuble={immeuble} />
      <Logements immeuble={immeuble} soldes={soldes} comptes={comptes} />
      <Rendement r={r} annee={annee} />
      <Depenses immeuble={immeuble} />
      <Reparations immeuble={immeuble} locataires={locataires} />
      <Documents immeuble={immeuble} />
    </div>
  );
}

function Fiche({ immeuble }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  return (
    <Section titre="Fiche" droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
      {edition ? (
        <>
          <Formulaire cadre={false} champs={champsImmeuble} initial={valeursDe(immeuble, champsImmeuble)} url={`/api/immobilier/immeubles/${immeuble.id}`} methode="PATCH" onFini={() => setEdition(false)} />
          <div style={{ marginTop: 10 }}>
            <BoutonSupprimer url={`/api/immobilier/immeubles/${immeuble.id}`} confirmation={`Supprimer ${immeuble.nom} ? Ses dépenses, réparations et documents disparaissent aussi.`} onFini={() => router.push("/immobilier/immeubles")}>Supprimer l'immeuble</BoutonSupprimer>
          </div>
        </>
      ) : (
        <>
          <LigneInfo label="Adresse" valeur={[immeuble.adresse, immeuble.ville, immeuble.codePostal].filter(Boolean).join(", ")} />
          <LigneInfo label="Type" valeur={libelle(TYPES_IMMEUBLE, immeuble.type)} />
          <LigneInfo label="Construit en" valeur={immeuble.anneeConstruction} />
          {immeuble.entrepreneur && <LigneInfo label="Construit par" valeur={immeuble.entrepreneur} />}
          <LigneInfo label="Acheté le" valeur={immeuble.dateAchat && dateLisible(immeuble.dateAchat)} />
          <LigneInfo label="Prix d'achat" valeur={immeuble.prixAchat != null && argent(immeuble.prixAchat)} />
          <LigneInfo label="Évaluation municipale" valeur={immeuble.evaluationMunicipale != null && argent(immeuble.evaluationMunicipale)} />
          <LigneInfo label="Valeur estimée" valeur={immeuble.valeurEstimee != null && argent(immeuble.valeurEstimee)} />
          <LigneInfo label="Solde de l'hypothèque" valeur={immeuble.soldeHypotheque != null && argent(immeuble.soldeHypotheque)} />
          {immeuble.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{immeuble.notes}</p>}
        </>
      )}
    </Section>
  );
}

function Logements({ immeuble, soldes, comptes }) {
  const [ajout, setAjout] = useState(false);
  return (
    <Section titre="Logements" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Logement"}</BoutonTexte>}>
      {ajout && <Formulaire champs={champsLogement()} extra={{ immeubleId: immeuble.id }} url="/api/immobilier/logements" bouton="Ajouter le logement" onFini={() => setAjout(false)} />}
      {immeuble.logements.length === 0 ? <Vide>Aucun logement : ajoute les logements et locaux de l'immeuble.</Vide> : (
        <Tableau entetes={["Logement", "Locataires", "Loyer", "Fin du bail", "Solde"]} alignDroite={[2, 4]}>
          {immeuble.logements.map((l) => {
            const b = bailActuel(l);
            const etat = b && etatFinBail(b);
            return (
              <tr key={l.id}>
                <td style={cellule}><Link href={`/immobilier/logements/${l.id}`} style={{ ...lien, fontWeight: 700 }}>{nomLogement(l)}</Link>{l.pieces && <span style={{ color: "var(--text-muted)" }}> · {l.pieces}</span>}</td>
                <td style={cellule}>{b ? <Link href={`/immobilier/baux/${b.id}`} style={{ color: "inherit" }}>{nomsLocataires(b)}</Link> : <span style={{ color: "var(--accent)", fontWeight: 700 }}>Vacant{l.loyerVise ? ` · ${argent(l.loyerVise)}` : ""}</span>}</td>
                <td style={celluleDroite}>{b ? argent(b.loyer) : "—"}</td>
                <td style={cellule}>{b ? <>{b.dateFin ? dateLisible(b.dateFin) : "Indéterminée"}{etat && !["PLUS_TARD", "INDETERMINEE"].includes(etat.code) && <div><PastilleEtat etat={etat} /></div>}</> : "—"}</td>
                <td style={celluleDroite}>{b ? <Solde solde={soldes[b.id]} compte={comptes[b.id]} court /> : "—"}</td>
              </tr>
            );
          })}
        </Tableau>
      )}
    </Section>
  );
}

function Rendement({ r, annee }) {
  return (
    <Section titre={`Rendement ${annee}`}>
      <LigneInfo label="Loyers facturés" valeur={argent(r.facture)} />
      <LigneInfo label="Loyers perçus" valeur={argent(r.percu)} />
      <LigneInfo label="Dépenses" valeur={`− ${argent(r.depenses)}`} />
      <LigneInfo label="Réparations terminées" valeur={`− ${argent(r.reparations)}`} />
      <div className="ligne-info ligne-pastilles" style={{ fontWeight: 800 }}><span>Revenu net</span><span style={{ color: r.net < 0 ? "var(--danger)" : "var(--success)" }}>{argent(r.net)}</span></div>
    </Section>
  );
}

function Depenses({ immeuble }) {
  const [ajout, setAjout] = useState(false);
  const champs = champsDepense();
  return (
    <Section titre="Dernières dépenses" droite={<span style={{ display: "flex", gap: 12 }}><Link href={`/immobilier/depenses?immeuble=${immeuble.id}`} style={{ fontSize: 12, ...lien }}>Tout voir</Link><BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Dépense"}</BoutonTexte></span>}>
      {ajout && <Formulaire champs={champs} initial={{ date: aujourdhui() }} extra={{ immeubleId: immeuble.id }} url="/api/immobilier/depenses" bouton="Ajouter la dépense" onFini={() => setAjout(false)} />}
      {immeuble.depenses.length === 0 ? <Vide>Aucune dépense inscrite.</Vide> : immeuble.depenses.slice(0, 10).map((d) => (
        <div key={d.id} className="ligne-info ligne-pastilles" style={{ gap: 8 }}>
          <span style={{ minWidth: 0 }}>{trouver(CATEGORIES_DEPENSE, d.categorie)?.icone} {d.description || libelle(CATEGORIES_DEPENSE, d.categorie)} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {dateLisible(d.date)}{d.payeA && ` · ${d.payeA}`}</span></span>
          <span style={{ fontWeight: 700, flexShrink: 0 }}>{argent(d.montant)}</span>
        </div>
      ))}
    </Section>
  );
}

function Reparations({ immeuble, locataires }) {
  const [ajout, setAjout] = useState(false);
  const ouvertes = immeuble.reparations.filter((r) => STATUTS_REPARATION_OUVERTS.includes(r.statut));
  const fermees = immeuble.reparations.filter((r) => !STATUTS_REPARATION_OUVERTS.includes(r.statut));
  return (
    <Section titre="Réparations" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Réparation"}</BoutonTexte>}>
      {ajout && <FormulaireReparation immeubles={[immeuble]} locataires={locataires} fixe={{ immeubleId: immeuble.id }} />}
      <ListeReparations reparations={ouvertes} vide="Aucune réparation ouverte." lieu="logement" />
      {fermees.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 12.5, cursor: "pointer", color: "var(--text-muted)" }}>Historique ({fermees.length})</summary>
          <ListeReparations reparations={fermees} lieu="logement" />
        </details>
      )}
    </Section>
  );
}

function Documents({ immeuble }) {
  const [ajout, setAjout] = useState(false);
  return (
    <Section titre="Documents" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Document"}</BoutonTexte>}>
      {ajout && <FormulaireDocument fixe={{ immeubleId: immeuble.id }} categorie="ASSURANCE" onFini={() => setAjout(false)} />}
      <ListeDocuments documents={immeuble.documents} />
    </Section>
  );
}
