"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauImmo from "@/app/immobilier/BandeauImmo";
import { BoutonPlein } from "../../components/StyleSection";
import { CATEGORIES_DEPENSE, argent, libelle, trouver, dateLisible, dateCourte, rendement } from "@/lib/immobilierCalculs";
import { NavImmo, Section, Formulaire, Vide, BoutonTexte, BoutonSupprimer, valeursDe, champsDepense, aujourdhui, champStyle, lien, TableauRendement, LigneMouvement } from "../ui";

const STATUT_FACTURE = { IMPAYEE: { texte: "À payer", couleur: "var(--danger)" }, PAYEE: { texte: "Payée", couleur: "var(--success)" } };

export default function DepensesClient({ immeubles, depenses, donnees, annee, courante, immeubleInit, fournisseurs, statuts = {} }) {
  const router = useRouter();
  const [formulaire, setFormulaire] = useState(false);
  const [edition, setEdition] = useState(null);
  const [immeuble, setImmeuble] = useState(immeubleInit);
  const champs = champsDepense(immeubles, { fournisseurs });
  const champsCreation = champsDepense(immeubles, { fournisseurs, creation: true });
  const nomImmeuble = Object.fromEntries(immeubles.map((i) => [i.id, i.nom]));
  const filtrees = depenses.filter((d) => !immeuble || d.immeubleId === immeuble);
  const { lignes, total } = rendement({ immeubles: immeubles.filter((i) => !immeuble || i.id === immeuble), ...donnees });
  const t = immeuble ? lignes[0] || total : total;

  // Dépenses par catégorie
  const parCategorie = {};
  for (const d of filtrees) parCategorie[d.categorie] = (parCategorie[d.categorie] || 0) + d.montant;
  const categories = Object.entries(parCategorie).sort((a, b) => b[1] - a[1]);
  const totalDepenses = filtrees.reduce((s, d) => s + d.montant, 0);

  function exporter() {
    const echapper = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
    const csv = [["Date", "Immeuble", "Catégorie", "Description", "Payé à", "Référence", "Montant"].join(";"),
      ...filtrees.map((d) => [dateCourte(d.date), nomImmeuble[d.immeubleId], libelle(CATEGORIES_DEPENSE, d.categorie), d.description, d.payeA, d.reference, String(d.montant).replace(".", ",")].map(echapper).join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `depenses-immobilier-${annee}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="conteneur-page">
      <BandeauImmo icone="📈" titre="Dépenses et rendement" sousTitre="Taxes, assurances, intérêts, énergie… et le revenu net de chaque immeuble." />
      <NavImmo actif="/immobilier/depenses" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouvelle dépense"}</BoutonPlein>
        <Link href={`/immobilier/depenses/impot?annee=${annee}`} style={{ fontSize: 13.5, fontWeight: 700, ...lien }}>🧾 Revenus de location pour l'impôt (T776, TP-128)</Link>
        {fournisseurs && <Link href="/immobilier/comptabilite" style={{ fontSize: 13.5, fontWeight: 700, ...lien }}>📚 Relié à la comptabilité</Link>}
        <select value={annee} onChange={(e) => router.push(`/immobilier/depenses?annee=${e.target.value}${immeuble ? `&immeuble=${immeuble}` : ""}`)} style={{ ...champStyle, width: "auto", marginBottom: 0 }}>
          {Array.from({ length: 6 }, (_, i) => courante - i).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {immeubles.length > 1 && (
          <select value={immeuble} onChange={(e) => setImmeuble(e.target.value)} style={{ ...champStyle, width: "auto", marginBottom: 0 }}>
            <option value="">Tous les immeubles</option>
            {immeubles.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
          </select>
        )}
      </div>
      {formulaire && (immeubles.length === 0 ? <Vide>Ajoute d'abord un immeuble.</Vide> : (
        <Formulaire champs={champsCreation} initial={{ date: aujourdhui(), immeubleId: immeuble || immeubles[0].id }} url="/api/immobilier/depenses" bouton="Ajouter la dépense" onFini={() => setFormulaire(false)} />
      ))}
      {edition && <Formulaire key={edition.id} champs={champs} initial={valeursDe(edition, champs)} url={`/api/immobilier/depenses/${edition.id}`} methode="PATCH" bouton="Enregistrer la dépense" onFini={() => setEdition(null)} />}

      <Section titre={`Rendement ${annee}`}>
        <div className="ligne-info"><span>Loyers facturés</span><span>{argent(t.facture)}</span></div>
        <div className="ligne-info"><span>Loyers perçus</span><span>{argent(t.percu)}</span></div>
        <div className="ligne-info"><span>Dépenses</span><span>− {argent(t.depenses)}</span></div>
        <div className="ligne-info"><span>Réparations terminées</span><span>− {argent(t.reparations)}</span></div>
        <div className="ligne-info" style={{ fontWeight: 800 }}><span>Revenu net</span><span style={{ color: t.net < 0 ? "var(--danger)" : "var(--success)" }}>{argent(t.net)}</span></div>
        {!immeuble && lignes.length > 1 && (
          <div style={{ marginTop: 12 }}>
            <TableauRendement lignes={lignes} />
          </div>
        )}
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>{fournisseurs ? "Aperçu de gestion ; les loyers, paiements, dépenses et réparations vont aussi aux livres" : "Aperçu de gestion, sans lien avec la comptabilité"} : le remboursement du capital de l'hypothèque n'est pas une dépense ; seuls les intérêts le sont.</p>
      </Section>

      <Section titre="Par catégorie">
        {categories.length === 0 ? <Vide>Aucune dépense en {annee}.</Vide> : categories.map(([c, m]) => (
          <div key={c} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
              <span style={{ minWidth: 0 }}>{trouver(CATEGORIES_DEPENSE, c)?.icone} {libelle(CATEGORIES_DEPENSE, c)}</span>
              <span style={{ fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{argent(m)} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· {Math.round((m / totalDepenses) * 100)} %</span></span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--surface-alt)", marginTop: 4 }}>
              <div style={{ height: 6, borderRadius: 3, width: `${(m / categories[0][1]) * 100}%`, background: "var(--accent)" }} />
            </div>
          </div>
        ))}
      </Section>

      <Section titre={`Dépenses ${annee} — ${argent(totalDepenses)}`} droite={filtrees.length > 0 && <BoutonTexte onClick={exporter}>⬇️ Exporter (CSV)</BoutonTexte>}>
        {filtrees.length === 0 ? <Vide>Aucune dépense.</Vide> : (
          <div>
            {filtrees.map((d) => (
              <LigneMouvement
                key={d.id}
                titre={<span title={libelle(CATEGORIES_DEPENSE, d.categorie)}>{trouver(CATEGORIES_DEPENSE, d.categorie)?.icone} {d.description || libelle(CATEGORIES_DEPENSE, d.categorie)}</span>}
                detail={[dateLisible(d.date), nomImmeuble[d.immeubleId], d.payeA && `${d.payeA}${d.reference ? ` · ${d.reference}` : ""}`].filter(Boolean).join(" · ")}
                montant={argent(d.montant)}
                sousMontant={STATUT_FACTURE[statuts[d.id]] && <span style={{ color: STATUT_FACTURE[statuts[d.id]].couleur, fontWeight: 700 }}>{STATUT_FACTURE[statuts[d.id]].texte}</span>}
                actions={<>
                  <BoutonTexte onClick={() => setEdition(d)}>Modifier</BoutonTexte>
                  <BoutonSupprimer url={`/api/immobilier/depenses/${d.id}`} confirmation={`Supprimer la dépense de ${argent(d.montant)} ?`}>✕ Retirer</BoutonSupprimer>
                </>}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
