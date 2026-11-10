"use client";

import { useState } from "react";
import Link from "next/link";
import { CLIENT } from "@/lib/client";
import { NIVEAUX } from "./niveaux";
import { argent, nombre } from "@/lib/format";
import BandeauSection from "../components/BandeauSection";
import { Icone, TEINTES, TitrePanneau, stylePanneau, TitreGroupe } from "../components/StyleSection";

function fmt(montant) {
  return `${argent(montant)}`;
}

function fmtNombre(n, decimales = 1) {
  return n.toLocaleString("fr-CA", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

const ORDRE_NIVEAU = { danger: 0, avertissement: 1, info: 2 };
const ETAT_ALERTE = { danger: "Urgent", avertissement: "À prévoir", info: "Info" };

// Feux de circulation des cartes KPI et des lignes « Santé financière ».
// Les seuils suivent ceux de calculerSanteFinanciere (page.js) : marge
// pleine à 25 %, réserve pleine à 3 mois, endettement nul à 50 %.
function niveauMarge(pct) {
  return pct >= 15 ? { niveau: "bon", etat: "Bon" } : pct >= 5 ? { niveau: "avertissement", etat: "Moyen" } : { niveau: "danger", etat: "Faible" };
}
function niveauReserve(mois) {
  if (mois == null) return { niveau: "neutre", etat: null };
  return mois >= 3 ? { niveau: "bon", etat: "Confortable" } : mois >= 1 ? { niveau: "avertissement", etat: "Serré" } : { niveau: "danger", etat: "Bas" };
}
function niveauEndettement(pct) {
  return pct < 25 ? { niveau: "bon", etat: "Bon" } : pct <= 50 ? { niveau: "avertissement", etat: "À surveiller" } : { niveau: "danger", etat: "Élevé" };
}
function niveauVariation(variation) {
  if (variation === null || variation === undefined) return { niveau: "neutre", etat: null };
  return variation >= 0 ? { niveau: "bon", etat: "En hausse" } : { niveau: "avertissement", etat: "En baisse" };
}

export default function VueGlobaleClient({ nomUtilisateur, annee, mois, nomMois, kpis, graphique, sante, alertes, rentabilite }) {
  const [vueGraphique, setVueGraphique] = useState("comparaison"); // "comparaison" | "benefice"
  const [periodeRentabilite, setPeriodeRentabilite] = useState("mois"); // "mois" | "annee"

  const moisPrecUrl = mois === 1 ? { annee: annee - 1, mois: 12 } : { annee, mois: mois - 1 };
  const moisSuivUrl = mois === 12 ? { annee: annee + 1, mois: 1 } : { annee, mois: mois + 1 };

  const maxValeur = Math.max(1, ...graphique.flatMap((g) => (vueGraphique === "benefice" ? [Math.abs(g.benefice)] : [g.revenus, g.depenses])));
  const hauteur = (v) => `${Math.max(2, (Math.abs(v) / maxValeur) * 100)}%`;

  // Sans aucune donnée comptable, les indicateurs restent neutres (gris)
  // plutôt que d'afficher un rouge alarmant pour une entreprise qui débute.
  const neutre = { niveau: "neutre", etat: null };
  const nivReserve = niveauReserve(sante.moisReserve);
  const alertesTriees = [...alertes].sort((a, b) => ORDRE_NIVEAU[a.niveau] - ORDRE_NIVEAU[b.niveau]);
  const decompteAlertes = ["danger", "avertissement", "info"]
    .map((n) => ({ n, c: alertes.filter((a) => a.niveau === n).length }))
    .filter((x) => x.c > 0)
    .map((x) => `${x.c} ${x.n === "danger" ? (x.c > 1 ? "urgents" : "urgent") : x.n === "avertissement" ? "à prévoir" : "info"}`)
    .join(" · ");

  return (
    <div className="conteneur-page">
      {/* Bandeau d'accueil, avec le choix du mois */}
      <BandeauSection icone="📊" titre={`Bonjour ${nomUtilisateur.split(" ")[0]} 👋`} sousTitre="Voici l'état de votre entreprise aujourd'hui.">
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 12, background: "rgba(0,0,0,0.28)", borderRadius: 999, padding: 4 }}>
          <Link href={`/gerant?annee=${moisPrecUrl.annee}&mois=${moisPrecUrl.mois}`} aria-label="Mois précédent" style={boutonMois}><Icone nom="chevronGauche" taille={16} /></Link>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", minWidth: 120, textAlign: "center", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Icone nom="calendrier" taille={14} /> {nomMois} {annee}
          </span>
          <Link href={`/gerant?annee=${moisSuivUrl.annee}&mois=${moisSuivUrl.mois}`} aria-label="Mois suivant" style={boutonMois}><Icone nom="chevron" taille={16} /></Link>
        </div>
      </BandeauSection>

      {/* Bénéfice net mis en avant, puis les quatre autres indicateurs (4 colonnes, 2 sur cellulaire) */}
      <div style={{ marginBottom: 10 }}>
        <CarteKpi
          grand label="Bénéfice net" valeur={fmt(kpis.beneficeNet)} variation={kpis.beneficeNetVariation}
          {...(kpis.beneficeNet > 0 ? { niveau: "bon", etat: "Positif" } : kpis.beneficeNet < 0 ? { niveau: "danger", etat: "Perte" } : { niveau: "neutre" })}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(max(150px, 22%), 1fr))", gap: 10, marginBottom: 24 }}>
        <CarteKpi label="Chiffre d'affaires" valeur={fmt(kpis.revenus)} variation={kpis.revenusVariation} {...niveauVariation(kpis.revenusVariation)} />
        <CarteKpi
          label="À recevoir" valeur={fmt(kpis.clientsARecevoir)} href="/secretaire/factures"
          sousLabel={`${kpis.facturesImpayeesCount} facture${kpis.facturesImpayeesCount !== 1 ? "s" : ""}`}
          {...(kpis.facturesEnRetardCount > 0 ? { niveau: "danger", etat: `${kpis.facturesEnRetardCount} en retard` } : kpis.clientsARecevoir > 0 ? { niveau: "bon", etat: "À jour" } : { niveau: "neutre" })}
        />
        <CarteKpi
          label="À payer" valeur={fmt(kpis.fournisseursAPayer)} href="/gerant/comptabilite/comptes-a-payer"
          sousLabel={`${kpis.fournisseursImpayesCount} fournisseur${kpis.fournisseursImpayesCount !== 1 ? "s" : ""}`}
          {...(kpis.depensesAPayerBientotCount > 0 ? { niveau: "avertissement", etat: `${kpis.depensesAPayerBientotCount} à payer bientôt` } : kpis.fournisseursAPayer > 0 ? { niveau: "bon", etat: "À jour" } : { niveau: "neutre" })}
        />
        <CarteKpi
          label="Liquidités" valeur={fmt(kpis.soldeBancaire)} variation={kpis.soldeBancaireVariation} {...nivReserve}
          sousLabel={sante.moisReserve != null ? `${fmtNombre(sante.moisReserve)} mois de réserve` : null}
        />
      </div>

      <BlocAlertes alertes={alertesTriees} decompte={decompteAlertes} />

      {/* Graphique + santé financière */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginBottom: 24, alignItems: "start" }}>
        <div style={{ ...stylePanneau, marginBottom: 0 }}>
          <TitrePanneau icone="graphique" teinte={TEINTES.vert} titre="Revenus vs dépenses" sousTitre="12 derniers mois" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 10, padding: 4 }}>
              {[{ cle: "comparaison", label: "Revenus / dépenses" }, { cle: "benefice", label: "Bénéfice" }].map((v) => (
                <button
                  key={v.cle}
                  onClick={() => setVueGraphique(v.cle)}
                  style={{
                    fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: vueGraphique === v.cle ? "var(--accent)" : "none",
                    color: vueGraphique === v.cle ? "#221f18" : "var(--text-muted)",
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            {vueGraphique === "comparaison" ? (
              <>
                <Legende couleur="var(--success)" label="Revenus" />
                <Legende couleur="var(--danger)" opacite={0.55} label="Dépenses" />
              </>
            ) : (
              <>
                <Legende couleur="var(--success)" label="Bénéfice" />
                <Legende couleur="var(--danger)" label="Perte" />
              </>
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--danger)" }} />Mois en perte</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 170 }}>
            {graphique.map((g, i) => {
              const opacite = i === graphique.length - 1 ? 1 : 0.8;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 4 }}>
                  <div style={{ width: "100%", flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2 }}>
                    {vueGraphique === "comparaison" ? (
                      <>
                        <div title={`Revenus : ${fmt(g.revenus)}`} style={{ width: "42%", maxWidth: 12, height: hauteur(g.revenus), background: "var(--success)", borderRadius: "3px 3px 0 0", opacity: opacite }} />
                        <div title={`Dépenses : ${fmt(g.depenses)}`} style={{ width: "42%", maxWidth: 12, height: hauteur(g.depenses), background: "var(--danger)", borderRadius: "3px 3px 0 0", opacity: 0.55 }} />
                      </>
                    ) : (
                      <div title={`Bénéfice : ${fmt(g.benefice)}`} style={{ width: "100%", maxWidth: 22, height: hauteur(g.benefice), background: g.benefice < 0 ? "var(--danger)" : "var(--success)", borderRadius: "4px 4px 0 0", opacity: opacite }} />
                    )}
                  </div>
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{g.label}</span>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: g.benefice < 0 ? "var(--danger)" : "transparent" }} />
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...stylePanneau, marginBottom: 0, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 18 }}>
            <JaugeScore score={sante.score} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>Santé financière</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: couleurScore(sante.score) }}>{sante.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Estimation indicative · 12 derniers mois ({sante.periode})</div>
            </div>
          </div>
          <LigneSante label="Marge bénéficiaire (12 mois)" cible="Cible ≥ 15 %" valeur={`${fmtNombre(sante.margePct)} %`} {...(sante.aucuneDonnee ? neutre : niveauMarge(sante.margePct))} />
          {sante.moisReserve != null ? (
            <LigneSante label="Réserve de liquidités" cible="Cible ≥ 3 mois de dépenses" valeur={`${fmtNombre(sante.moisReserve)} mois`} {...nivReserve} />
          ) : (
            <LigneSante label="Liquidités" valeur={fmt(kpis.soldeBancaire)} niveau="neutre" />
          )}
          <LigneSante
            label="Comptes à recevoir" cible="Aucune facture de plus de 30 jours" valeur={fmt(kpis.clientsARecevoir)}
            {...(kpis.facturesEnRetardCount > 0 ? { niveau: "danger", etat: "Retard" } : { niveau: "bon", etat: "OK" })}
          />
          <LigneSante
            label="Comptes à payer" cible="Rien d'échu ni dû cette semaine" valeur={fmt(kpis.fournisseursAPayer)}
            {...(kpis.depensesAPayerBientotCount > 0 ? { niveau: "avertissement", etat: "À payer" } : { niveau: "bon", etat: "OK" })}
          />
          <LigneSante label="Ratio d'endettement" cible="Cible < 25 %" valeur={`${nombre(sante.ratioEndettement, 0)} %`} {...(sante.aucuneDonnee ? neutre : niveauEndettement(sante.ratioEndettement))} />
        </div>
      </div>

      {/* Analyse de rentabilité */}
      <CarteRentabilite rentabilite={rentabilite} nomMois={nomMois} annee={annee} periode={periodeRentabilite} onChangerPeriode={setPeriodeRentabilite} />

      {/* Actions rapides */}
      <section style={{ marginBottom: 24 }}>
        <TitreGroupe couleur="var(--accent)">Actions rapides</TitreGroupe>
        <div className="grille-actions">
          <BoutonAction icone="outils" label="Nouveau bon de travail" href="/secretaire/nouveau" />
          <BoutonAction icone="utilisateurPlus" label="Nouveau client" href="/secretaire/clients" />
          <BoutonAction icone="panier" label="Dépense" href="/gerant/comptabilite/comptes-a-payer" />
          {CLIENT.actionRapideInventaire ? (
            <BoutonAction icone="boite" label="Inventaire" href="/secretaire/inventaire" />
          ) : (
            <BoutonAction icone="calculatrice" label="Employé / Paie" href="/gerant/paie" />
          )}
          <BoutonAction icone="graphique" label="Rapports" href="/gerant/rapports" />
        </div>
      </section>
    </div>
  );
}

