"use client";

import Link from "next/link";
import BandeauSection from "../components/BandeauSection";
import {
  argent, pourcent, dateLisible, etatEcheance, budgetPourPeriode, totalBudget, libelle, trouver,
  PRIORITES, STATUTS_DEMANDE, STATUTS_TRAVAIL, CATEGORIES_DOCUMENTS, TYPES_ENTRETIEN,
} from "@/lib/coproprieteCalculs";
import { NavCopro, Section, Statistique, PastilleCode, Vide, aujourdhui } from "./ui";

const rangPriorite = (p) => trouver(PRIORITES, p)?.rang ?? 9;

export default function TableauBordClient({ unites, nbCoproprietaires, demandes, travaux, entretiens, budgets, documents, soldes }) {
  const totalQp = unites.reduce((s, u) => s + (u.quotePart || 0), 0);
  const sansProprietaire = unites.filter((u) => u.proprietes.length === 0).length;
  const aRecevoir = soldes.filter((s) => s.solde > 0.005);
  const totalARecevoir = aRecevoir.reduce((s, x) => s + x.solde, 0);
  const numeroUnite = Object.fromEntries(unites.map((u) => [u.id, u.numero]));
  const budget = budgetPourPeriode(budgets, aujourdhui().slice(0, 7));
  const aVenir = entretiens.map((e) => ({ ...e, etat: etatEcheance(e.prochaineDate) })).filter((e) => e.etat.code !== "PLUS_TARD");
  const enRetard = aVenir.filter((e) => e.etat.code === "RETARD").length;
  const demandesTriees = [...demandes].sort((a, b) => rangPriorite(a.priorite) - rangPriorite(b.priorite) || new Date(b.creeLe) - new Date(a.creeLe));

  return (
    <div className="conteneur-page">
      <BandeauSection icone="🏢" titre="Copropriété" sousTitre="Unités, copropriétaires, charges communes, entretien et documents du syndicat." />
      <NavCopro actif="/copropriete" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10, marginBottom: 16 }}>
        <Statistique valeur={unites.length} label={`Unités · ${nbCoproprietaires} copropriétaire${nbCoproprietaires > 1 ? "s" : ""}`} teinte="var(--bleu)" />
        <Statistique valeur={argent(totalARecevoir)} label={`À recevoir (${aRecevoir.length} unité${aRecevoir.length > 1 ? "s" : ""})`} teinte={totalARecevoir > 0 ? "var(--danger)" : "var(--success)"} />
        <Statistique valeur={demandes.length} label="Demandes ouvertes" teinte="var(--accent)" />
        <Statistique valeur={travaux.length} label="Bons de travail ouverts" teinte="#8C6BC4" />
        <Statistique valeur={enRetard} label="Entretiens en retard" teinte={enRetard > 0 ? "var(--danger)" : "var(--success)"} />
      </div>

      {(unites.length > 0 && Math.abs(totalQp - 100) > 0.001) && (
        <Alerte>Les quotes-parts totalisent {pourcent(totalQp)} au lieu de 100 % — vérifie-les dans <Link href="/copropriete/unites" style={{ color: "var(--accent)" }}>Unités</Link> (déclaration de copropriété).</Alerte>
      )}
      {sansProprietaire > 0 && <Alerte>{sansProprietaire} unité{sansProprietaire > 1 ? "s n'ont" : " n'a"} aucun propriétaire inscrit.</Alerte>}
      {!budget && <Alerte>Aucun budget ne couvre le mois en cours : ajoute-le dans <Link href="/copropriete/finances" style={{ color: "var(--accent)" }}>Charges</Link> pour générer les cotisations.</Alerte>}
      {unites.length === 0 && (
        <Section titre="Pour commencer">
          <ol style={{ fontSize: 13.5, margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Ajoute le ou les bâtiments, puis les <Link href="/copropriete/unites" style={{ color: "var(--accent)" }}>unités</Link> avec leur quote-part (déclaration de copropriété).</li>
            <li>Inscris les <Link href="/copropriete/coproprietaires" style={{ color: "var(--accent)" }}>copropriétaires</Link> et relie-les à leurs unités.</li>
            <li>Entre le budget de l'exercice dans <Link href="/copropriete/finances" style={{ color: "var(--accent)" }}>Charges</Link> : la répartition se calcule toute seule.</li>
            <li>Planifie l'entretien préventif et les inspections, et dépose les documents du syndicat.</li>
            <li>Active le portail de chaque copropriétaire : il y verra ses documents et pourra faire ses demandes.</li>
          </ol>
        </Section>
      )}

      <Section titre="Demandes à traiter" droite={<Link href="/copropriete/entretien" style={{ fontSize: 12, color: "var(--accent)" }}>Tout voir</Link>}>
        {demandesTriees.length === 0 ? <Vide>Aucune demande ouverte.</Vide> : demandesTriees.slice(0, 8).map((d) => (
          <Link key={d.id} href={`/copropriete/demandes/${d.id}`} className="ligne-info" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
            <span style={{ minWidth: 0 }}>
              <strong>{d.numero}</strong> {d.titre}
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}> · {d.unite ? `unité ${d.unite.numero}` : d.emplacement || "parties communes"}{d.source === "PORTAIL" && " · 🌐 portail"}</span>
            </span>
            <span style={{ display: "flex", gap: 4, flexShrink: 0 }}><PastilleCode liste={PRIORITES} code={d.priorite} /><PastilleCode liste={STATUTS_DEMANDE} code={d.statut} /></span>
          </Link>
        ))}
      </Section>

      <Section titre="Travaux en cours" droite={<Link href="/copropriete/entretien?onglet=TRAVAUX" style={{ fontSize: 12, color: "var(--accent)" }}>Tout voir</Link>}>
        {travaux.length === 0 ? <Vide>Aucun bon de travail ouvert.</Vide> : travaux.slice(0, 8).map((t) => (
          <Link key={t.id} href={`/copropriete/travaux/${t.id}`} className="ligne-info" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
            <span style={{ minWidth: 0 }}>
              <strong>{t.numero}</strong> {t.titre}
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{t.fournisseur && ` · ${t.fournisseur.nom}`}{t.datePrevue && ` · ${dateLisible(t.datePrevue)}`}</span>
            </span>
            <PastilleCode liste={STATUTS_TRAVAIL} code={t.statut} />
          </Link>
        ))}
      </Section>

      <Section titre="Entretiens et inspections — 30 prochains jours" droite={<Link href="/copropriete/entretien?onglet=PREVENTIF" style={{ fontSize: 12, color: "var(--accent)" }}>Calendrier</Link>}>
        {aVenir.length === 0 ? <Vide>Rien d'échu ni de prévu d'ici 30 jours.</Vide> : aVenir.map((e) => (
          <div key={e.id} className="ligne-info">
            <span>{trouver(TYPES_ENTRETIEN, e.type)?.icone} {e.titre}{e.obligatoire && " ⚖️"}</span>
            <span style={{ color: e.etat.couleur, fontWeight: 700 }}>{dateLisible(e.prochaineDate)} · {e.etat.label}</span>
          </div>
        ))}
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <Section titre="Comptes en souffrance" droite={<Link href="/copropriete/finances?onglet=SOLDES" style={{ fontSize: 12, color: "var(--accent)" }}>Soldes</Link>}>
          {aRecevoir.length === 0 ? <Vide>Toutes les unités sont à jour.</Vide> : [...aRecevoir].sort((a, b) => b.solde - a.solde).slice(0, 8).map((s) => (
            <Link key={s.uniteId} href={`/copropriete/unites/${s.uniteId}`} className="ligne-info" style={{ textDecoration: "none", color: "inherit" }}>
              <span>Unité {numeroUnite[s.uniteId]}</span><span style={{ color: "var(--danger)", fontWeight: 700 }}>{argent(s.solde)}</span>
            </Link>
          ))}
        </Section>
        <Section titre={budget ? `Budget ${budget.annee}` : "Budget"}>
          {budget ? (
            <>
              <div className="ligne-info"><span>Charges courantes</span><span>{argent(budget.chargesCourantes)}</span></div>
              <div className="ligne-info"><span>Fonds de prévoyance</span><span>{argent(budget.fondsPrevoyance)}</span></div>
              {budget.fondsAutoAssurance > 0 && <div className="ligne-info"><span>Fonds d'autoassurance</span><span>{argent(budget.fondsAutoAssurance)}</span></div>}
              <div className="ligne-info" style={{ fontWeight: 700 }}><span>Total annuel</span><span>{argent(totalBudget(budget))}</span></div>
            </>
          ) : <Vide>Aucun budget en vigueur.</Vide>}
        </Section>
        <Section titre="Derniers documents" droite={<Link href="/copropriete/documents" style={{ fontSize: 12, color: "var(--accent)" }}>Tous</Link>}>
          {documents.length === 0 ? <Vide>Aucun document déposé.</Vide> : documents.map((d) => (
            <a key={d.id} href={`/api/copropriete/documents/${d.id}`} target="_blank" rel="noreferrer" className="ligne-info" style={{ textDecoration: "none", color: "inherit" }}>
              <span>{trouver(CATEGORIES_DOCUMENTS, d.categorie)?.icone} {d.titre}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{libelle(CATEGORIES_DOCUMENTS, d.categorie).split(" ")[0]}</span>
            </a>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Alerte({ children }) {
  return (
    <div style={{ background: "var(--danger-fond)", border: "1px solid var(--danger)", color: "var(--text)", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
      ⚠️ {children}
    </div>
  );
}
