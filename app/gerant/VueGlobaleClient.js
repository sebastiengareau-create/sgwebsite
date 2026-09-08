"use client";

import { useState } from "react";
import Link from "next/link";

function fmt(montant) {
  return `${montant.toFixed(2)} $`;
}

const COULEUR_NIVEAU = { danger: "var(--danger)", avertissement: "#C9A227", info: "var(--success)" };
const FOND_NIVEAU = { danger: "rgba(193,91,74,0.12)", avertissement: "rgba(201,162,39,0.12)", info: "rgba(111,169,107,0.12)" };

export default function VueGlobaleClient({ nomUtilisateur, annee, mois, nomMois, kpis, graphique, sante, alertes, rentabilite }) {
  const [vueGraphique, setVueGraphique] = useState("revenus"); // "revenus" | "depenses" | "benefice"
  const [periodeRentabilite, setPeriodeRentabilite] = useState("mois"); // "mois" | "annee"

  const moisPrecUrl = mois === 1 ? { annee: annee - 1, mois: 12 } : { annee, mois: mois - 1 };
  const moisSuivUrl = mois === 12 ? { annee: annee + 1, mois: 1 } : { annee, mois: mois + 1 };

  const valeursGraphique = graphique.map((g) => g[vueGraphique === "revenus" ? "revenus" : vueGraphique === "depenses" ? "depenses" : "benefice"]);
  const maxValeur = Math.max(1, ...valeursGraphique.map((v) => Math.abs(v)));
  const couleurBarre = vueGraphique === "depenses" ? "var(--danger)" : vueGraphique === "benefice" ? "#4F82C0" : "var(--success)";

  return (
    <div className="conteneur-page" style={{ maxWidth: 1000 }}>
      {/* Bandeau d'accueil */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Bonjour {nomUtilisateur.split(" ")[0]} 👋</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "2px 0 0" }}>Voici l'état de votre entreprise aujourd'hui.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 8px" }}>
          <Link href={`/gerant?annee=${moisPrecUrl.annee}&mois=${moisPrecUrl.mois}`} style={{ color: "var(--text-muted)", textDecoration: "none", padding: "2px 6px", fontSize: 13 }}>◀</Link>
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 130, textAlign: "center" }}>📅 {nomMois} {annee}</span>
          <Link href={`/gerant?annee=${moisSuivUrl.annee}&mois=${moisSuivUrl.mois}`} style={{ color: "var(--text-muted)", textDecoration: "none", padding: "2px 6px", fontSize: 13 }}>▶</Link>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        <CarteKpi icone="💰" label="Chiffre d'affaires" valeur={fmt(kpis.revenus)} variation={kpis.revenusVariation} />
        <CarteKpi icone="💳" label="À recevoir" valeur={fmt(kpis.clientsARecevoir)} sousLabel={`${kpis.facturesImpayeesCount} facture${kpis.facturesImpayeesCount !== 1 ? "s" : ""}`} href="/secretaire/factures" />
        <CarteKpi icone="🧾" label="À payer" valeur={fmt(kpis.fournisseursAPayer)} sousLabel={`${kpis.fournisseursImpayesCount} fournisseur${kpis.fournisseursImpayesCount !== 1 ? "s" : ""}`} href="/gerant/comptabilite/comptes-a-payer" />
        <CarteKpi icone="🏦" label="Liquidités" valeur={fmt(kpis.soldeBancaire)} variation={kpis.soldeBancaireVariation} />
        <CarteKpi icone="📈" label="Bénéfice net" valeur={fmt(kpis.beneficeNet)} variation={kpis.beneficeNetVariation} />
      </div>

      {/* Graphique + santé financière */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12, marginBottom: 20, alignItems: "start" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Revenus vs dépenses — 12 derniers mois</span>
            <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 3 }}>
              {[{ cle: "revenus", label: "Revenus" }, { cle: "depenses", label: "Dépenses" }, { cle: "benefice", label: "Bénéfice" }].map((v) => (
                <button
                  key={v.cle}
                  onClick={() => setVueGraphique(v.cle)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    background: vueGraphique === v.cle ? "var(--accent)" : "none",
                    color: vueGraphique === v.cle ? "#17150f" : "var(--text-muted)",
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160 }}>
            {graphique.map((g, i) => {
              const valeur = valeursGraphique[i];
              const hauteur = Math.max(2, (Math.abs(valeur) / maxValeur) * 100);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 4 }}>
                  <div title={fmt(valeur)} style={{ width: "100%", maxWidth: 22, height: `${hauteur}%`, background: valeur < 0 ? "var(--danger)" : couleurBarre, borderRadius: "4px 4px 0 0", opacity: i === graphique.length - 1 ? 1 : 0.75 }} />
                  <span style={{ fontSize: 9.5, color: "var(--text-muted)" }}>{g.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Santé financière</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <JaugeScore score={sante.score} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: sante.score >= 60 ? "var(--success)" : sante.score >= 40 ? "#C9A227" : "var(--danger)" }}>{sante.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Estimation indicative</div>
            </div>
          </div>
          <LigneSante label="Marge bénéficiaire" valeur={`${sante.margePct.toFixed(1)} %`} />
          <LigneSante label="Liquidités" valeur={fmt(kpis.soldeBancaire)} />
          <LigneSante label="Comptes à recevoir" valeur={fmt(kpis.clientsARecevoir)} />
          <LigneSante label="Comptes à payer" valeur={fmt(kpis.fournisseursAPayer)} />
          <LigneSante label="Ratio d'endettement" valeur={`${sante.ratioEndettement.toFixed(0)} %`} />
        </div>
      </div>

      {/* Analyse de rentabilité */}
      <CarteRentabilite rentabilite={rentabilite} nomMois={nomMois} annee={annee} periode={periodeRentabilite} onChangerPeriode={setPeriodeRentabilite} />

      {/* À surveiller */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⚠️ À surveiller aujourd'hui</div>
        {alertes.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Rien à signaler — tout est sous contrôle. 🎉</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alertes.map((a, i) => (
              <Link key={i} href={a.href} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ background: FOND_NIVEAU[a.niveau], border: `1px solid ${COULEUR_NIVEAU[a.niveau]}`, borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13 }}>{a.icone} {a.texte}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {a.montant !== undefined && <span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(a.montant)}</span>}
                    <span style={{ color: "var(--text-muted)" }}>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Actions rapides */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🚀 Actions rapides</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <BoutonAction icone="🔧" label="Nouveau bon de travail" href="/secretaire/nouveau" />
          <BoutonAction icone="🧑‍🤝‍🧑" label="Nouveau client" href="/secretaire/clients" />
          <BoutonAction icone="🛒" label="Dépense" href="/gerant/comptabilite/comptes-a-payer" />
          <BoutonAction icone="👥" label="Employé / Paie" href="/gerant/paie" />
          <BoutonAction icone="📊" label="Rapports" href="/gerant/rapports" />
        </div>
      </div>
    </div>
  );
}

function CarteKpi({ icone, label, valeur, sousLabel, variation, href }) {
  const contenu = (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, height: "100%", boxSizing: "border-box" }}>
      <div style={{ fontSize: 18, marginBottom: 6 }}>{icone}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{valeur}</div>
      {variation !== undefined && variation !== null && (
        <div style={{ fontSize: 11, fontWeight: 700, color: variation >= 0 ? "var(--success)" : "var(--danger)", marginTop: 2 }}>
          {variation >= 0 ? "↑" : "↓"} {Math.abs(variation).toFixed(1)} % <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>vs mois préc.</span>
        </div>
      )}
      {sousLabel && <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginTop: 2 }}>{sousLabel}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>{contenu}</Link> : contenu;
}