function CarteKpi({ label, valeur, sousLabel, variation, href, niveau = "neutre", etat, grand }) {
  const { couleur, fond } = NIVEAUX[niveau];
  const bande = niveau === "neutre" ? "var(--accent)" : couleur;
  const contenu = (
    <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, height: "100%", boxSizing: "border-box", padding: grand ? "18px 20px" : "14px 14px 14px 18px" }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: bande }} />
      {grand && <span style={{ position: "absolute", right: -30, top: -30, width: 110, height: 110, borderRadius: "50%", background: bande, opacity: 0.08 }} />}
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
          {etat && <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: fond, color: couleur, whiteSpace: "nowrap" }}>{etat}</span>}
        </div>
        <div style={{ fontSize: grand ? 32 : 21, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: grand && niveau !== "neutre" ? couleur : "var(--text)" }}>{valeur}</div>
        {variation !== undefined && variation !== null && (
          <div style={{ fontSize: 12, fontWeight: 700, color: variation >= 0 ? "var(--success)" : "var(--danger)", marginTop: 2 }}>
            {variation >= 0 ? "↑" : "↓"} {fmtNombre(Math.abs(variation))} % <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>vs mois préc.</span>
          </div>
        )}
        {sousLabel && <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>{sousLabel}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>{contenu}</Link> : contenu;
}

