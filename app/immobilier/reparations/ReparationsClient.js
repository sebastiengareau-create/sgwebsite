"use client";

import { useState } from "react";
import BandeauSection from "../../components/BandeauSection";
import { BoutonPlein } from "../../components/StyleSection";
import { correspondRecherche } from "@/lib/recherche";
import { PRIORITES, STATUTS_REPARATION, STATUTS_REPARATION_OUVERTS, argent, trouver, dateLisible } from "@/lib/immobilierCalculs";
import { NavImmo, Onglets, Recherche, CarteListe, Vide, PastilleCode, FormulaireReparation, Statistique, nomLogement } from "../ui";

const ONGLETS = [{ code: "OUVERTES", label: "À faire" }, { code: "TERMINEES", label: "Terminées" }, { code: "TOUTES", label: "Toutes" }];
const rangPriorite = (p) => trouver(PRIORITES, p)?.rang ?? 9;

export default function ReparationsClient({ reparations, immeubles, locataires }) {
  const [formulaire, setFormulaire] = useState(false);
  const [onglet, setOnglet] = useState("OUVERTES");
  const [immeuble, setImmeuble] = useState("");
  const [recherche, setRecherche] = useState("");
  const q = recherche.trim().toLowerCase();
  const ouvertes = reparations.filter((r) => STATUTS_REPARATION_OUVERTS.includes(r.statut));
  const annee = new Date().getFullYear();
  const coutAnnee = reparations.filter((r) => r.statut === "TERMINEE" && new Date(r.dateFin || r.creeLe).getFullYear() === annee).reduce((s, r) => s + (r.coutReel || 0), 0);
  const aVenir = ouvertes.reduce((s, r) => s + (r.coutEstime || 0), 0);
  const affichees = reparations
    .filter((r) => onglet === "TOUTES" || (onglet === "OUVERTES" ? STATUTS_REPARATION_OUVERTS.includes(r.statut) : !STATUTS_REPARATION_OUVERTS.includes(r.statut)))
    .filter((r) => !immeuble || r.immeuble.id === immeuble)
    .filter((r) => !q || correspondRecherche(q, r.numero, r.titre, r.entrepreneur, r.locataire?.nom, r.logement?.numero))
    .sort((a, b) => (onglet === "OUVERTES" ? rangPriorite(a.priorite) - rangPriorite(b.priorite) : 0) || new Date(b.creeLe) - new Date(a.creeLe));
  return (
    <div className="conteneur-page">
      <BandeauSection icone="🛠️" titre="Réparations" sousTitre="Demandes des locataires, travaux planifiés, entrepreneurs et coûts." />
      <NavImmo actif="/immobilier/reparations" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Statistique valeur={ouvertes.length} label="À faire" teinte="var(--accent)" />
        <Statistique valeur={ouvertes.filter((r) => r.priorite === "URGENTE").length} label="Urgentes" teinte="var(--danger)" />
        <Statistique valeur={argent(aVenir)} label="Coûts estimés à venir" teinte="#8C6BC4" />
        <Statistique valeur={argent(coutAnnee)} label={`Coût réel ${annee}`} teinte="var(--bleu)" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouvelle réparation"}</BoutonPlein>
      </div>
      {formulaire && (immeubles.length === 0 ? <Vide>Ajoute d'abord un immeuble.</Vide> : <FormulaireReparation immeubles={immeubles} locataires={locataires} />)}
      <Onglets options={ONGLETS} valeur={onglet} onChange={setOnglet} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {immeubles.length > 1 && (
          <select value={immeuble} onChange={(e) => setImmeuble(e.target.value)} style={{ padding: "11px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14, marginBottom: 12 }}>
            <option value="">Tous les immeubles</option>
            {immeubles.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
          </select>
        )}
        <div style={{ flex: 1, minWidth: 200 }}><Recherche valeur={recherche} onChange={setRecherche} placeholder="Numéro, titre, entrepreneur, locataire…" /></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affichees.map((r) => {
          const statut = trouver(STATUTS_REPARATION, r.statut);
          return (
            <CarteListe
              key={r.id} href={`/immobilier/reparations/${r.id}`}
              couleur={statut?.ouverte ? trouver(PRIORITES, r.priorite)?.couleur : statut?.couleur}
              titre={<>{r.numero} · {r.source === "PORTAIL" && "🌐 "}{r.titre}</>}
              sousTitre={[
                r.immeuble.nom, r.logement ? nomLogement(r.logement) : "parties communes", r.locataire && `signalée par ${r.locataire.nom}`, r.entrepreneur,
                r.datePrevue && statut?.ouverte && `prévue le ${dateLisible(r.datePrevue)}`,
              ].filter(Boolean).join(" · ")}
              bas={<>{statut?.ouverte && <PastilleCode liste={PRIORITES} code={r.priorite} />}<PastilleCode liste={STATUTS_REPARATION} code={r.statut} /></>}
              droite={r.coutReel != null ? <strong>{argent(r.coutReel)}</strong> : r.coutEstime != null ? <span style={{ color: "var(--text-muted)" }}>≈ {argent(r.coutEstime)}</span> : null}
            />
          );
        })}
        {affichees.length === 0 && <Vide>Aucune réparation.</Vide>}
      </div>
    </div>
  );
}
