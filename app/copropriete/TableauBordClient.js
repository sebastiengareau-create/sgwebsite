"use client";

import Link from "next/link";
import {
  argent, pourcent, dateLisible, etatEcheance, budgetPourPeriode, budgetDuGroupe, groupesRepartition, seulGroupe, totalBudget, libelle, trouver, periodeLisible,
  PRIORITES, STATUTS_DEMANDE, STATUTS_TRAVAIL, CATEGORIES_DOCUMENTS, TYPES_ENTRETIEN,
} from "@/lib/coproprieteCalculs";
import { CONSEILS_MOIS_COPRO, ETATS_UNITE, etatUnite, batimentsPourRue } from "@/lib/coproprieteVisuel";
import { TEINTES } from "../components/StyleSection";
import TuileVive from "../components/TuileVive";
import HeroRue, { ConseilDuMois, majuscule } from "../components/HeroRue";
import { LegendeEtats, CarreEtat, ImageImmeuble } from "../immobilier/CartesImmeubles";
import { NavCopro, Section, PastilleCode, Vide, aujourdhui } from "./ui";

// Bleu de la marque Copropriété
const TEINTE_COPRO = { couleur: "var(--copro)", fond: "var(--copro-fond)" };
const s = (n) => (n > 1 ? "s" : "");

const rangPriorite = (p) => trouver(PRIORITES, p)?.rang ?? 9;

