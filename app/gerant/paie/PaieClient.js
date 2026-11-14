"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BandeauSection from "../../components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, GrilleChiffres, BoutonPlein, BoutonContour, GroupeLiens, TitreGroupe, Panneau, Pastille } from "../../components/StyleSection";
import { argent, nombre } from "@/lib/format";
import CotisationsEmployeur from "./CotisationsEmployeur";

const STATUT_INFO = {
  BROUILLON: { label: "Brouillon", couleur: "var(--avertissement)", fond: "var(--avertissement-fond)" },
  COMPTABILISEE: { label: "Comptabilisée", couleur: "var(--success)", fond: "var(--success-fond)" },
};

const TEINTE_NIVEAU = { danger: TEINTES.rouge, avertissement: { couleur: "var(--avertissement)", fond: "var(--avertissement-fond)" }, info: TEINTES.vert };

const JOURS_LABEL = ["D", "L", "M", "M", "J", "V", "S"];
const MOIS_LABEL = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// Chaque groupe a sa teinte, comme dans Comptabilité.
const GROUPES = [
  {
    titre: "Au quotidien", teinte: TEINTES.ambre,
    liens: [
      { href: "/gerant/paie/nouveau", icone: "calculatrice", label: "Calculer la paie", detail: "Préparer un nouveau lot" },
      { href: "/gerant/paie/journal", icone: "livre", label: "Journal / sommaire", detail: "Détail des paies versées" },
    ],
  },
  {
    titre: "Employés", teinte: TEINTES.bleu,
    liens: [
      { href: "/gerant/employes?nouveau=1", icone: "utilisateurPlus", label: "Ajouter un employé", detail: "Nouvelle fiche, taux et retenues" },
      { href: "/gerant/employes", icone: "utilisateurs", label: "Gérer les employés", detail: "Fiches, salaires et assignations" },
    ],
  },
  {
    titre: "Fin d’année", teinte: TEINTES.vert,
    liens: [
      { href: "/gerant/paie/cumulatifs", icone: "imprimante", label: "Cumulatifs", detail: "Totaux de l’année par employé" },
      { href: "/gerant/paie/feuillets", icone: "document", label: "Sommaires T4 / RL-1", detail: "Feuillets à produire" },
    ],
  },
];

function fmtDate(dateVal) {
  return new Date(dateVal).toLocaleDateString("fr-CA", { timeZone: "America/Toronto", day: "numeric", month: "long" });
}

function fmtPeriode(debut, fin) {
  const o = { timeZone: "America/Toronto", day: "numeric", month: "short" };
  return `${new Date(debut).toLocaleDateString("fr-CA", o)} → ${new Date(fin).toLocaleDateString("fr-CA", { ...o, year: "numeric" })}`;
}

function NoteVariation({ variation, inverserCouleur, prefixe }) {
  if (variation === undefined || variation === null) return prefixe || "Dernier lot";
  const positif = inverserCouleur ? variation <= 0 : variation >= 0;
  return (
    <>
      {prefixe ? `${prefixe} · ` : ""}
      <span style={{ fontWeight: 700, color: positif ? "var(--success)" : "var(--danger)" }}>
        {variation >= 0 ? "↑" : "↓"} {nombre(Math.abs(variation), 1)} %
      </span>{" "}
      vs lot préc.
    </>
  );
}

