"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dateAujourdhuiQuebec } from "@/lib/temps";

const LABEL_FREQUENCE = { HEBDOMADAIRE: "Chaque semaine", BIHEBDOMADAIRE: "Aux 2 semaines", BIMENSUEL: "2 fois par mois", MENSUEL: "Chaque mois" };

export default function PaieClient({ employes, paiesRecentes }) {
  const router = useRouter();
  const [employeId, setEmployeId] = useState("");
  const [periodeDebut, setPeriodeDebut] = useState("");
  const [periodeFin, setPeriodeFin] = useState(dateAujourdhuiQuebec());
  const [heuresManuelles, setHeuresManuelles] = useState("");
  const [typePaie, setTypePaie] = useState("REGULIERE");
  const [montantVacances, setMontantVacances] = useState("");
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [enAttenteCorrection, setEnAttenteCorrection] = useState(false);

  async function calculer(e) {
    e.preventDefault();
    setErreur("");
    setResultat(null);
    if (!employeId || !periodeDebut || !periodeFin) {
      setErreur("Choisis un employé et une période complète.");
      return;
    }
    setEnCours(true);
    const res = await fetch("/api/paie/calculer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeId, periodeDebut: `${periodeDebut}T00:00:00`, periodeFin: `${periodeFin}T23:59:59`,
        heuresManuelles: heuresManuelles || undefined,
        typePaie, montantVacances: typePaie === "VACANCES" ? montantVacances || undefined : undefined,
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur de calcul.");
      return;
    }
    const data = await res.json();
    setResultat(data);
    if (heuresManuelles === "" && data.heuresHorodateur !== null) {
      setHeuresManuelles(String(data.heuresHorodateur));
    }
    if (typePaie === "VACANCES" && montantVacances === "") {
      setMontantVacances(String(data.soldeVacances));
    }
  }

  async function confirmerPaie() {
    if (!window.confirm(`Enregistrer cette paie pour ${resultat.employe.nom} — salaire net de ${resultat.salaireNet.toFixed(2)} $ ?`)) return;
    setEnCours(true);
    const res = await fetch("/api/paie/confirmer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeId, periodeDebut: `${periodeDebut}T00:00:00`, periodeFin: `${periodeFin}T23:59:59`,
        heuresTravaillees: resultat.heuresTravaillees, salaireBrutPeriode: resultat.salaireBrutPeriode,
        rrqEmploye: resultat.rrqEmploye, rqapEmploye: resultat.rqapEmploye, aeEmploye: resultat.aeEmploye,
        impotFederal: resultat.impotFederal, impotQuebec: resultat.impotQuebec,
        totalDeductions: resultat.totalDeductions, salaireNet: resultat.salaireNet,
        rrqEmployeur: resultat.rrqEmployeur, rqapEmployeur: resultat.rqapEmployeur, aeEmployeur: resultat.aeEmployeur,
        vacancesAccumulees: resultat.vacancesAccumulees, typePaie,
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de l'enregistrement.");
      return;
    }
    const data = await res.json();
    setConfirmation(data.avertissementComptable ? `⚠️ Paie enregistrée, mais : ${data.avertissementComptable}` : "Paie enregistrée ✓");
    setResultat(null);
    setEnAttenteCorrection(false);
    setTypePaie("REGULIERE");
    setMontantVacances("");
    router.refresh();
    setTimeout(() => setConfirmation(""), data.avertissementComptable ? 10000 : 3000);
  }

  async function corrigerPaie(p) {
    if (!window.confirm(`Annuler cette paie pour la refaire correctement ? L'originale reste dans l'historique (marquée "corrigée"), et son écriture comptable est renversée proprement. Tu pourras ensuite ajuster et reconfirmer.`)) return;
    setEnCours(true);
    const res = await fetch(`/api/paie/${p.id}/corriger`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setEnCours(false);
      window.alert(data.erreur || "Erreur lors de la correction.");
      return;
    }
    // Pré-remplit ET recalcule tout de suite, pour voir immédiatement les
    // nouveaux chiffres plutôt que de deviner qu'il faut recliquer Calculer
    const nvEmployeId = data.employeId;
    const nvDebut = new Date(data.periodeDebut).toISOString().slice(0, 10);
    const nvFin = new Date(data.periodeFin).toISOString().slice(0, 10);
    setEmployeId(nvEmployeId);
    setPeriodeDebut(nvDebut);
    setPeriodeFin(nvFin);
    setHeuresManuelles("");
    setResultat(null);
    setEnAttenteCorrection(true);

    const resCalcul = await fetch("/api/paie/calculer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeId: nvEmployeId, periodeDebut: `${nvDebut}T00:00:00`, periodeFin: `${nvFin}T23:59:59` }),
    });
    setEnCours(false);
    if (resCalcul.ok) {
      const dataCalcul = await resCalcul.json();
      setResultat(dataCalcul);
      if (dataCalcul.heuresHorodateur !== null) setHeuresManuelles(String(dataCalcul.heuresHorodateur));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    router.refresh();
  }

  async function supprimerPaie(id) {
    if (!window.confirm("Supprimer cette paie de l'historique ?")) return;
    const res = await fetch(`/api/paie/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>🧾 Paie</h1>
      <Link href="/gerant/paie/journal" style={{ display: "inline-block", fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", marginBottom: 6 }}>
        📖 Voir le journal de paie / sommaire par employé →
      </Link>
      <br />
      <Link href="/gerant/paie/cumulatifs" target="_blank" style={{ display: "inline-block", fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", marginBottom: 12 }}>
        🖨️ Rapport cumulatif imprimable par période →
      </Link>

      <div style={{ background: "#3a2620", border: "1px solid var(--danger)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
        <p style={{ fontSize: 11.5, color: "#f2c4b8", lineHeight: 1.5, margin: 0 }}>
          ⚠️ <strong>Estimation seulement.</strong> Calculée avec la méthode d'annualisation (taux officiels 2026), mais
          ne remplace pas la formule complète de Revenu Québec. Valide toujours avec{" "}
          <a href="https://www.revenuquebec.ca/fr/services-en-ligne/outils/webras/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
            WebRAS
          </a>{" "}
          avant de verser une vraie paie.
        </p>
      </div>

      {enAttenteCorrection && (
        <div style={{ background: "rgba(232,163,61,0.12)", border: "1px solid var(--accent)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 12.5, color: "var(--text)", margin: 0, lineHeight: 1.5 }}>
            ✎ <strong>Paie annulée pour correction.</strong> Les nouveaux chiffres sont déjà calculés ci-dessous —
            ajuste les heures ou toute autre valeur au besoin, puis clique "Confirmer et enregistrer" pour la remplacer.
          </p>
        </div>
      )}

      <form onSubmit={calculer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 20 }}>
        <label style={labelStyle}>Employé</label>
        <select value={employeId} onChange={(e) => { setEmployeId(e.target.value); setHeuresManuelles(""); setMontantVacances(""); setResultat(null); }} style={champStyle}>
          <option value="">Choisir…</option>
          {employes.map((e) => <option key={e.id} value={e.id}>{e.nom} ({e.typeRemuneration === "SALAIRE" ? "salarié" : "à l'heure"})</option>)}
        </select>

        <label style={labelStyle}>Type de paie</label>
        <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 3, marginBottom: 6 }}>
          <button type="button" onClick={() => { setTypePaie("REGULIERE"); setResultat(null); }} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "7px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: typePaie === "REGULIERE" ? "var(--accent)" : "none", color: typePaie === "REGULIERE" ? "#17150f" : "var(--text-muted)" }}>
            Régulière
          </button>
          <button type="button" onClick={() => { setTypePaie("VACANCES"); setResultat(null); }} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "7px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: typePaie === "VACANCES" ? "var(--accent)" : "none", color: typePaie === "VACANCES" ? "#17150f" : "var(--text-muted)" }}>
            🏖️ Vacances
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Début</label>
            <input type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} style={champStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Fin</label>
            <input type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} style={champStyle} />
          </div>
        </div>

        {typePaie === "VACANCES" && (
          <>
            <label style={labelStyle}>Montant de vacances à verser ($) — brut, avant déductions</label>
            <input
              type="number" min={0} step="0.01" value={montantVacances}
              onChange={(e) => setMontantVacances(e.target.value)}
              placeholder={resultat?.soldeVacances !== undefined ? `Solde disponible : ${resultat.soldeVacances.toFixed(2)} $` : "Calcule d'abord pour voir le solde"}
              style={champStyle}
            />
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: -4, marginBottom: 8 }}>
              Toujours soumis aux mêmes déductions (RRQ, RQAP, AE, impôts) — c'est un revenu imposable comme le reste.
            </p>
          </>
        )}

        {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 8 }}>{erreur}</p>}
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 11, borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
          {enCours ? "Calcul…" : "Calculer"}
        </button>
      </form>

      {confirmation && <p style={{ color: "var(--success)", fontSize: 13, marginBottom: 16, fontWeight: 700 }}>{confirmation}</p>}

      {resultat && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{resultat.employe.nom} {resultat.typePaie === "VACANCES" && <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 400 }}>🏖️ paie de vacances</span>}</div>
          {resultat.heuresHorodateur !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>Heures payables (détecté : {resultat.heuresHorodateur.toFixed(2)} h)</label>
              <input
                type="number" min={0} step="0.01" value={heuresManuelles}
                onChange={(e) => setHeuresManuelles(e.target.value)}
                style={{ width: 80, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, textAlign: "right" }}
              />
              <button type="button" onClick={calculer} disabled={enCours} style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "1px solid var(--border)", padding: "6px 8px", borderRadius: 6, cursor: "pointer" }}>
                ↻
              </button>
            </div>
          )}
          <LigneMontant label="Salaire brut" valeur={resultat.salaireBrutPeriode} gras />
          <div style={{ borderTop: "1px dashed var(--border)", margin: "8px 0", paddingTop: 6 }}>
            <LigneMontant label="RRQ" valeur={-resultat.rrqEmploye} petit />
            <LigneMontant label="RQAP" valeur={-resultat.rqapEmploye} petit />
            <LigneMontant label="Assurance-emploi" valeur={-resultat.aeEmploye} petit />
            <LigneMontant label="Impôt fédéral" valeur={-resultat.impotFederal} petit />
            <LigneMontant label="Impôt Québec" valeur={-resultat.impotQuebec} petit />
          </div>
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700 }}>Salaire net</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>{resultat.salaireNet.toFixed(2)} $</span>
          </div>
          {resultat.vacancesAccumulees > 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              + {resultat.vacancesAccumulees.toFixed(2)} $ accumulés en vacances ({resultat.employe.tauxVacances}%, mis de côté, pas versé maintenant)
            </div>
          )}
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 8 }}>
            Coût employeur additionnel : RRQ {resultat.rrqEmployeur.toFixed(2)} $ · RQAP {resultat.rqapEmployeur.toFixed(2)} $ · AE {resultat.aeEmployeur.toFixed(2)} $
          </div>
          <button onClick={confirmerPaie} disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 11, borderRadius: 8, fontWeight: 700, fontSize: 13, marginTop: 12 }}>
            {enCours ? "Enregistrement…" : "✓ Confirmer et enregistrer cette paie"}
          </button>
        </div>
      )}

      <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Historique récent</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {paiesRecentes.map((p) => (
          <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, opacity: p.statut === "CORRIGEE" ? 0.5 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {p.employe.nom}
                  {p.statut === "CORRIGEE" && <span style={{ fontSize: 10.5, color: "var(--danger)", fontWeight: 400 }}> — corrigée</span>}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                  {new Date(p.periodeDebut).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} → {new Date(p.periodeFin).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13, textDecoration: p.statut === "CORRIGEE" ? "line-through" : "none" }}>{p.salaireNet.toFixed(2)} $</span>
                <button onClick={() => supprimerPaie(p.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12 }}>✕</button>
              </div>
            </div>
            {p.statut === "VERSEE" && (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <a
                  href={`/gerant/paie/${p.id}/talon`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "var(--text)", background: "none", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: 6, cursor: "pointer", textDecoration: "none" }}
                >
                  🖨️ Talon
                </a>
                <button onClick={() => corrigerPaie(p)} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}>
                  ✎ Corriger cette paie
                </button>
              </div>
            )}
          </div>
        ))}
        {paiesRecentes.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucune paie enregistrée encore.</p>}
      </div>
    </div>
  );
}

function LigneMontant({ label, valeur, gras, petit, texte }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: petit ? 12 : 13, color: petit ? "var(--text-muted)" : "var(--text)", fontWeight: gras ? 700 : 400, marginBottom: 2 }}>
      <span>{label}</span>
      <span>{texte ? valeur : `${valeur.toFixed(2)} $`}</span>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginTop: 8, marginBottom: 3 };
const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 6, boxSizing: "border-box",
};
