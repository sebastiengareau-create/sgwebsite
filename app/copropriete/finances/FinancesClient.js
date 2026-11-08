"use client";

import { useState } from "react";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { BoutonPlein } from "../../components/StyleSection";
import {
  MODES_PAIEMENT, argent, pourcent, libelle, dateLisible, repartitionBudget, totalBudget, prevoyanceSuffisante, budgetPourPeriode, periodeLisible, nomsProprietaires, TYPES_CHARGE,
} from "@/lib/coproprieteCalculs";
import {
  NavCopro, Section, Formulaire, Onglets, BoutonTexte, BoutonSupprimer, Vide, Tableau, cellule, celluleDroite, valeursDe, aujourdhui, useApi, Erreur, champStyle, Statistique,
} from "../ui";

const ONGLETS = [
  { code: "BUDGET", label: "Budget" },
  { code: "COTISATIONS", label: "Cotisations" },
  { code: "SOLDES", label: "Paiements" },
];

const champsBudget = [
  { nom: "annee", label: "Exercice (année de début)", type: "nombre" },
  { nom: "moisDebut", label: "Premier mois de l'exercice", type: "choix", defaut: "1", options: Array.from({ length: 12 }, (_, i) => ({ code: String(i + 1), label: new Intl.DateTimeFormat("fr-CA", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, i, 15))) })) },
  { nom: "chargesCourantes", label: "Charges courantes ($ / an)", type: "nombre" },
  { nom: "fondsPrevoyance", label: "Fonds de prévoyance ($ / an)", type: "nombre" },
  { nom: "fondsAutoAssurance", label: "Fonds d'autoassurance ($ / an)", type: "nombre" },
  { nom: "adopteLe", label: "Adopté le", type: "date" },
  { nom: "notes", label: "Notes", type: "long", lignes: 2 },
];

export default function FinancesClient({ budgets, unites, soldes, cotisations, derniersPaiements, ongletInitial }) {
  const [onglet, setOnglet] = useState(ONGLETS.some((o) => o.code === ongletInitial) ? ongletInitial : "BUDGET");
  return (
    <div className="conteneur-page">
      <BandeauSection icone="💰" titre="Charges communes" sousTitre="Budget annuel, répartition selon les quotes-parts, cotisations mensuelles et paiements." />
      <NavCopro actif="/copropriete/finances" />
      <Onglets options={ONGLETS} valeur={onglet} onChange={setOnglet} />
      {onglet === "BUDGET" && <Budgets budgets={budgets} unites={unites} />}
      {onglet === "COTISATIONS" && <Cotisations budgets={budgets} cotisations={cotisations} />}
      {onglet === "SOLDES" && <Soldes unites={unites} soldes={soldes} derniersPaiements={derniersPaiements} />}
    </div>
  );
}

