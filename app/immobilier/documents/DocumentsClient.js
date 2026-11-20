"use client";

import { useState } from "react";
import BandeauSection from "../../components/BandeauSection";
import { BoutonPlein } from "../../components/StyleSection";
import { correspondRecherche } from "@/lib/recherche";
import { CATEGORIES_DOCUMENTS, trouver, etatExpiration, dateLisible, taille } from "@/lib/immobilierCalculs";
import { NavImmo, Section, Recherche, Vide, FormulaireDocument, PastilleEtat, BoutonSupprimer, nomLogement, lien, champStyle } from "../ui";

export default function DocumentsClient({ documents, immeubles }) {
  const [formulaire, setFormulaire] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [immeuble, setImmeuble] = useState("");
  const q = recherche.trim().toLowerCase();
  const filtres = documents
    .filter((d) => !immeuble || d.immeubleId === immeuble)
    .filter((d) => !q || correspondRecherche(q, d.titre, d.description, d.nom, d.locataire?.nom, d.immeuble?.nom));
  const aSurveiller = documents.map((d) => ({ ...d, etat: etatExpiration(d.expireLe) })).filter((d) => d.etat && d.etat.code !== "OK");
  return (
    <div className="conteneur-page">
      <BandeauSection icone="📁" titre="Documents" sousTitre="Baux signés, avis, états des lieux, assurances, taxes, actes…" />
      <NavImmo actif="/immobilier/documents" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Déposer un document"}</BoutonPlein>
        {immeubles.length > 1 && (
          <select value={immeuble} onChange={(e) => setImmeuble(e.target.value)} style={{ ...champStyle, width: "auto", marginBottom: 0 }}>
            <option value="">Tous les immeubles</option>
            {immeubles.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
          </select>
        )}
      </div>
      {formulaire && <FormulaireDocument immeubles={immeubles} categorie="ASSURANCE" onFini={() => setFormulaire(false)} />}
      {aSurveiller.length > 0 && (
        <Section titre="À renouveler">
          {aSurveiller.map((d) => (
            <a key={d.id} href={`/api/immobilier/documents/${d.id}`} target="_blank" rel="noreferrer" className="ligne-info ligne-pastilles" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
              <span>{trouver(CATEGORIES_DOCUMENTS, d.categorie)?.icone} {d.titre} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· expire le {dateLisible(d.expireLe)}</span></span>
              <PastilleEtat etat={d.etat} />
            </a>
          ))}
        </Section>
      )}
      <Recherche valeur={recherche} onChange={setRecherche} placeholder="Titre, locataire, immeuble…" />
      {filtres.length === 0 && <Vide>Aucun document.</Vide>}
      {CATEGORIES_DOCUMENTS.map((c) => {
        const liste = filtres.filter((d) => d.categorie === c.code);
        if (liste.length === 0) return null;
        return (
          <Section key={c.code} titre={`${c.icone} ${c.label} (${liste.length})`}>
            {liste.map((d) => (
              <div key={d.id} className="ligne-info ligne-pastilles" style={{ gap: 8 }}>
                <span style={{ minWidth: 0 }}>
                  <a href={`/api/immobilier/documents/${d.id}`} target="_blank" rel="noreferrer" style={lien}>{d.titre}</a>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {[d.immeuble?.nom, d.logement && nomLogement(d.logement), d.locataire?.nom, d.date && dateLisible(d.date), taille(d.taille)].filter(Boolean).map((x) => ` · ${x}`).join("")}
                  </span>
                </span>
                <span style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  {d.expireLe && <PastilleEtat etat={etatExpiration(d.expireLe)} />}
                  <BoutonSupprimer url={`/api/immobilier/documents/${d.id}`} confirmation={`Supprimer le document « ${d.titre} » ?`}>✕</BoutonSupprimer>
                </span>
              </div>
            ))}
          </Section>
        );
      })}
    </div>
  );
}