function JaugeScore({ score }) {
  const couleur = score >= 60 ? "var(--success)" : score >= 40 ? "#C9A227" : "var(--danger)";
  return (
    <div style={{ width: 68, height: 68, borderRadius: "50%", background: `conic-gradient(${couleur} ${score * 3.6}deg, var(--border) 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{score}</span>
        <span style={{ fontSize: 8, color: "var(--text-muted)" }}>/100</span>
      </div>
    </div>
  );
}

function LigneSante({ label, valeur }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{valeur}</span>
    </div>
  );
}

function BoutonAction({ icone, label, href }) {
  return (
    <Link href={href} className="bouton-3d-sombre" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", borderRadius: 12, textDecoration: "none", textAlign: "center" }}>
      <span style={{ fontSize: 20 }}>{icone}</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)" }}>{label}</span>
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
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>📊 Analyse de rentabilité</span>
        <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 3 }}>
          <button
            onClick={() => onChangerPeriode("mois")}
            style={{ fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: periode === "mois" ? "var(--accent)" : "none", color: periode === "mois" ? "#17150f" : "var(--text-muted)" }}
          >
            {nomMois}
          </button>
          <button
            onClick={() => onChangerPeriode("annee")}
            style={{ fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: periode === "annee" ? "var(--accent)" : "none", color: periode === "annee" ? "#17150f" : "var(--text-muted)" }}
          >
            Année {annee}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
        <SectionPostes titre="Revenus" postes={revenus} total={totalRevenus} couleur="var(--success)" />
        <SectionPostes titre="Coûts" postes={depenses} total={totalDepenses} couleur="var(--danger)" sousTotal={`Fixes ${fmt(totalChargesFixes)} · Variables ${fmt(totalChargesVariables)}`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <Metrique label="Total revenus" valeur={fmt(totalRevenus)} />
        <Metrique label="Total coûts" valeur={fmt(totalDepenses)} />
        <Metrique label="Bénéfice" valeur={fmt(benefice)} couleur={benefice >= 0 ? "var(--success)" : "var(--danger)"} />
        <Metrique label="Marge" valeur={`${margePct.toFixed(1)} %`} couleur={margePct >= 0 ? "var(--success)" : "var(--danger)"} />
        {seuilCalculable ? (
          <>
            <Metrique label="Seuil de rentabilité" valeur={fmt(seuilRentabilite)} sousLabel="Revenu min. pour couvrir charges fixes et variables" />
            <Metrique label={excedent >= 0 ? "Excédent" : "Déficit"} valeur={fmt(Math.abs(excedent))} couleur={excedent >= 0 ? "var(--success)" : "var(--danger)"} sousLabel="Par rapport au seuil de rentabilité" />
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

function SectionPostes({ titre, postes, total, couleur, sousTotal }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }}>{titre}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {postes.map((p) => (
          <div key={p.numero} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
            <span style={{ color: "var(--text-muted)" }}>
              {p.nom}
              {p.typeCharge && (
                <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 5, color: p.typeCharge === "VARIABLE" ? "var(--accent)" : "var(--text-muted)" }}>
                  ({p.typeCharge === "VARIABLE" ? "Var." : "Fixe"})
                </span>
              )}
            </span>
            <span style={{ fontWeight: 600 }}>{fmt(p.montant)}</span>
          </div>
        ))}
        {postes.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", margin: 0 }}>Aucune donnée</p>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)", color: couleur }}>
        <span>Total</span>
        <span>{fmt(total)}</span>
      </div>
      {sousTotal && <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3, textAlign: "right" }}>{sousTotal}</div>}
    </div>
  );
}

function Metrique({ label, valeur, couleur, sousLabel }) {
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: couleur || "var(--text)" }}>{valeur}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
      {sousLabel && <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 1 }}>{sousLabel}</div>}
    </div>
  );
}