function Budgets({ budgets, unites }) {
  const enVigueur = budgetPourPeriode(budgets, aujourdhui().slice(0, 7));
  const [choisi, setChoisi] = useState(enVigueur?.id || budgets[0]?.id || null);
  const [formulaire, setFormulaire] = useState(false);
  const [edition, setEdition] = useState(false);
  const budget = budgets.find((b) => b.id === choisi);
  const anneeSuivante = (budgets[0]?.annee || Number(aujourdhui().slice(0, 4)) - 1) + 1;
  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouveau budget"}</BoutonPlein>
        {budgets.length > 0 && (
          <select value={choisi || ""} onChange={(e) => { setChoisi(e.target.value); setEdition(false); }} style={{ ...champStyle, width: "auto", marginBottom: 0 }}>
            {budgets.map((b) => <option key={b.id} value={b.id}>Exercice {b.annee}{b.id === enVigueur?.id ? " (en vigueur)" : ""}</option>)}
          </select>
        )}
      </div>
      {formulaire && (
        <Formulaire
          champs={champsBudget}
          initial={budgets[0] ? { ...valeursDe(budgets[0], champsBudget), annee: String(anneeSuivante), adopteLe: "", notes: "" } : { annee: String(anneeSuivante) }}
          url="/api/copropriete/budgets" bouton="Ajouter le budget" onFini={(d) => { setFormulaire(false); setChoisi(d.id); }}
        />
      )}
      {!budget ? <Vide>Aucun budget. Ajoute celui de l'exercice adopté en assemblée : il sera réparti entre les unités selon leur quote-part.</Vide> : (
        <>
          <Section titre={`Budget ${budget.annee}${budget.moisDebut !== 1 ? `-${budget.annee + 1}` : ""}`} droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
            {edition ? (
              <>
                <Formulaire key={budget.id} cadre={false} champs={champsBudget} initial={valeursDe(budget, champsBudget)} url={`/api/copropriete/budgets/${budget.id}`} methode="PATCH" onFini={() => setEdition(false)} />
                <div style={{ marginTop: 10 }}><BoutonSupprimer url={`/api/copropriete/budgets/${budget.id}`} confirmation={`Supprimer le budget ${budget.annee} ? Les cotisations déjà générées restent.`} onFini={() => setChoisi(null)}>Supprimer ce budget</BoutonSupprimer></div>
              </>
            ) : (
              <>
                <div className="ligne-info"><span>Charges courantes</span><span>{argent(budget.chargesCourantes)}</span></div>
                <div className="ligne-info"><span>Fonds de prévoyance</span><span>{argent(budget.fondsPrevoyance)}{budget.chargesCourantes > 0 && <span style={{ color: "var(--text-muted)", fontSize: 12 }}> ({pourcent((budget.fondsPrevoyance / budget.chargesCourantes) * 100, 1)} des charges)</span>}</span></div>
                {budget.fondsAutoAssurance > 0 && <div className="ligne-info"><span>Fonds d'autoassurance</span><span>{argent(budget.fondsAutoAssurance)}</span></div>}
                <div className="ligne-info" style={{ fontWeight: 700 }}><span>Total annuel</span><span>{argent(totalBudget(budget))}</span></div>
                <div className="ligne-info"><span>Par mois</span><span>{argent(totalBudget(budget) / 12)}</span></div>
                {budget.adopteLe && <div className="ligne-info"><span>Adopté le</span><span>{dateLisible(budget.adopteLe)}</span></div>}
                {!prevoyanceSuffisante(budget) && (
                  <p style={{ fontSize: 12.5, color: "var(--danger)", margin: "8px 0 0" }}>⚠️ La contribution au fonds de prévoyance est sous 5 % des charges courantes, le minimum du Code civil (art. 1071), à moins que l'étude du fonds n'en exige davantage.</p>
                )}
                {budget.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{budget.notes}</p>}
              </>
            )}
          </Section>
          <Repartition budget={budget} unites={unites} />
        </>
      )}
    </>
  );
}

