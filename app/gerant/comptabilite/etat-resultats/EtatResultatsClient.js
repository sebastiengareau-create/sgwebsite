"use client";

import Link from "next/link";
import { argent, nombre } from "@/lib/format";
import BandeauSection from "../../../components/BandeauSection";
import { TEINTES, CarteChiffre, GrilleChiffres, BoutonContour, TitrePanneau, stylePanneau } from "../../../components/StyleSection";

const COULEURS_REVENU = ["#E8A33D", "#4F82C0", "#6FA96B", "#C9A227", "#9C6ADE", "#5AC8C8", "#D46A8F"];
const COULEURS_DEPENSE = ["#C15B4A", "#B8791F", "#8A6D5C"];

export default function EtatResultatsClient({ lignes }) {
  const revenus = lignes.filter((l) => l.type === "REVENU" && l.solde !== 0).sort((a, b) => b.solde - a.solde);
  const depenses = lignes.filter((l) => l.type === "DEPENSE" && l.solde !== 0).sort((a, b) => b.solde - a.solde);

  const totalRevenus = revenus.reduce((s, l) => s + l.solde, 0);
  const totalDepenses = depenses.reduce((s, l) => s + l.solde, 0);
  const profitNet = totalRevenus - totalDepenses;
  const margeNette = totalRevenus > 0 ? (profitNet / totalRevenus) * 100 : 0;

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la comptabilité</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="📊" titre="État des résultats" sousTitre="Depuis le début — généré automatiquement à partir de tes factures." />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <BoutonContour style={boutonEgal} href="/gerant/comptabilite/bilan" icone="balance">Bilan</BoutonContour>
        <BoutonContour style={boutonEgal} href="/gerant/comptabilite/rapports" icone="imprimante">Rapports imprimables</BoutonContour>
      </div>

      <GrilleChiffres>
        <CarteChiffre titre="Revenus" montant={argent(totalRevenus)} couleur="var(--success)" teinte="var(--success)" note={`${revenus.length} poste${revenus.length > 1 ? "s" : ""} de revenu`} />
        <CarteChiffre titre="Dépenses" montant={argent(totalDepenses)} couleur="var(--danger)" teinte="var(--danger)" note={`${depenses.length} poste${depenses.length > 1 ? "s" : ""} de dépense`} />
        <CarteChiffre
          titre="Profit net" montant={argent(profitNet)}
          couleur={profitNet >= 0 ? "var(--success)" : "var(--danger)"} teinte={profitNet >= 0 ? "var(--success)" : "var(--danger)"}
          note={`Marge de ${nombre(margeNette, 1)} %`}
        />
      </GrilleChiffres>

      <SectionBarres titre="Revenus" icone="tendance" teinte={TEINTES.vert} total={totalRevenus} lignes={revenus} couleurs={COULEURS_REVENU} />
      <SectionBarres titre="Dépenses" icone="graphique" teinte={TEINTES.rouge} total={totalDepenses} lignes={depenses} couleurs={COULEURS_DEPENSE} />

      {revenus.length === 0 && depenses.length === 0 && (
        <div style={{ textAlign: "center", padding: "30px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 16 }}>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
            Aucune donnée encore — émets ta première facture pour voir apparaître les chiffres ici.
          </p>
        </div>
      )}
    </div>
  );
}

function SectionBarres({ titre, icone, teinte, total, lignes, couleurs }) {
  if (lignes.length === 0) return null;
  const max = Math.max(...lignes.map((l) => l.solde), 1);

  return (
    <div style={stylePanneau}>
      <TitrePanneau
        icone={icone} teinte={teinte} titre={titre}
        droite={<span style={{ fontSize: 20, fontWeight: 800, color: teinte.couleur, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(total)}</span>}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {lignes.map((l, i) => {
          const couleur = couleurs[i % couleurs.length];
          const largeur = Math.max(6, (l.solde / max) * 100);
          const part = total > 0 ? (l.solde / total) * 100 : 0;
          return (
            <div key={l.numero}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13.5, marginBottom: 5 }}>
                <span><span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", marginRight: 6 }}>{l.numero}</span>{l.nom}</span>
                <span style={{ fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{argent(l.solde)} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({nombre(part, 0)} %)</span></span>
              </div>
              <div style={{ height: 12, background: "var(--bg)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${largeur}%`, height: "100%", background: couleur, borderRadius: 999 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Les deux boutons du haut prennent la même largeur, côte à côte ou empilés
const boutonEgal = { flex: "1 1 160px", justifyContent: "center", padding: "11px 12px" };