export default function PaieClient({ lots, employesActifs, kpis, dernierLot, alertes, prochainePaie, calendrierDates, tauxEmployeur }) {
  const brouillons = lots.filter((l) => l.statut === "BROUILLON");
  const historique = lots.filter((l) => l.statut === "COMPTABILISEE");
  const libelleLot = dernierLot ? `Lot #${dernierLot.numero}` : "Dernier lot";

  return (
    <div className="conteneur-page">
      <BandeauSection icone="🧾" titre="Paie" sousTitre="Gérez facilement vos employés, vos heures et vos paiements.">
        {prochainePaie && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, padding: "6px 12px",
            background: "rgba(0,0,0,0.28)", borderRadius: 999, fontSize: 12, fontWeight: 600, color: "#fff",
          }}>
            <Icone nom="calendrier" taille={14} /> Prochaine paie : {fmtDate(`${prochainePaie.dateStr}T12:00:00`)}
          </div>
        )}
      </BandeauSection>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <BoutonPlein href="/gerant/paie/nouveau">Nouveau lot de paie</BoutonPlein>
        <BoutonContour href="/gerant/paie/journal" icone="livre">Journal</BoutonContour>
      </div>

      <div style={{
        position: "relative", overflow: "hidden", display: "flex", gap: 12, alignItems: "flex-start",
        background: "var(--danger-fond)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px 12px 18px", marginBottom: 22,
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "var(--danger)" }} />
        <Icone nom="alerte" taille={20} couleur="var(--danger)" />
        <p style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.5, margin: 0 }}>
          <strong>Logiciel non certifié.</strong> Les retenues suivent les formules publiées par Revenu Québec
          (TP-1015.F) et l'ARC (T4127), mais certains cas ne sont pas couverts (commissions, REER retenu sur la paie,
          exemptions). En cas de doute, valide avec{" "}
          <a href="https://www.revenuquebec.ca/fr/services-en-ligne/outils/webras/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-ombre)", fontWeight: 700 }}>
            WebRAS
          </a>{" "}
          avant de verser la paie.
        </p>
      </div>

      <GrilleChiffres>
        <CarteChiffre
          titre="Salaire net" montant={argent(kpis.net)} couleur="var(--success)" teinte="var(--success)"
          note={<NoteVariation variation={kpis.netVariation} prefixe={libelleLot} />}
        />
        <CarteChiffre
          titre="Salaire brut" montant={argent(kpis.brut)} teinte="var(--accent)"
          note={<NoteVariation variation={kpis.brutVariation} prefixe={libelleLot} />}
        />
        <CarteChiffre
          titre="Déductions totales" montant={argent(kpis.deductions)} couleur="var(--danger)" teinte="var(--danger)"
          note={<NoteVariation variation={kpis.deductionsVariation} inverserCouleur prefixe={libelleLot} />}
        />
        <CarteChiffre
          titre="Employés" montant={String(employesActifs)} teinte="var(--bleu)" href="/gerant/employes"
          note="Actifs · voir la liste"
        />
      </GrilleChiffres>

      {alertes.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, fontSize: 13, color: "var(--text-muted)" }}>
          <Icone nom="crochet" taille={18} couleur="var(--success)" /> Rien à signaler — tout est sous contrôle.
        </div>
      ) : (
        <section style={{ marginBottom: 24 }}>
          <TitreGroupe couleur="var(--avertissement)">À surveiller</TitreGroupe>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alertes.map((a, i) => {
              const t = TEINTE_NIVEAU[a.niveau] || TEINTE_NIVEAU.avertissement;
              return (
                <Link key={i} href={a.href} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, textDecoration: "none", color: "var(--text)",
                  background: "var(--surface)", border: `1px solid ${t.couleur}`,
                }}>
                  <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: t.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icone nom={a.icone || "alerte"} taille={20} couleur={t.couleur} />
                  </span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{a.texte}</span>
                  <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <Panneau
        titre="Dernier traitement"
        action={dernierLot && (
          <Link href={`/gerant/paie/lots/${dernierLot.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)", textDecoration: "none" }}>
            Voir le détail <Icone nom="chevron" taille={16} />
          </Link>
        )}
      >
        {!dernierLot ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun lot de paie encore.</p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10, fontSize: 13, color: "var(--text-muted)" }}>
              <span style={{ fontWeight: 800, color: "var(--text)" }}>#{dernierLot.numero}</span>
              <span>{fmtPeriode(dernierLot.periodeDebut, dernierLot.periodeFin)}</span>
              <Pastille couleur={STATUT_INFO[dernierLot.statut].couleur} fond={STATUT_INFO[dernierLot.statut].fond}>{STATUT_INFO[dernierLot.statut].label}</Pastille>
            </div>
            <div style={{ display: "flex", padding: "0 4px 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", borderBottom: "2px solid var(--accent)" }}>
              <span style={{ flex: 1 }}>Employé</span>
              <span>Net</span>
            </div>
            {dernierLot.paies.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "rgba(232,163,61,0.16)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "var(--accent-ombre)",
                }}>
                  {p.nom.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {p.assignation || "—"} · {p.typeRemuneration === "SALAIRE" ? `${argent(p.salaireBrut)} brut` : `${nombre(p.heuresTravaillees)} h`}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(p.salaireNet)}</div>
              </div>
            ))}
          </>
        )}
      </Panneau>

      {GROUPES.map((g) => <GroupeLiens key={g.titre} {...g} />)}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>
        <div>
          {brouillons.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <TitreGroupe couleur="var(--avertissement)">Brouillons à traiter</TitreGroupe>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {brouillons.map((l) => <CarteLot key={l.id} lot={l} />)}
              </div>
            </section>
          )}
          <section style={{ marginBottom: 24 }}>
            <TitreGroupe couleur="var(--text-muted)">Historique</TitreGroupe>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {historique.map((l) => <CarteLot key={l.id} lot={l} />)}
              {historique.length === 0 && brouillons.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun lot de paie encore.</p>
              )}
            </div>
          </section>
        </div>
        <section style={{ marginBottom: 24 }}>
          <TitreGroupe couleur="var(--accent)">Calendrier de paie</TitreGroupe>
          <MiniCalendrier calendrierDates={calendrierDates} />
        </section>
        <section style={{ marginBottom: 24 }}>
          <CotisationsEmployeur tauxFss={tauxEmployeur.fss} tauxCnesst={tauxEmployeur.cnesst} tauxFssParDefaut={tauxEmployeur.fssParDefaut} />
        </section>
      </div>
    </div>
  );
}

function CarteLot({ lot }) {
  const router = useRouter();
  const info = STATUT_INFO[lot.statut];
  return (
    <div
      onClick={() => router.push(`/gerant/paie/lots/${lot.id}`)}
      style={{
        position: "relative", overflow: "hidden", cursor: "pointer", background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px 14px 20px",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: info.couleur }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>#{lot.numero}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Pastille couleur={info.couleur} fond={info.fond}>{info.label}</Pastille>
          {lot.statut === "COMPTABILISEE" && (
            <a
              href={`/gerant/paie/lots/${lot.id}/talons`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Imprimer tous les talons de ce lot (1 par page)"
              style={{ display: "inline-flex", padding: 4, color: "var(--text-muted)" }}
            >
              <Icone nom="imprimante" taille={18} />
            </a>
          )}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
        {fmtPeriode(lot.periodeDebut, lot.periodeFin)}
        {lot.typePaie === "VACANCES" && " · 🏖️ Vacances"}
        {" · "}{lot.nbEmployes} employé{lot.nbEmployes !== 1 ? "s" : ""}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
        <span>Brut <strong style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{argent(lot.totalBrut)}</strong></span>
        <span>Retenues <strong style={{ color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>{argent(lot.totalDeductions)}</strong></span>
        <span>Net <strong style={{ color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>{argent(lot.totalNet)}</strong></span>
      </div>
      {lot.statut === "BROUILLON" && lot.paies?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          {lot.paies.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 13 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.nom}{p.assignation ? <span style={{ color: "var(--text-muted)" }}> · {p.assignation}</span> : null}
              </span>
              <span style={{ fontWeight: 700, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{argent(p.salaireNet)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniCalendrier({ calendrierDates }) {
  const aujourdhui = new Date();
  const [curseur, setCurseur] = useState({ annee: aujourdhui.getFullYear(), mois: aujourdhui.getMonth() });

  const parDate = {};
  for (const d of calendrierDates) parDate[d.dateStr] = d;

  const premierJourSemaine = new Date(curseur.annee, curseur.mois, 1).getDay();
  const nbJours = new Date(curseur.annee, curseur.mois + 1, 0).getDate();
  const cases = [];
  for (let i = 0; i < premierJourSemaine; i++) cases.push(null);
  for (let j = 1; j <= nbJours; j++) cases.push(j);

  const auMoisPrecedent = () => setCurseur((c) => (c.mois === 0 ? { annee: c.annee - 1, mois: 11 } : { annee: c.annee, mois: c.mois - 1 }));
  const auMoisSuivant = () => setCurseur((c) => (c.mois === 11 ? { annee: c.annee + 1, mois: 0 } : { annee: c.annee, mois: c.mois + 1 }));

  const todayStr = aujourdhui.toISOString().slice(0, 10);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={auMoisPrecedent} aria-label="Mois précédent" style={{ display: "inline-flex", background: "var(--bg)", border: "none", borderRadius: 8, color: "var(--text-muted)", cursor: "pointer", padding: 6 }}><Icone nom="chevronGauche" taille={16} /></button>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{MOIS_LABEL[curseur.mois]} {curseur.annee}</span>
        <button onClick={auMoisSuivant} aria-label="Mois suivant" style={{ display: "inline-flex", background: "var(--bg)", border: "none", borderRadius: 8, color: "var(--text-muted)", cursor: "pointer", padding: 6 }}><Icone nom="chevron" taille={16} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
        {JOURS_LABEL.map((j, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{j}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cases.map((jour, i) => {
          if (jour === null) return <div key={i} />;
          const dateStr = `${curseur.annee}-${String(curseur.mois + 1).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
          const evenement = parDate[dateStr];
          const estAujourdhui = dateStr === todayStr;
          const contenuJour = (
            <div
              title={evenement ? `Paie #${evenement.numero}` : undefined}
              style={{
                aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                borderRadius: 8, fontSize: 13, position: "relative",
                border: estAujourdhui ? "1.5px solid var(--accent)" : "1px solid transparent",
                background: evenement ? (evenement.statut === "BROUILLON" ? "var(--avertissement-fond)" : "var(--success-fond)") : "transparent",
                color: estAujourdhui ? "var(--accent-ombre)" : "var(--text)",
                fontWeight: estAujourdhui || evenement ? 700 : 400,
              }}
            >
              {jour}
              {evenement && (
                <span style={{
                  position: "absolute", bottom: 3, width: 5, height: 5, borderRadius: "50%",
                  background: evenement.statut === "BROUILLON" ? "var(--avertissement)" : "var(--success)",
                }} />
              )}
            </div>
          );
          return evenement ? (
            <Link key={i} href={`/gerant/paie/lots/${evenement.lotId}`} style={{ textDecoration: "none" }}>{contenuJour}</Link>
          ) : (
            <div key={i}>{contenuJour}</div>
          );
        })}
      </div>
    </div>
  );
}