export default function TableauBordClient({ unites, nbCoproprietaires, demandes, travaux, entretiens, budgets, documents, soldes, batiments = [], duCeMois = {}, periode, vueRue, percuCeMois = 0, visuel }) {
  const sansProprietaire = unites.filter((u) => u.proprietes.length === 0).length;
  const aRecevoir = soldes.filter((s) => s.solde > 0.005);
  const totalARecevoir = aRecevoir.reduce((s, x) => s + x.solde, 0);
  const numeroUnite = Object.fromEntries(unites.map((u) => [u.id, u.numero]));
  // Quotes-parts et budget de chaque bâtiment (100 % par bâtiment, un budget chacun)
  const seul = seulGroupe(unites);
  const groupes = groupesRepartition(unites, batiments).map((g) => ({
    ...g, qp: g.unites.reduce((s, u) => s + (u.quotePart || 0), 0), budget: budgetDuGroupe(budgets, aujourdhui().slice(0, 7), g.batimentId, seul),
  }));
  const ecartsQp = groupes.filter((g) => Math.abs(g.qp - 100) > 0.001);
  const sansBudget = groupes.filter((g) => !g.budget);
  const enVigueur = groupes.filter((g) => g.budget);
  // Un seul groupe : son budget, affiché en détail ; plusieurs : un total par bâtiment
  const budget = groupes.length <= 1 ? (groupes[0] ? groupes[0].budget : budgetPourPeriode(budgets, aujourdhui().slice(0, 7))) : null;
  const totalAnnuel = groupes.length <= 1 ? (budget ? totalBudget(budget) : 0) : enVigueur.reduce((s, g) => s + totalBudget(g.budget), 0);
  const aVenir = entretiens.map((e) => ({ ...e, etat: etatEcheance(e.prochaineDate) })).filter((e) => e.etat.code !== "PLUS_TARD");
  const enRetard = aVenir.filter((e) => e.etat.code === "RETARD").length;
  const demandesTriees = [...demandes].sort((a, b) => rangPriorite(a.priorite) - rangPriorite(b.priorite) || new Date(b.creeLe) - new Date(a.creeLe));

  // Rue illustrée : un immeuble par bâtiment, une fenêtre par unité
  const soldeDe = Object.fromEntries(soldes.map((x) => [x.uniteId, x.solde]));
  const demandesDe = {};
  for (const d of demandes) if (d.uniteId) demandesDe[d.uniteId] = (demandesDe[d.uniteId] || 0) + 1;
  const infos = {};
  for (const u of unites) {
    const etat = etatUnite({ solde: soldeDe[u.id] || 0, duCeMois: duCeMois[u.id] || 0, demandes: demandesDe[u.id] || 0, proprietaires: u.proprietes.length });
    const noms = u.proprietes.map((p) => p.coproprietaire?.nom).filter(Boolean).join(", ");
    infos[u.id] = { etat, texte: [`Unité ${u.numero}`, noms, ETATS_UNITE[etat].toLowerCase()].filter(Boolean).join(" · ") };
  }
  const rue = batimentsPourRue(batiments, unites);
  const enRetardUnites = Object.values(infos).filter((i) => i.etat === "RETARD").length;
  const attendu = Object.values(duCeMois).reduce((t, x) => t + x, 0);
  const encaisse = attendu > 0 ? Math.min(1, percuCeMois / attendu) : 0;
  const mois = periodeLisible(periode || aujourdhui().slice(0, 7)).split(" ")[0];

  return (
    <div className="conteneur-page">
      <HeroCopro
        visuel={visuel} rue={rue} infos={infos} mois={mois} attendu={attendu} percu={percuCeMois} encaisse={encaisse}
        nbUnites={unites.length} nbCoproprietaires={nbCoproprietaires} nbDemandes={demandes.length} totalAnnuel={totalAnnuel}
      />
      {rue.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "6px 14px", margin: "0 4px 14px" }}>
          <LegendeEtats infos={infos} libelles={ETATS_UNITE} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Une fenêtre par unité · touche un bâtiment pour l'ouvrir</span>
        </div>
      )}
      <NavCopro actif="/copropriete" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10, marginBottom: 16 }}>
        <TuileVive
          href="/copropriete/finances?onglet=COTISATIONS" icone="banque" teinte={TEINTES.vert} label={`Encaissé en ${mois}`} valeur={argent(percuCeMois)}
          note={attendu > 0 ? `sur ${argent(attendu)} de cotisations du mois` : "aucune cotisation inscrite ce mois-ci"} jauge={attendu > 0 ? encaisse : null}
        />
        <TuileVive
          href="/copropriete/finances?onglet=SOLDES" icone="alerte" teinte={totalARecevoir > 0.005 ? TEINTES.rouge : TEINTES.vert} label="À recevoir" valeur={argent(totalARecevoir)}
          couleur={enRetardUnites > 0 ? "var(--danger)" : undefined}
          note={aRecevoir.length === 0 ? "toutes les unités sont à jour" : `${aRecevoir.length} unité${s(aRecevoir.length)}${enRetardUnites ? ` · ${enRetardUnites} en retard` : ""}`}
        />
        <TuileVive href="/copropriete/entretien" icone="outils" teinte={demandes.some((d) => d.priorite === "URGENTE") ? TEINTES.rouge : TEINTE_COPRO} label="Demandes ouvertes" valeur={String(demandes.length)} note={`${travaux.length} bon${s(travaux.length)} de travail ouvert${s(travaux.length)}`} />
        <TuileVive href="/copropriete/entretien?onglet=PREVENTIF" icone="calendrier" teinte={enRetard > 0 ? TEINTES.rouge : TEINTES.bleu} label="Entretiens" valeur={String(aVenir.length)} note={enRetard > 0 ? `${enRetard} en retard` : "d'ici 30 jours"} />
      </div>

      <ConseilDuMois conseil={visuel ? CONSEILS_MOIS_COPRO[visuel.mois - 1] : null} etiquette={`En ${mois}, au syndicat`} couleur="var(--copro)" fond="var(--copro-fond)" />

      {ecartsQp.map((g) => (
        <Alerte key={g.batimentId || "copro"}>Les quotes-parts {groupes.length > 1 ? `de ${g.nom || "des unités sans bâtiment"} ` : ""}totalisent {pourcent(g.qp)} au lieu de 100 %{groupes.length > 1 ? " (100 % par bâtiment)" : ""} — vérifie-les dans <Link href={g.batimentId && groupes.length > 1 ? `/copropriete/batiments/${g.batimentId}` : "/copropriete/unites"} style={{ color: "var(--accent)" }}>{g.nom && groupes.length > 1 ? g.nom : "Unités"}</Link> (déclaration de copropriété).</Alerte>
      ))}
      {sansProprietaire > 0 && <Alerte>{sansProprietaire} unité{sansProprietaire > 1 ? "s n'ont" : " n'a"} aucun propriétaire inscrit.</Alerte>}
      {(groupes.length === 0 ? !budget : sansBudget.length > 0) && <Alerte>Aucun budget ne couvre le mois en cours{groupes.length > 1 ? ` pour ${sansBudget.map((g) => g.nom || "Sans bâtiment").join(", ")}` : ""} : ajoute-le dans <Link href="/copropriete/finances" style={{ color: "var(--accent)" }}>Charges</Link> pour générer les cotisations.</Alerte>}
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

      {rue.length > 0 && (
        <Section titre={rue.length > 1 ? "Mes bâtiments" : "Mon immeuble"} droite={<Link href="/copropriete/unites?onglet=BATIMENTS" style={{ fontSize: 12, color: "var(--accent)" }}>Bâtiments</Link>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))", gap: 12, marginTop: 10 }}>
            {rue.map((b) => <CarteBatiment key={b.id} batiment={b} infos={infos} visuel={visuel} vueRue={vueRue} duCeMois={duCeMois} demandesDe={demandesDe} />)}
          </div>
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
        <Section titre={budget ? `Budget ${budget.annee}` : groupes.length > 1 ? "Budgets des bâtiments" : "Budget"}>
          {groupes.length > 1 ? (
            <>
              {groupes.map((g) => (
                <div key={g.batimentId || "copro"} className="ligne-info"><span>{g.nom || "Sans bâtiment"}{g.budget && <span style={{ color: "var(--text-muted)", fontSize: 12 }}> · {g.budget.annee}</span>}</span><span style={g.budget ? undefined : { color: "var(--danger)" }}>{g.budget ? argent(totalBudget(g.budget)) : "aucun budget"}</span></div>
              ))}
              <div className="ligne-info" style={{ fontWeight: 700 }}><span>Total annuel</span><span>{argent(totalAnnuel)}</span></div>
            </>
          ) : budget ? (
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

// En-tête : ciel, salutation, cotisations du mois et rue des bâtiments
function HeroCopro({ visuel, rue, infos, mois, attendu, percu, encaisse, nbUnites, nbCoproprietaires, nbDemandes, totalAnnuel }) {
  if (!visuel) return null;
  const tout = attendu > 0 && encaisse >= 0.999;
  const phrase = nbUnites === 0
    ? "Bienvenue ! Ajoute les unités de l'immeuble : elles s'allumeront ici, une fenêtre par unité."
    : tout
      ? `Toutes les cotisations de ${mois} sont encaissées. Beau travail ! 🎉`
      : attendu > 0
        ? `${majuscule(mois)} : ${argent(percu)} de cotisations encaissées sur ${argent(attendu)}`
        : `Aucune cotisation inscrite pour ${mois} pour le moment.`;
  return (
    <HeroRue
      visuel={visuel} badge="🏢 COPROPRIÉTÉ" phrase={phrase}
      jauge={attendu > 0 ? { valeur: encaisse, tout, libelle: `Cotisations de ${mois} encaissées` } : null}
      puces={nbUnites > 0 ? [
        ...(rue.length > 1 ? [`🏢 ${rue.length} bâtiments`] : []),
        `🚪 ${nbUnites} unité${s(nbUnites)}`, `👥 ${nbCoproprietaires} copropriétaire${s(nbCoproprietaires)}`,
        `🛠️ ${nbDemandes} demande${s(nbDemandes)} ouverte${s(nbDemandes)}`,
        ...(totalAnnuel > 0 ? [`💰 ${argent(totalAnnuel)} / an`] : []),
      ] : []}
      immeubles={rue} infos={infos} hrefDe={hrefBatiment} plus="/copropriete/unites?onglet=BATIMENTS"
    />
  );
}

// Fiche d'un bâtiment et son plan par étages ; les unités sans bâtiment : la liste des unités
const hrefBatiment = (b) => (b.id === "sans-batiment" ? "/copropriete/unites" : `/copropriete/batiments/${b.id}`);

// Carte d'un bâtiment : photo (ou façade illustrée), une case par unité,
// cotisations du mois, demandes ouvertes
function CarteBatiment({ batiment: b, infos, visuel, vueRue, duCeMois, demandesDe }) {
  const unites = b.logements.filter((u) => u.type === "LOGEMENT" || u.type === "COMMERCIAL");
  const aJour = unites.filter((u) => infos[u.id]?.etat !== "RETARD").length;
  const cotisations = b.logements.reduce((t, u) => t + (duCeMois[u.id] || 0), 0);
  const demandes = b.logements.reduce((t, u) => t + (demandesDe[u.id] || 0), 0);
  const reel = b.id !== "sans-batiment";
  return (
    <Link href={hrefBatiment(b)} className="carte-immeuble" style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", minWidth: 0 }}>
      <div style={{ position: "relative" }}>
        <ImageImmeuble
          immeuble={b} infos={infos} moment={visuel?.moment || "jour"} saison={visuel?.saison || "ete"} vueRue={reel && vueRue} hauteur={140}
          urlApi={reel ? `/api/copropriete/batiments/${b.id}/photo` : undefined}
        />
        <span style={{ position: "absolute", left: 10, top: 10, fontSize: 11.5, fontWeight: 800, padding: "4px 9px", borderRadius: 999, background: "rgba(255,255,255,0.92)", color: "#14305c", boxShadow: "0 1px 4px rgba(0,0,0,0.18)" }}>🏢 {unites.length} unité{s(unites.length)}</span>
      </div>
      <div style={{ padding: "11px 13px 13px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.nom}</div>
          {b.adresse && <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.adresse}</div>}
        </div>
        {unites.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }} aria-label="État des unités">
            {unites.map((u) => <CarreEtat key={u.id} etat={infos[u.id]?.etat || "SANS"} titre={infos[u.id]?.texte} taille={12} />)}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 12.5, marginTop: "auto", flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-muted)" }}>{aJour} / {unites.length} à jour{demandes ? ` · 🛠️ ${demandes}` : ""}</span>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{argent(cotisations)}<span style={{ fontWeight: 500, fontSize: 11.5, color: "var(--text-muted)" }}> ce mois</span></span>
        </div>
      </div>
    </Link>
  );
}