// « À surveiller aujourd'hui » : une ligne par alerte, de la plus grave à la
// moins grave, avec bande et fond de la couleur de son niveau.
function BlocAlertes({ alertes, decompte }) {
  return (
    <div style={{ ...stylePanneau, padding: 0, overflow: "hidden", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "16px 18px", borderBottom: alertes.length ? "1px solid var(--border)" : "none" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, fontWeight: 800 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--avertissement-fond)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom="alerte" taille={18} couleur="var(--avertissement)" />
          </span>
          À surveiller aujourd'hui
        </span>
        {decompte && <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>{decompte}</span>}
      </div>
      {alertes.length === 0 ? (
        <p style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 13.5, margin: 0, padding: "0 18px 16px" }}>
          <Icone nom="crochet" taille={18} couleur="var(--success)" /> Rien à signaler — tout est sous contrôle.
        </p>
      ) : (
        alertes.map((a, i) => {
          const { couleur, fond } = NIVEAUX[a.niveau];
          return (
            <Link key={i} href={a.href} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 46, paddingRight: 16, background: fond, borderBottom: i < alertes.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none", color: "inherit" }}>
              <span style={{ width: 5, alignSelf: "stretch", background: couleur, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: couleur, width: 68, flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.4 }}>{ETAT_ALERTE[a.niveau]}</span>
              <span style={{ flex: 1, fontSize: 13.5, padding: "10px 0" }}>{a.texte}</span>
              {a.montant !== undefined && <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(a.montant)}</span>}
              <Icone nom="chevron" taille={16} couleur="var(--text-muted)" />
            </Link>
          );
        })
      )}
    </div>
  );
}

