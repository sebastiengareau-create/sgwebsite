"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LotDetailClient({ lot, checklist }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [avertissements, setAvertissements] = useState([]);
  const estBrouillon = lot.statut === "BROUILLON";

  const totalBrut = lot.paies.reduce((s, p) => s + p.salaireBrut, 0);
  const totalDeductions = lot.paies.reduce((s, p) => s + p.totalDeductions, 0);
  const totalNet = lot.paies.reduce((s, p) => s + p.salaireNet, 0);

  async function ajusterPaie(paieId, valeurs) {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/paie/lots/${lot.id}/paies/${paieId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valeurs),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de l'ajustement.");
      return;
    }
    router.refresh();
  }

  async function retirerEmploye(paieId) {
    if (!window.confirm("Retirer cet employé de ce lot ?")) return;
    setEnCours(true);
    const res = await fetch(`/api/paie/lots/${lot.id}/paies/${paieId}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur.");
      return;
    }
    router.refresh();
  }

  async function supprimerLot() {
    if (!window.confirm(`Supprimer complètement le lot #${lot.numero} ?`)) return;
    setEnCours(true);
    const res = await fetch(`/api/paie/lots/${lot.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur.");
      return;
    }
    router.push("/gerant/paie");
  }

  async function traiterLaPaie() {
    if (!window.confirm(`Traiter la paie pour ${lot.paies.length} employé(s) — total net ${totalNet.toFixed(2)} $ ? Cette action comptabilise chaque paie et ne peut plus être annulée d'un coup (seulement employé par employé, ensuite).`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/paie/lots/${lot.id}/comptabiliser`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setErreur(data.erreur || "Erreur lors du traitement.");
      return;
    }
    setAvertissements(data.avertissements || []);
    router.refresh();
  }

  async function corrigerPaieIndividuelle(paieId) {
    if (!window.confirm("Annuler cette paie pour la refaire ? Son écriture comptable est renversée. Tu pourras créer un nouveau lot (avec juste cet employé) pour la refaire correctement.")) return;
    setEnCours(true);
    const res = await fetch(`/api/paie/${paieId}/corriger`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      window.alert(data.erreur || "Erreur lors de la correction.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/paie" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 4px" }}>
        <h1 style={{ fontSize: 20, margin: 0, fontFamily: "monospace" }}>#{lot.numero}</h1>
        <span style={{ fontSize: 12, fontWeight: 700, color: estBrouillon ? "#C9A227" : "var(--text-muted)" }}>
          {estBrouillon ? "🟡 Brouillon" : "⚫ Comptabilisée"}
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
        {new Date(lot.periodeDebut).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} → {new Date(lot.periodeFin).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
        {lot.typePaie === "VACANCES" && " · 🏖️ Paie de vacances"}
        {lot.creePar && ` · créé par ${lot.creePar}`}
      </p>

      {estBrouillon && checklist && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: 10 }}>
            Checklist — {checklist.pourcentage}% complétée
          </div>
          {checklist.blocages.map((b) => (
            <div key={b.cle} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span>{b.ok ? "🟢" : "🔴"} {b.label}</span>
              {b.detail && <span style={{ color: "var(--danger)", fontSize: 11.5 }}>{b.detail}</span>}
            </div>
          ))}
          {checklist.informatifs.length > 0 && (
            <>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 10, marginBottom: 6 }}>Informatif</div>
              {checklist.informatifs.map((i) => (
                <div key={i.cle} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-muted)", marginBottom: 4 }}>
                  <span>🟡 {i.label}</span>
                  <span>{i.valeur}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{lot.paies.length} employé{lot.paies.length !== 1 ? "s" : ""}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          {totalBrut.toFixed(2)} $ brut · {totalDeductions.toFixed(2)} $ retenues · <strong style={{ color: "var(--text)" }}>{totalNet.toFixed(2)} $ net</strong>
        </div>
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}
      {avertissements.length > 0 && (
        <div style={{ background: "rgba(232,163,61,0.12)", border: "1px solid var(--accent)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>⚠️ Paie traitée, mais avec des avertissements comptables :</p>
          {avertissements.map((a, i) => <p key={i} style={{ fontSize: 11.5, margin: "2px 0", color: "var(--text-muted)" }}>{a}</p>)}
        </div>
      )}

      <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Employés</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {lot.paies.map((p) => (
          <LignePaie
            key={p.id}
            paie={p}
            estBrouillon={estBrouillon}
            estVacances={lot.typePaie === "VACANCES"}
            enCours={enCours}
            onAjuster={ajusterPaie}
            onRetirer={retirerEmploye}
            onCorriger={corrigerPaieIndividuelle}
          />
        ))}
      </div>

      {estBrouillon ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 11.5, color: "var(--danger)" }}>
            ⚠️ Une fois traitée, chaque paie sera versée et son écriture comptable créée — une correction se fera ensuite employé par employé, pas pour tout le lot d'un coup.
          </p>
          <button onClick={traiterLaPaie} disabled={enCours || !checklist?.peutComptabiliser} className="bouton-3d" style={{ padding: 13, borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
            ▶️ TRAITER LA PAIE
          </button>
          <button onClick={supprimerLot} disabled={enCours} style={{ padding: 10, borderRadius: 8, border: "1px dashed var(--danger)", background: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer" }}>
            🗑️ Supprimer ce lot
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          Comptabilisée le {new Date(lot.comptabiliseLe).toLocaleString("fr-CA", { timeZone: "America/Toronto" })}.
        </p>
      )}
    </div>
  );
}

function LignePaie({ paie, estBrouillon, estVacances, enCours, onAjuster, onRetirer, onCorriger }) {
  const [valeur, setValeur] = useState(String(estVacances ? paie.salaireBrut : paie.heuresTravaillees));
  const modifiable = estBrouillon && paie.employe.typeRemuneration !== "SALAIRE";

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, opacity: paie.statut === "CORRIGEE" ? 0.5 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {paie.employe.nom}
          {paie.statut === "CORRIGEE" && <span style={{ fontSize: 10.5, color: "var(--danger)", fontWeight: 400 }}> — corrigée</span>}
        </span>
        <span style={{ fontWeight: 700, fontSize: 13, textDecoration: paie.statut === "CORRIGEE" ? "line-through" : "none" }}>{paie.salaireNet.toFixed(2)} $</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
        Brut {paie.salaireBrut.toFixed(2)} $ · Retenues {paie.totalDeductions.toFixed(2)} $
        {!estVacances && ` · ${paie.heuresTravaillees.toFixed(2)} h`}
      </div>

      {modifiable && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)" }}>{estVacances ? "Montant ($)" : "Heures"}</label>
          <input
            type="number" min={0} step="0.01" value={valeur} onChange={(e) => setValeur(e.target.value)}
            style={{ width: 90, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12 }}
          />
          <button
            type="button" disabled={enCours}
            onClick={() => onAjuster(paie.id, estVacances ? { montantVacances: valeur } : { heuresManuelles: valeur })}
            style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: 6, cursor: "pointer" }}
          >
            ↻ Recalculer
          </button>
          <button
            type="button" disabled={enCours} onClick={() => onRetirer(paie.id)}
            style={{ fontSize: 11, color: "var(--danger)", background: "none", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: 6, cursor: "pointer", marginLeft: "auto" }}
          >
            Retirer
          </button>
        </div>
      )}

      {paie.statut === "VERSEE" && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <a href={`/gerant/paie/${paie.id}/talon`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--text)", background: "none", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: 6, textDecoration: "none" }}>
            🖨️ Talon
          </a>
          <button onClick={() => onCorriger(paie.id)} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}>
            ✎ Corriger
          </button>
        </div>
      )}
    </div>
  );
}
