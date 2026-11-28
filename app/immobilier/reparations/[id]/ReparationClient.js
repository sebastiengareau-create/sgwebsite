"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LigneInfo } from "../../../components/ui";
import { PRIORITES, STATUTS_REPARATION, CATEGORIES_REPARATION, argent, libelle, dateLisible } from "@/lib/immobilierCalculs";
import {
  Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, PastilleCode, valeursDe, champsReparation, ListeFichiers, EnvoiFichiers, useApi, nomLogement, lien,
} from "../../ui";

// Prochaine étape proposée selon l'état
const SUITE = { NOUVELLE: ["PLANIFIEE", "📅 Planifiée"], PLANIFIEE: ["EN_COURS", "🔧 Commencée"], EN_COURS: ["TERMINEE", "✅ Terminée"] };

export default function ReparationClient({ reparation: r, locataires, fournisseurs, facture }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const { appeler, enCours } = useApi();
  const champs = champsReparation({ immeubles: [r.immeuble], locataires, immeubleId: r.immeubleId, fixe: { immeubleId: r.immeubleId }, fournisseurs });
  const suite = SUITE[r.statut];
  return (
    <div className="conteneur-page">
      <Retour href="/immobilier/reparations">Réparations</Retour>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, margin: "10px 0 6px", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>🛠️ {r.numero} · {r.titre}</h1>
        {suite && <button type="button" onClick={() => appeler(`/api/immobilier/reparations/${r.id}`, "PATCH", { statut: suite[0] })} disabled={enCours} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}>{enCours ? "…" : suite[1]}</button>}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <PastilleCode liste={PRIORITES} code={r.priorite} />
        <PastilleCode liste={STATUTS_REPARATION} code={r.statut} />
        {r.source === "PORTAIL" && <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "var(--surface-alt)" }}>🌐 Demandée dans le portail</span>}
      </div>

      <Section titre="Réparation" droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
        {edition ? (
          <>
            <Formulaire cadre={false} champs={champs} initial={valeursDe(r, champs)} url={`/api/immobilier/reparations/${r.id}`} methode="PATCH" onFini={() => setEdition(false)} />
            <div style={{ marginTop: 10 }}>
              <BoutonSupprimer url={`/api/immobilier/reparations/${r.id}`} confirmation={`Supprimer la réparation ${r.numero} et ses photos ?`} onFini={() => router.push("/immobilier/reparations")}>Supprimer la réparation</BoutonSupprimer>
            </div>
          </>
        ) : (
          <>
            <LigneInfo label="Lieu" valeur={<><Link href={`/immobilier/immeubles/${r.immeuble.id}`} style={lien}>{r.immeuble.nom}</Link> · {r.logement ? <Link href={`/immobilier/logements/${r.logement.id}`} style={lien}>{nomLogement(r.logement)}</Link> : "parties communes"}</>} />
            <LigneInfo label="Catégorie" valeur={r.categorie && libelle(CATEGORIES_REPARATION, r.categorie)} />
            <LigneInfo label="Signalée par" valeur={r.locataire ? <><Link href={`/immobilier/locataires/${r.locataire.id}`} style={lien}>{r.locataire.nom}</Link>{r.locataire.telephone && ` (${r.locataire.telephone})`}</> : r.signalePar} />
            <LigneInfo label="Signalée le" valeur={dateLisible(r.creeLe)} />
            <LigneInfo label="Entrepreneur" valeur={r.entrepreneur && <>{r.entrepreneur}{r.telephoneEntrepreneur && <> · <a href={`tel:${r.telephoneEntrepreneur}`} style={lien}>{r.telephoneEntrepreneur}</a></>}</>} />
            <LigneInfo label="Date prévue" valeur={r.datePrevue && dateLisible(r.datePrevue)} />
            <LigneInfo label="Terminée le" valeur={r.dateFin && dateLisible(r.dateFin)} />
            <LigneInfo label="Coût estimé" valeur={r.coutEstime != null && argent(r.coutEstime)} />
            <LigneInfo label="Coût réel" valeur={r.coutReel != null && <strong>{argent(r.coutReel)}</strong>} />
            <LigneInfo label="Facture" valeur={r.numeroFacture} />
            {fournisseurs && (
              <LigneInfo
                label="Comptes à payer"
                valeur={facture ? <Link href="/gerant/comptabilite/comptes-a-payer" style={lien}>{facture === "PAYEE" ? "✅ Facture payée" : "Facture à payer"}</Link> : "Inscrite une fois terminée, avec son coût réel"}
              />
            )}
            {r.immobilisation && <LigneInfo label="Immobilisation" valeur="Oui — travaux majeurs, amortis à l'impôt" />}
            {r.description && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{r.description}</p>}
            {r.reponse && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0", padding: "8px 10px", borderRadius: 10, background: "rgba(232,163,61,0.12)" }}><strong>Réponse au locataire :</strong> {r.reponse}</p>}
            {r.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0", color: "var(--text-muted)" }}>📝 {r.notes}</p>}
          </>
        )}
      </Section>

      <Section titre="Photos et pièces jointes">
        <ListeFichiers fichiers={r.fichiers} base="/api/immobilier/fichiers" />
        <EnvoiFichiers url="/api/immobilier/fichiers" champsFixes={{ reparationId: r.id }} />
      </Section>
    </div>
  );
}
