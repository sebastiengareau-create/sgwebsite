"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { BoutonPlein } from "../../components/StyleSection";
import { CATEGORIES_DEPENSE, argent, libelle, trouver, dateLisible, dateCourte, rendement } from "@/lib/immobilierCalculs";
import { NavImmo, Section, Formulaire, Vide, Tableau, cellule, celluleDroite, BoutonTexte, BoutonSupprimer, valeursDe, champsDepense, aujourdhui, champStyle, lien } from "../ui";

export default function DepensesClient({ immeubles, depenses, donnees, annee, courante, immeubleInit }) {
  const router = useRouter();
  const [formulaire, setFormulaire] = useState(false);
  const [edition, setEdition] = useState(null);
  const [immeuble, setImmeuble] = useState(immeubleInit);
  const champs = champsDepense(immeubles);
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
      <BandeauSection icone="📈" titre="Dépenses et rendement" sousTitre="Taxes, assurances, intérêts, énergie… et le revenu net de chaque immeuble." />
      <NavImmo actif="/immobilier/depenses" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouvelle dépense"}</BoutonPlein>
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
        <Formulaire champs={champs} initial={{ date: aujourdhui(), immeubleId: immeuble || immeubles[0].id }} url="/api/immobilier/depenses" bouton="Ajouter la dépense" onFini={() => setFormulaire(false)} />
      ))}
      {edition && <Formulaire key={edition.id} champs={champs} initial={valeursDe(edition, champs)} url={`/api/immobilier/depenses/${edition.id}`} methode="PATCH" bouton="Enregistrer la dépense" onFini={() => setEdition(null)} />}

      <Section titre={`Rendement ${annee}`}>
        <div className="ligne-info ligne-pastilles"><span>Loyers facturés</span><span>{argent(t.facture)}</span></div>
        <div className="ligne-info ligne-pastilles"><span>Loyers perçus</span><span>{argent(t.percu)}</span></div>
        <div className="ligne-info ligne-pastilles"><span>Dépenses</span><span>− {argent(t.depenses)}</span></div>
        <div className="ligne-info ligne-pastilles"><span>Réparations terminées</span><span>− {argent(t.reparations)}</span></div>
        <div className="ligne-info ligne-pastilles" style={{ fontWeight: 800 }}><span>Revenu net</span><span style={{ color: t.net < 0 ? "var(--danger)" : "var(--success)" }}>{argent(t.net)}</span></div>
        {!immeuble && lignes.length > 1 && (
          <div style={{ marginTop: 12 }}>
            <Tableau entetes={["Immeuble", "Perçu", "Dépenses", "Réparations", "Net"]} alignDroite={[1, 2, 3, 4]}>
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td style={cellule}><Link href={`/immobilier/immeubles/${l.id}`} style={lien}>{l.nom}</Link></td>
                  <td style={celluleDroite}>{argent(l.percu)}</td>
                  <td style={celluleDroite}>{argent(l.depenses)}</td>
                  <td style={celluleDroite}>{argent(l.reparations)}</td>
                  <td style={{ ...celluleDroite, fontWeight: 700, color: l.net < 0 ? "var(--danger)" : "var(--success)" }}>{argent(l.net)}</td>
                </tr>
              ))}
            </Tableau>
          </div>
        )}
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>Aperçu de gestion, sans lien avec la comptabilité : le remboursement du capital de l'hypothèque n'est pas une dépense ; seuls les intérêts le sont.</p>
      </Section>

      <Section titre="Par catégorie">
        {categories.length === 0 ? <Vide>Aucune dépense en {annee}.</Vide> : categories.map(([c, m]) => (
          <div key={c} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>{trouver(CATEGORIES_DEPENSE, c)?.icone} {libelle(CATEGORIES_DEPENSE, c)}</span>
              <span style={{ fontWeight: 700 }}>{argent(m)} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· {Math.round((m / totalDepenses) * 100)} %</span></span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--surface-alt)", marginTop: 4 }}>
              <div style={{ height: 6, borderRadius: 3, width: `${(m / categories[0][1]) * 100}%`, background: "var(--accent)" }} />
            </div>
          </div>
        ))}
      </Section>

      <Section titre={`Dépenses ${annee} — ${argent(totalDepenses)}`} droite={filtrees.length > 0 && <BoutonTexte onClick={exporter}>⬇️ Exporter (CSV)</BoutonTexte>}>
        {filtrees.length === 0 ? <Vide>Aucune dépense.</Vide> : (
          <Tableau entetes={["Date", "Dépense", "Immeuble", "Montant", ""]} alignDroite={[3]}>
            {filtrees.map((d) => (
              <tr key={d.id}>
                <td style={{ ...cellule, whiteSpace: "nowrap" }}>{dateLisible(d.date)}</td>
                <td style={cellule}>{trouver(CATEGORIES_DEPENSE, d.categorie)?.icone} {d.description || libelle(CATEGORIES_DEPENSE, d.categorie)}{d.payeA && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{d.payeA}{d.reference && ` · ${d.reference}`}</div>}</td>
                <td style={cellule}>{nomImmeuble[d.immeubleId]}</td>
                <td style={{ ...celluleDroite, fontWeight: 700 }}>{argent(d.montant)}</td>
                <td style={{ ...cellule, whiteSpace: "nowrap", textAlign: "right" }}>
                  <BoutonTexte onClick={() => setEdition(d)}>Modifier</BoutonTexte>{" · "}
                  <BoutonSupprimer url={`/api/immobilier/depenses/${d.id}`} confirmation={`Supprimer la dépense de ${argent(d.montant)} ?`}>✕</BoutonSupprimer>
                </td>
              </tr>
            ))}
          </Tableau>
        )}
      </Section>
    </div>
  );
}
