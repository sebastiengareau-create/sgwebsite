"use client";

import { useState } from "react";
import BandeauSection from "../../components/BandeauSection";
import { BoutonPlein, Pastille } from "../../components/StyleSection";
import { correspondRecherche } from "@/lib/recherche";
import { CATEGORIES_DOCUMENTS, VISIBILITES, libelle, dateLisible, taille } from "@/lib/coproprieteCalculs";
import FormulaireDocument from "./FormulaireDocument";
import { NavCopro, Section, Formulaire, Recherche, BoutonTexte, BoutonSupprimer, Vide, valeursDe, champStyle } from "../ui";

const COULEURS_VISIBILITE = { COPROPRIETAIRES: "var(--success)", UNITE: "var(--bleu)", ADMIN: "var(--text-muted)" };

export default function DocumentsClient({ documents, unites, batiments }) {
  const [formulaire, setFormulaire] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("");
  const [edition, setEdition] = useState(null);
  const q = recherche.trim().toLowerCase();
  const affiches = documents.filter((d) => (!categorie || d.categorie === categorie) && (!q || correspondRecherche(q, d.titre, d.description, d.nom, d.unite?.numero)));
  const parCategorie = CATEGORIES_DOCUMENTS.map((c) => ({ ...c, docs: affiches.filter((d) => d.categorie === c.code) })).filter((c) => c.docs.length > 0);
  const champsEdition = [
    { nom: "titre", label: "Titre", pleineLargeur: true },
    { nom: "categorie", label: "Catégorie", type: "choix", options: CATEGORIES_DOCUMENTS },
    { nom: "date", label: "Date", type: "date" },
    { nom: "visibilite", label: "Qui le voit", type: "choix", options: VISIBILITES },
    { nom: "uniteId", label: "Unité", type: "choix", vide: "—", options: unites.map((u) => ({ code: u.id, label: u.numero })) },
    { nom: "description", label: "Description", type: "long", lignes: 2 },
  ];

  return (
    <div className="conteneur-page">
      <BandeauSection icone="📁" titre="Documents" sousTitre="Classés par catégorie et partagés aux copropriétaires dans leur portail sécurisé." />
      <NavCopro actif="/copropriete/documents" />
      <div style={{ marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Déposer un document"}</BoutonPlein>
      </div>
      {formulaire && <FormulaireDocument unites={unites} batiments={batiments} onFini={() => setFormulaire(false)} />}
      {edition && (
        <Section titre={`Modifier — ${edition.titre}`} droite={<BoutonTexte onClick={() => setEdition(null)}>Annuler</BoutonTexte>}>
          <Formulaire key={edition.id} cadre={false} champs={champsEdition} initial={valeursDe(edition, champsEdition)} url={`/api/copropriete/documents/${edition.id}`} methode="PATCH" onFini={() => setEdition(null)} />
        </Section>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
        <Recherche valeur={recherche} onChange={setRecherche} placeholder="Titre, description, unité…" />
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)} style={{ ...champStyle, width: "auto", padding: "11px 10px", borderRadius: 12, background: "var(--surface)" }}>
          <option value="">Toutes les catégories</option>
          {CATEGORIES_DOCUMENTS.map((c) => <option key={c.code} value={c.code}>{c.icone} {c.label}</option>)}
        </select>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
        <Pastille couleur={COULEURS_VISIBILITE.COPROPRIETAIRES} fond="var(--success-fond)">Tous</Pastille> visible par tous les copropriétaires ·{" "}
        <Pastille couleur={COULEURS_VISIBILITE.UNITE} fond="var(--bleu-fond)">Unité</Pastille> seulement les propriétaires de l'unité ·{" "}
        <Pastille couleur={COULEURS_VISIBILITE.ADMIN} fond="var(--surface-alt)">Admin</Pastille> jamais dans le portail
      </p>
      {parCategorie.length === 0 && <Vide>Aucun document{q || categorie ? " trouvé" : " déposé"}.</Vide>}
      {parCategorie.map((c) => (
        <Section key={c.code} titre={`${c.icone} ${c.label} (${c.docs.length})`}>
          {c.docs.map((d) => (
            <div key={d.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <a href={`/api/copropriete/documents/${d.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{d.titre}</a>
                <Pastille couleur={COULEURS_VISIBILITE[d.visibilite]} fond={d.visibilite === "COPROPRIETAIRES" ? "var(--success-fond)" : d.visibilite === "UNITE" ? "var(--bleu-fond)" : "var(--surface-alt)"}>
                  {d.visibilite === "COPROPRIETAIRES" ? "Tous" : d.visibilite === "UNITE" ? `Unité ${d.unite?.numero || "?"}` : "Admin"}
                </Pastille>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {[d.date && dateLisible(d.date), d.visibilite !== "UNITE" && d.unite && `unité ${d.unite.numero}`, d.batiment?.nom, d.nom, taille(d.taille), d.creePar && `déposé par ${d.creePar}`].filter(Boolean).join(" · ")}
              </div>
              {d.description && <div style={{ fontSize: 12.5, marginTop: 2 }}>{d.description}</div>}
              <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
                <a href={`/api/copropriete/documents/${d.id}?telecharger=1`} style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Télécharger</a>
                <BoutonTexte onClick={() => setEdition(d)}>Modifier</BoutonTexte>
                <BoutonSupprimer url={`/api/copropriete/documents/${d.id}`} confirmation={`Supprimer « ${d.titre} » ?`} />
              </div>
            </div>
          ))}
        </Section>
      ))}
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{libelle(VISIBILITES, "COPROPRIETAIRES")} : un document déposé ici paraît tout de suite dans le portail de chaque copropriétaire qui y a accès.</p>
    </div>
  );
}