function Repartition({ budget, unites }) {
  const r = repartitionBudget(budget, unites);
  const avecAuto = budget.fondsAutoAssurance > 0;
  return (
    <Section titre="Répartition des charges communes">
      {r.ecartQp && <p style={{ fontSize: 12.5, color: "var(--danger)", margin: "0 0 8px" }}>⚠️ Les quotes-parts totalisent {pourcent(r.totalQp)} au lieu de 100 % : la répartition est faite au prorata, vérifie les quotes-parts des unités.</p>}
      {unites.length === 0 ? <Vide>Aucune unité.</Vide> : (
        <Tableau entetes={["Unité", "Propriétaires", "Quote-part", "Charges", "Prévoyance", ...(avecAuto ? ["Autoassurance"] : []), "Annuel", "Mensuel"]} alignDroite={avecAuto ? [2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6]}>
          {r.lignes.map((l) => {
            const u = unites.find((x) => x.id === l.uniteId);
            return (
              <tr key={l.uniteId}>
                <td style={cellule}><Link href={`/copropriete/unites/${l.uniteId}`} style={{ color: "var(--accent)", fontWeight: 700 }}>{l.numero}</Link></td>
                <td style={{ ...cellule, fontSize: 12.5 }}>{nomsProprietaires(u) || "—"}</td>
                <td style={celluleDroite}>{pourcent(l.quotePart)}</td>
                <td style={celluleDroite}>{argent(l.charges)}</td>
                <td style={celluleDroite}>{argent(l.prevoyance)}</td>
                {avecAuto && <td style={celluleDroite}>{argent(l.autoAssurance)}</td>}
                <td style={celluleDroite}>{argent(l.annuel)}</td>
                <td style={{ ...celluleDroite, fontWeight: 700 }}>{argent(l.mensuel)}</td>
              </tr>
            );
          })}
          <tr>
            <td style={{ ...cellule, fontWeight: 700 }} colSpan={2}>Total</td>
            <td style={{ ...celluleDroite, fontWeight: 700 }}>{pourcent(r.totalQp)}</td>
            <td style={celluleDroite}>{argent(r.lignes.reduce((s, l) => s + l.charges, 0))}</td>
            <td style={celluleDroite}>{argent(r.lignes.reduce((s, l) => s + l.prevoyance, 0))}</td>
            {avecAuto && <td style={celluleDroite}>{argent(r.lignes.reduce((s, l) => s + l.autoAssurance, 0))}</td>}
            <td style={{ ...celluleDroite, fontWeight: 700 }}>{argent(r.lignes.reduce((s, l) => s + l.annuel, 0))}</td>
            <td style={{ ...celluleDroite, fontWeight: 700 }}>{argent(r.lignes.reduce((s, l) => s + l.mensuel, 0))}</td>
          </tr>
        </Tableau>
      )}
    </Section>
  );
}

function Cotisations({ budgets, cotisations }) {
  const [periode, setPeriode] = useState(aujourdhui().slice(0, 7));
  const [resultat, setResultat] = useState("");
  const { appeler, enCours, erreur } = useApi();
  const budget = budgetPourPeriode(budgets, periode);
  const periodes = [...new Set(cotisations.map((c) => c.periode))].sort().reverse();

  async function generer() {
    setResultat("");
    if (!window.confirm(`Générer les cotisations de ${periodeLisible(periode)} pour toutes les unités ?`)) return;
    const r = await appeler("/api/copropriete/charges", "POST", { generer: periode });
    if (r) setResultat(r.creees > 0 ? `${r.creees} cotisation${r.creees > 1 ? "s" : ""} ajoutée${r.creees > 1 ? "s" : ""} aux comptes des unités.` : "Rien à ajouter : chaque unité a déjà sa cotisation de ce mois.");
  }

  return (
    <>
      <Section titre="Générer les cotisations du mois">
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
          Ajoute au compte de chaque unité sa part mensuelle du budget (quote-part × budget ÷ 12), plus les frais mensuels de ses stationnements et rangements. Une unité n'est jamais facturée deux fois pour le même mois.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} style={{ ...champStyle, width: "auto", marginBottom: 0 }} />
          <button type="button" onClick={generer} disabled={enCours || !periode} className="bouton-3d" style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>{enCours ? "…" : "Générer"}</button>
        </div>
        <p style={{ fontSize: 12.5, margin: "8px 0 0", color: budget ? "var(--text-muted)" : "var(--danger)" }}>
          {budget ? `Budget ${budget.annee} : ${argent(totalBudget(budget) / 12)} à répartir ce mois-ci.` : "Aucun budget ne couvre ce mois."}
        </p>
        {resultat && <p style={{ fontSize: 12.5, color: "var(--success)", margin: "8px 0 0" }}>{resultat}</p>}
        <Erreur texte={erreur} />
      </Section>
      <Section titre="Cotisations générées">
        {periodes.length === 0 ? <Vide>Aucune cotisation générée.</Vide> : (
          <Tableau entetes={["Mois", "Type", "Unités", "Total"]} alignDroite={[2, 3]}>
            {periodes.flatMap((p) => cotisations.filter((c) => c.periode === p).map((c) => (
              <tr key={`${p}-${c.type}`}>
                <td style={cellule}>{periodeLisible(p)}</td>
                <td style={cellule}>{libelle(TYPES_CHARGE, c.type)}</td>
                <td style={celluleDroite}>{c._count}</td>
                <td style={celluleDroite}>{argent(c._sum.montant)}</td>
              </tr>
            )))}
          </Tableau>
        )}
      </Section>
    </>
  );
}

