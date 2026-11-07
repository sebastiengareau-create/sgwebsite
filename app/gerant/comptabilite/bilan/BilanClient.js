"use client";

import Link from "next/link";
import { argent, nombre } from "@/lib/format";
import BandeauSection from "../../../components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, GrilleChiffres, BoutonContour, TitrePanneau, stylePanneau } from "../../../components/StyleSection";

const COULEURS_ACTIF = ["#4F82C0", "#5AC8C8", "#7BA7D9", "#3E6A9E"];
const COULEURS_PASSIF = ["#C9A227", "#D4B24D", "#B8901A"];
const COULEURS_CAPITAUX = ["#9C978A", "#B0AA9C", "#E8A33D"];

export default function BilanClient({ lignes, resultatNetCumule }) {
  const actifs = lignes.filter((l) => l.type === "ACTIF" && l.solde !== 0).sort((a, b) => b.solde - a.solde);
  const passifs = lignes.filter((l) => l.type === "PASSIF" && l.solde !== 0).sort((a, b) => b.solde - a.solde);
  const capitauxComptes = lignes.filter((l) => l.type === "CAPITAUX_PROPRES").sort((a, b) => b.solde - a.solde);

  const totalActif = actifs.reduce((s, l) => s + l.solde, 0);
  const totalPassif = passifs.reduce((s, l) => s + l.solde, 0);
  const totalCapitauxComptes = capitauxComptes.reduce((s, l) => s + l.solde, 0);
  const totalCapitauxPropres = totalCapitauxComptes + resultatNetCumule;
  const totalPassifEtCapitaux = totalPassif + totalCapitauxPropres;
  const ecart = totalActif - totalPassifEtCapitaux;
  const equilibre = Math.abs(ecart) < 0.01;

  // Pour les barres proportionnelles des capitaux propres, on inclut le
  // résultat net cumulé comme une ligne à part entière
  const capitauxAvecResultat = [
    ...capitauxComptes.filter((l) => l.solde !== 0),
    ...(resultatNetCumule !== 0 ? [{ numero: "RESULTAT", nom: "Résultat net cumulé (non affecté)", solde: resultatNetCumule }] : []),
  ];

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la comptabilité</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="⚖️" titre="Bilan" sousTitre="À ce jour — Actif d'un côté, Passif et capitaux propres de l'autre." />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <BoutonContour style={boutonEgal} href="/gerant/comptabilite/etat-resultats" icone="graphique">État des résultats</BoutonContour>
        <BoutonContour style={boutonEgal} href="/gerant/comptabilite/rapports" icone="imprimante">Rapports imprimables</BoutonContour>
      </div>

      {/* Vérification d'équilibre — mise en évidence en premier */}
      <div style={{
        position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 12,
        background: "var(--surface)", border: `1px solid ${equilibre ? "var(--success)" : "var(--danger)"}`,
        borderRadius: 16, padding: "14px 16px 14px 20px", marginBottom: 16,
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: equilibre ? "var(--success)" : "var(--danger)" }} />
        <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: equilibre ? "var(--success-fond)" : "var(--danger-fond)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom={equilibre ? "crochet" : "alerte"} taille={20} couleur={equilibre ? "var(--success)" : "var(--danger)"} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: equilibre ? "var(--success)" : "var(--danger)" }}>
            {equilibre ? "Le bilan s'équilibre" : `Écart de ${argent(Math.abs(ecart))}`}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            Actif {argent(totalActif)} = Passif {argent(totalPassif)} + Capitaux propres {argent(totalCapitauxPropres)}
          </div>
        </div>
      </div>

      <GrilleChiffres>
        <CarteChiffre titre="Actif" montant={argent(totalActif)} couleur="var(--bleu)" teinte="var(--bleu)" note="Ce que l'entreprise possède" />
        <CarteChiffre titre="Passif" montant={argent(totalPassif)} couleur="var(--avertissement)" teinte="var(--avertissement)" note="Ce qu'elle doit" />
        <CarteChiffre
          titre="Capitaux propres" montant={argent(totalCapitauxPropres)}
          couleur={totalCapitauxPropres >= 0 ? "var(--success)" : "var(--danger)"} teinte={totalCapitauxPropres >= 0 ? "var(--success)" : "var(--danger)"}
          note="Mise de fonds et résultats accumulés"
        />
      </GrilleChiffres>

      <SectionBarres titre="Actif" icone="banque" teinte={TEINTES.bleu} total={totalActif} lignes={actifs} couleurs={COULEURS_ACTIF} />
      <SectionBarres titre="Passif" icone="document" teinte={{ couleur: "var(--avertissement)", fond: "var(--avertissement-fond)" }} total={totalPassif} lignes={passifs} couleurs={COULEURS_PASSIF} />
      <SectionBarres titre="Capitaux propres" icone="balance" teinte={TEINTES.vert} total={totalCapitauxPropres} lignes={capitauxAvecResultat} couleurs={COULEURS_CAPITAUX} />

      {actifs.length === 0 && passifs.length === 0 && (
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
  const max = Math.max(...lignes.map((l) => Math.abs(l.solde)), 1);

  return (
    <div style={stylePanneau}>
      <TitrePanneau
        icone={icone} teinte={teinte} titre={titre}
        droite={<span style={{ fontSize: 20, fontWeight: 800, color: teinte.couleur, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(total)}</span>}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {lignes.map((l, i) => {
          const couleur = couleurs[i % couleurs.length];
          const largeur = Math.max(6, (Math.abs(l.solde) / max) * 100);
          const part = total !== 0 ? (l.solde / total) * 100 : 0;
          return (
            <div key={l.numero}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13.5, marginBottom: 5 }}>
                <span>
                  {l.numero !== "RESULTAT" && <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", marginRight: 6 }}>{l.numero}</span>}
                  {l.nom}
                </span>
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