function Legende({ couleur, label, opacite = 1 }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: couleur, opacity: opacite }} />
      {label}
    </span>
  );
}

function couleurScore(score) {
  return score >= 60 ? "var(--success)" : score >= 40 ? "var(--avertissement)" : "var(--danger)";
}

function JaugeScore({ score }) {
  const couleur = couleurScore(score);
  return (
    <div style={{ width: 68, height: 68, borderRadius: "50%", background: `conic-gradient(${couleur} ${score * 3.6}deg, var(--border) 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{score}</span>
        <span style={{ fontSize: 8, color: "var(--text-muted)" }}>/100</span>
      </div>
    </div>
  );
}

// Ligne « feu de circulation » : bande + pastille de la couleur du niveau,
// cible sous le libellé, état écrit à côté de la valeur.
function LigneSante({ label, cible, valeur, niveau, etat }) {
  const { couleur, fond } = NIVEAUX[niveau];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 42, paddingRight: 14, background: fond, borderTop: "1px solid var(--border)" }}>
      <span style={{ width: 5, alignSelf: "stretch", background: couleur, flexShrink: 0 }} />
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: niveau === "neutre" ? "var(--text-muted)" : couleur, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, padding: "6px 0" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
        {cible && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{cible}</div>}
      </div>
      {etat && <span style={{ fontSize: 11.5, fontWeight: 700, color: couleur, whiteSpace: "nowrap" }}>{etat}</span>}
      <span style={{ fontSize: 14, fontWeight: 800, minWidth: 70, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{valeur}</span>
    </div>
  );
}

const boutonMois = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 999, color: "#fff", textDecoration: "none", background: "rgba(255,255,255,0.12)" };

function BoutonAction({ icone, label, href }) {
  return (
    <Link href={href} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 8px", borderRadius: 16, textDecoration: "none", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(232,163,61,0.16)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom={icone} taille={22} couleur="var(--accent-ombre)" />
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.25 }}>{label}</span>
    </Link>
  );
}

// Revenus par poste (main-d'œuvre, pièces, remorquage…) et coûts par poste
// (salaires, charges employeur, coûtant des pièces, électricité, loyer…),
// puis les chiffres qui en découlent. Seuil de rentabilité au sens classique
// (point mort) : charges fixes ÷ taux de marge sur coûts variables — voir
// Comptabilité → Plan comptable pour classer chaque poste de dépense en
// Fixe ou Variable (par défaut : tout est Fixe sauf le coûtant des pièces).
function CarteRentabilite({ rentabilite, nomMois, annee, periode, onChangerPeriode }) {
  const donnees = periode === "annee" ? rentabilite.annee : rentabilite.mois;
  const { revenus, depenses, totalRevenus, totalDepenses, totalChargesFixes, totalChargesVariables } = donnees;
  const benefice = totalRevenus - totalDepenses;
  const margePct = totalRevenus > 0 ? (benefice / totalRevenus) * 100 : 0;

  const tauxMargeVariable = totalRevenus > 0 ? (totalRevenus - totalChargesVariables) / totalRevenus : null;
  const seuilCalculable = tauxMargeVariable !== null && tauxMargeVariable > 0;
  const seuilRentabilite = seuilCalculable ? totalChargesFixes / tauxMargeVariable : null;
  const excedent = seuilCalculable ? totalRevenus - seuilRentabilite : null;

  return (
    <div style={{ ...stylePanneau, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, fontWeight: 800 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: TEINTES.bleu.fond, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom="tendance" taille={18} couleur={TEINTES.bleu.couleur} />
          </span>
          Analyse de rentabilité
        </span>
        <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 10, padding: 4 }}>
          <button
            onClick={() => onChangerPeriode("mois")}
            style={{ fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: periode === "mois" ? "var(--accent)" : "none", color: periode === "mois" ? "#221f18" : "var(--text-muted)" }}
          >
            {nomMois}
          </button>
          <button
            onClick={() => onChangerPeriode("annee")}
            style={{ fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: periode === "annee" ? "var(--accent)" : "none", color: periode === "annee" ? "#221f18" : "var(--text-muted)" }}
          >
            Année {annee}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 16 }}>
        <SectionPostes titre="Revenus" postes={revenus} total={totalRevenus} couleur="var(--success)" />
        <SectionPostes titre="Coûts" postes={depenses} total={totalDepenses} couleur="var(--danger)" sousTotal={`Fixes ${fmt(totalChargesFixes)} · Variables ${fmt(totalChargesVariables)}`} />
      </div>

      <div
        className={seuilCalculable ? "grille-actions" : undefined}
        style={{ ...(seuilCalculable ? {} : { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }), paddingTop: 14, borderTop: "1px solid var(--border)" }}
      >
        <Metrique label="Bénéfice" valeur={fmt(benefice)} niveau={benefice >= 0 ? "bon" : "danger"} />
        <Metrique label="Marge nette" valeur={`${fmtNombre(margePct)} %`} niveau={totalRevenus > 0 ? niveauMarge(margePct).niveau : undefined} />
        {seuilCalculable ? (
          <>
            <Metrique label="Seuil de rentabilité" valeur={fmt(seuilRentabilite)} sousLabel="Revenu min. pour couvrir charges fixes et variables" />
            <Metrique label={excedent >= 0 ? "Excédent" : "Déficit"} valeur={fmt(Math.abs(excedent))} niveau={excedent >= 0 ? "bon" : "danger"} sousLabel="Par rapport au seuil de rentabilité" />
            <Metrique label="Revenus / seuil" valeur={`${fmtNombre((totalRevenus / seuilRentabilite) * 100, 0)} %`} niveau={totalRevenus >= seuilRentabilite ? "bon" : "danger"} sousLabel="100 % = seuil atteint" />
          </>
        ) : (
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Seuil de rentabilité non calculable — {totalRevenus <= 0 ? "aucun revenu sur cette période." : "les charges variables dépassent les revenus."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Tableau des postes : une ligne sur deux ombrée, part du total en % et
// mini-barre proportionnelle (plus pâle pour les charges fixes).
function SectionPostes({ titre, postes, total, couleur, sousTotal }) {
  const entete = { fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3 };
  return (
    <div>
      <div style={{ display: "flex", padding: "0 8px 6px", ...entete }}>
        <span style={{ flex: 1 }}>{titre}</span>
        <span style={{ width: 52, textAlign: "right" }}>%</span>
        <span style={{ width: 92, textAlign: "right" }}>Montant</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {postes.map((p, i) => {
          const pct = total > 0 ? (p.montant / total) * 100 : 0;
          return (
            <div key={p.numero} style={{ padding: "7px 8px", background: i % 2 === 0 ? "var(--surface-alt)" : "transparent", borderRadius: 6 }}>
              <div style={{ display: "flex", alignItems: "center", fontSize: 12.5 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {p.nom}
                  {p.typeCharge && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, marginLeft: 6, padding: "1px 6px", borderRadius: 999, background: p.typeCharge === "VARIABLE" ? "var(--bleu-fond)" : "var(--border)", color: p.typeCharge === "VARIABLE" ? "var(--bleu)" : "var(--text-muted)" }}>
                      {p.typeCharge === "VARIABLE" ? "Variable" : "Fixe"}
                    </span>
                  )}
                </span>
                <span style={{ width: 52, textAlign: "right", color: "var(--text-muted)" }}>{fmtNombre(pct)} %</span>
                <span style={{ width: 92, textAlign: "right", fontWeight: 600 }}>{fmt(p.montant)}</span>
              </div>
              <div style={{ height: 5, background: "var(--border)", borderRadius: 3, marginTop: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: couleur, opacity: p.typeCharge === "FIXE" ? 0.6 : 1, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
        {postes.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", margin: "0 8px" }}>Aucune donnée</p>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, margin: "6px 0 0", padding: "6px 8px 0", borderTop: "1px solid var(--border)", color: couleur }}>
        <span>Total {titre.toLowerCase()}</span>
        <span>{fmt(total)}</span>
      </div>
      {sousTotal && <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3, padding: "0 8px", textAlign: "right" }}>{sousTotal}</div>}
    </div>
  );
}

function Metrique({ label, valeur, niveau, sousLabel }) {
  const n = niveau ? NIVEAUX[niveau] : null;
  return (
    <div style={{ background: n ? n.fond : "var(--surface-alt)", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: n ? n.couleur : "var(--text)", fontVariantNumeric: "tabular-nums" }}>{valeur}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>{label}</div>
      {sousLabel && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sousLabel}</div>}
    </div>
  );
}