const champsPaiement = (unites) => [
  { nom: "uniteId", label: "Unité", type: "choix", vide: "—", options: unites.map((u) => ({ code: u.id, label: `${u.numero}${nomsProprietaires(u) ? ` — ${nomsProprietaires(u)}` : ""}` })) },
  { nom: "date", label: "Date", type: "date" },
  { nom: "montant", label: "Montant ($)", type: "nombre" },
  { nom: "mode", label: "Mode", type: "choix", vide: "—", options: MODES_PAIEMENT },
  { nom: "reference", label: "Référence (no de chèque…)" },
];

function Soldes({ unites, soldes, derniersPaiements }) {
  const [formulaire, setFormulaire] = useState(false);
  const solde = (id) => Math.round((soldes[id] || 0) * 100) / 100;
  const aRecevoir = unites.filter((u) => solde(u.id) > 0.005);
  const credits = unites.filter((u) => solde(u.id) < -0.005);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Statistique valeur={argent(aRecevoir.reduce((s, u) => s + solde(u.id), 0))} label={`À recevoir (${aRecevoir.length} unité${aRecevoir.length > 1 ? "s" : ""})`} teinte="var(--danger)" />
        <Statistique valeur={argent(-credits.reduce((s, u) => s + solde(u.id), 0))} label={`Payé d'avance (${credits.length})`} teinte="var(--success)" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Enregistrer un paiement"}</BoutonPlein>
      </div>
      {formulaire && <Formulaire champs={champsPaiement(unites)} initial={{ date: aujourdhui() }} url="/api/copropriete/paiements" bouton="Enregistrer le paiement" onFini={() => setFormulaire(false)} />}
      <Section titre="Solde de chaque unité">
        {unites.length === 0 ? <Vide>Aucune unité.</Vide> : (
          <Tableau entetes={["Unité", "Propriétaires", "Solde"]} alignDroite={[2]}>
            {unites.map((u) => (
              <tr key={u.id}>
                <td style={cellule}><Link href={`/copropriete/unites/${u.id}`} style={{ color: "var(--accent)", fontWeight: 700 }}>{u.numero}</Link></td>
                <td style={{ ...cellule, fontSize: 12.5 }}>{nomsProprietaires(u) || "—"}</td>
                <td style={{ ...celluleDroite, fontWeight: 700, color: solde(u.id) > 0.005 ? "var(--danger)" : solde(u.id) < -0.005 ? "var(--success)" : "var(--text-muted)" }}>{argent(solde(u.id))}</td>
              </tr>
            ))}
          </Tableau>
        )}
      </Section>
      <Section titre="Derniers paiements reçus">
        {derniersPaiements.length === 0 ? <Vide>Aucun paiement.</Vide> : (
          <Tableau entetes={["Date", "Unité", "Mode", "Montant", ""]} alignDroite={[3]}>
            {derniersPaiements.map((p) => (
              <tr key={p.id}>
                <td style={cellule}>{dateLisible(p.date)}</td>
                <td style={cellule}>{p.unite.numero}</td>
                <td style={cellule}>{[p.mode && libelle(MODES_PAIEMENT, p.mode), p.reference].filter(Boolean).join(" · ") || "—"}</td>
                <td style={celluleDroite}>{argent(p.montant)}</td>
                <td style={{ ...cellule, textAlign: "right" }}><BoutonSupprimer url={`/api/copropriete/paiements/${p.id}`} confirmation={`Supprimer ce paiement de ${argent(p.montant)} (unité ${p.unite.numero}) ?`}>✕</BoutonSupprimer></td>
              </tr>
            ))}
          </Tableau>
        )}
      </Section>
    </>
  );
}
