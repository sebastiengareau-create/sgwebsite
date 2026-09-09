"use client";

import { useState } from "react";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";

const STATUT_INFO = {
  BROUILLON: { icone: "🟡", label: "Brouillon", couleur: "#C9A227" },
  COMPTABILISEE: { icone: "⚫", label: "Comptabilisée", couleur: "var(--text-muted)" },
};

const NOMS_ROLE = { GERANT: "Gérant", SECRETAIRE: "Secrétaire", MECANICIEN: "Mécanicien" };

const COULEUR_NIVEAU = { danger: "var(--danger)", avertissement: "#C9A227", info: "var(--success)" };
const FOND_NIVEAU = { danger: "rgba(193,91,74,0.12)", avertissement: "rgba(201,162,39,0.12)", info: "rgba(111,169,107,0.12)" };

const JOURS_LABEL = ["D", "L", "M", "M", "J", "V", "S"];
const MOIS_LABEL = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function fmt(montant) {
  return `${montant.toFixed(2)} $`;
}

function fmtDate(dateVal) {
  return new Date(dateVal).toLocaleDateString("fr-CA", { timeZone: "America/Toronto", day: "numeric", month: "long" });
}

export default function PaieClient({ lots, employesActifs, kpis, dernierLot, alertes, prochainePaie, calendrierDates }) {
  const brouillons = lots.filter((l) => l.statut === "BROUILLON");
  const historique = lots.filter((l) => l.statut === "COMPTABILISEE");

  return (
    <div className="conteneur-page" style={{ maxWidth: 1000 }}>
      <BandeauSection icone="🧾" titre="Paie" sousTitre="Gérez facilement vos employés, vos heures et vos paiements.">
        {prochainePaie && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, padding: "6px 12px",
            background: "rgba(0,0,0,0.28)", borderRadius: 999, fontSize: 12, fontWeight: 600, color: "#fff",
          }}>
            📅 Prochaine paie : {fmtDate(`${prochainePaie.dateStr}T12:00:00`)}
          </div>
        )}
      </BandeauSection>

      <div style={{ background: "#3a2620", border: "1px solid var(--danger)", borderRadius: 10, padding: 12, marginBottom: 20 }}>
        <p style={{ fontSize: 11.5, color: "#f2c4b8", lineHeight: 1.5, margin: 0 }}>
          ⚠️ <strong>Estimation seulement.</strong> Calculée avec la méthode d'annualisation (taux officiels 2026), mais
          ne remplace pas la formule complète de Revenu Québec. Valide toujours avec{" "}
          <a href="https://www.revenuquebec.ca/fr/services-en-ligne/outils/webras/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
            WebRAS
          </a>{" "}
          avant de verser une vraie paie.
        </p>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        <CarteKpi icone="👥" label="Employés" valeur={String(employesActifs)} sousLabel="Actifs" href="/gerant/employes" />
        <CarteKpi icone="💵" label="Salaire brut" valeur={fmt(kpis.brut)} variation={kpis.brutVariation} />
        <CarteKpi icone="📉" label="Déductions totales" valeur={fmt(kpis.deductions)} variation={kpis.deductionsVariation} inverserCouleur />
        <CarteKpi icone="💰" label="Salaire net" valeur={fmt(kpis.net)} variation={kpis.netVariation} />
      </div>

      {/* Dernier traitement de paie */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>📋 Dernier traitement de paie</span>
          {dernierLot && (
            <Link href={`/gerant/paie/lots/${dernierLot.id}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
              Voir le détail →
            </Link>
          )}
        </div>

        {!dernierLot ? (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun lot de paie encore.</p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 11.5, color: "var(--text-muted)" }}>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--text)" }}>#{dernierLot.numero}</span>
              <span>{new Date(dernierLot.periodeDebut).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} → {new Date(dernierLot.periodeFin).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}</span>
              <span style={{ fontWeight: 700, color: STATUT_INFO[dernierLot.statut].couleur }}>{STATUT_INFO[dernierLot.statut].icone} {STATUT_INFO[dernierLot.statut].label}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {dernierLot.paies.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderRadius: 8, background: "var(--bg)" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(180deg, var(--accent-clair), var(--accent))",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#17150f",
                  }}>
                    {p.nom.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{NOMS_ROLE[p.role] || p.role} · {p.heuresTravaillees.toFixed(2)} h</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{fmt(p.salaireNet)}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>net</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* À surveiller */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⚠️ À surveiller</div>
        {alertes.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Rien à signaler — tout est sous contrôle. 🎉</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alertes.map((a, i) => (
              <Link key={i} href={a.href} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ background: FOND_NIVEAU[a.niveau], border: `1px solid ${COULEUR_NIVEAU[a.niveau]}`, borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13 }}>{a.icone} {a.texte}</span>
                  <span style={{ color: "var(--text-muted)" }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Actions rapides */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🚀 Actions rapides</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <BoutonAction icone="🧮" label="Calculer la paie" href="/gerant/paie/nouveau" />
          <BoutonAction icone="👤" label="Ajouter un employé" href="/gerant/employes?nouveau=1" />
          <BoutonAction icone="👥" label="Gérer les employés" href="/gerant/employes" />
          <BoutonAction icone="📖" label="Journal / sommaire" href="/gerant/paie/journal" />
          <BoutonAction icone="🖨️" label="Cumulatifs" href="/gerant/paie/cumulatifs" />
        </div>
      </div>

      {/* Calendrier de paie */}
      <div style={{ marginBottom: 20 }}>
        <MiniCalendrier calendrierDates={calendrierDates} />
      </div>

      {brouillons.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Brouillons à traiter</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {brouillons.map((l) => <CarteLot key={l.id} lot={l} />)}
          </div>
        </>
      )}

      <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Historique</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {historique.map((l) => <CarteLot key={l.id} lot={l} />)}
        {historique.length === 0 && brouillons.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun lot de paie encore.</p>
        )}
      </div>

      <Link href="/gerant/paie/nouveau" className="bouton-3d" style={{ display: "block", textAlign: "center", padding: 13, borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none", marginTop: 20 }}>
        + Nouveau lot de paie
      </Link>
    </div>
  );
}

function CarteKpi({ icone, label, valeur, sousLabel, variation, inverserCouleur, href }) {
  const positif = inverserCouleur ? variation <= 0 : variation >= 0;
  const contenu = (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, height: "100%", boxSizing: "border-box" }}>
      <div style={{ fontSize: 18, marginBottom: 6 }}>{icone}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{valeur}</div>
      {variation !== undefined && variation !== null && (
        <div style={{ fontSize: 11, fontWeight: 700, color: positif ? "var(--success)" : "var(--danger)", marginTop: 2 }}>
          {variation >= 0 ? "↑" : "↓"} {Math.abs(variation).toFixed(1)} % <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>vs lot préc.</span>
        </div>
      )}
      {sousLabel && <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginTop: 2 }}>{sousLabel}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>{contenu}</Link> : contenu;
}

function BoutonAction({ icone, label, href }) {
  return (
    <Link href={href} className="bouton-3d-sombre" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", borderRadius: 12, textDecoration: "none", textAlign: "center" }}>
      <span style={{ fontSize: 20 }}>{icone}</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)" }}>{label}</span>
    </Link>
  );
}

function CarteLot({ lot }) {
  const info = STATUT_INFO[lot.statut];
  return (
    <Link href={`/gerant/paie/lots/${lot.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ background: "var(--surface)", border: `1px solid ${lot.statut === "BROUILLON" ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>#{lot.numero}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: info.couleur }}>{info.icone} {info.label}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
          {new Date(lot.periodeDebut).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} → {new Date(lot.periodeFin).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
          {lot.typePaie === "VACANCES" && " · 🏖️ Vacances"}
        </div>
        <div style={{ fontSize: 12.5, marginTop: 6 }}>
          {lot.nbEmployes} employé{lot.nbEmployes !== 1 ? "s" : ""} · {lot.totalBrut.toFixed(2)} $ brut · {lot.totalDeductions.toFixed(2)} $ retenues · <strong>{lot.totalNet.toFixed(2)} $ net</strong>
        </div>
      </div>
    </Link>
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
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>📅 Calendrier de paie</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={auMoisPrecedent} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: "2px 6px" }}>◀</button>
          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 110, textAlign: "center" }}>{MOIS_LABEL[curseur.mois]} {curseur.annee}</span>
          <button onClick={auMoisSuivant} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: "2px 6px" }}>▶</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {JOURS_LABEL.map((j, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>{j}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
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
                borderRadius: 8, fontSize: 11, position: "relative",
                border: estAujourdhui ? "1px solid var(--accent)" : "1px solid transparent",
                color: estAujourdhui ? "var(--accent)" : "var(--text)",
                fontWeight: estAujourdhui ? 700 : 400,
              }}
            >
              {jour}
              {evenement && (
                <span style={{
                  position: "absolute", bottom: 3, width: 5, height: 5, borderRadius: "50%",
                  background: evenement.statut === "BROUILLON" ? "#C9A227" : "var(--success)",
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
