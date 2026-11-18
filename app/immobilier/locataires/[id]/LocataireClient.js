"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LigneInfo } from "../../../components/ui";
import { STATUTS_BAIL, argent, dateLisible, etatFinBail } from "@/lib/immobilierCalculs";
import {
  Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, PastilleCode, PastilleEtat, Vide, valeursDe, champsLocataire, FormulaireDocument, ListeDocuments, ListeReparations,
  Solde, nomLogement, lien,
} from "../../ui";

export default function LocataireClient({ locataire, soldes }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const [ajoutDoc, setAjoutDoc] = useState(false);
  const solde = locataire.baux.reduce((s, b) => s + (soldes[b.id] || 0), 0);
  return (
    <div className="conteneur-page">
      <Retour href="/immobilier/locataires">Locataires</Retour>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, margin: "10px 0 14px", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>🧑 {locataire.nom}</h1>
        <span style={{ fontSize: 13 }}><Solde solde={solde} /></span>
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
            <LigneInfo label="Téléphone" valeur={locataire.telephone && <a href={`tel:${locataire.telephone}`} style={lien}>{locataire.telephone}</a>} />
            <LigneInfo label="Autre téléphone" valeur={locataire.telephone2} />
            <LigneInfo label="Courriel" valeur={locataire.courriel && <a href={`mailto:${locataire.courriel}`} style={lien}>{locataire.courriel}</a>} />
            <LigneInfo label="En cas d'urgence" valeur={locataire.contactUrgence} />
            {locataire.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{locataire.notes}</p>}
          </>
        )}
      </Section>

      <Section titre="Baux">
        {locataire.baux.length === 0 ? <Vide>Aucun bail. Le bail se crée depuis la fiche du logement.</Vide> : locataire.baux.map((b) => {
          const autres = b.locataires.filter((l) => l.id !== locataire.id);
          return (
            <Link key={b.id} href={`/immobilier/baux/${b.id}`} className="ligne-info ligne-pastilles" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
              <span style={{ minWidth: 0 }}>
                <strong>{b.logement.immeuble.nom} · {nomLogement(b.logement)}</strong>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}> · {dateLisible(b.dateDebut)} → {b.dateFin ? dateLisible(b.dateFin) : "indéterminée"} · {argent(b.loyer)}{autres.length > 0 && ` · avec ${autres.map((l) => l.nom).join(", ")}`}</span>
              </span>
              <span style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                {Math.abs(soldes[b.id] || 0) > 0.005 && <Solde solde={soldes[b.id]} />}
                {b.statut === "ACTIF" ? <PastilleEtat etat={etatFinBail(b)} /> : <PastilleCode liste={STATUTS_BAIL} code={b.statut} />}
              </span>
            </Link>
          );
        })}
      </Section>

      <Section titre="Réparations signalées">
        <ListeReparations reparations={locataire.reparations} vide="Aucune réparation signalée." />
      </Section>

      <Section titre="Documents" droite={<BoutonTexte onClick={() => setAjoutDoc((v) => !v)}>{ajoutDoc ? "Annuler" : "+ Document"}</BoutonTexte>}>
        {ajoutDoc && <FormulaireDocument fixe={{ locataireId: locataire.id }} categorie="LOCATAIRE" onFini={() => setAjoutDoc(false)} />}
        <ListeDocuments documents={locataire.documents} vide="Enquête de crédit, références, pièces d'identité…" />
      </Section>
    </div>
  );
}
