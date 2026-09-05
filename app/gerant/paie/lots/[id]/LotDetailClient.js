"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LotDetailClient({ lot, checklist, employesDisponibles }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [avertissements, setAvertissements] = useState([]);
  const [employeAAjouter, setEmployeAAjouter] = useState("");
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

  async function ajouterEmploye() {
    if (!employeAAjouter) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/paie/lots/${lot.id}/paies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeId: employeAAjouter }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de l'ajout.");
      return;
    }
    setEmployeAAjouter("");
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
        {lot.dateVersementPrevue && ` · Versement le ${new Date(lot.dateVersementPrevue).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}`}
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

      {estBrouillon && employesDisponibles.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <select value={employeAAjouter} onChange={(e) => setEmployeAAjouter(e.target.value)} style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}>
            <option value="">+ Ajouter un employé oublié…</option>
            {employesDisponibles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
          <button type="button" disabled={enCours || !employeAAjouter} onClick={ajouterEmploye} className="bouton-3d-sombre" style={{ padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
            Ajouter
          </button>
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
  const [ouvert, setOuvert] = useState(false);
  const [heuresValeur, setHeuresValeur] = useState(String(paie.heuresTravaillees));
  const [montantValeur, setMontantValeur] = useState(String(paie.salaireBrut));
  const [boniValeur, setBoniValeur] = useState(String(paie.boni || 0));
  const modifiable = estBrouillon && paie.employe.typeRemuneration !== "SALAIRE";

  const infoRemuneration = paie.employe.typeRemuneration === "SALAIRE"
    ? `Salarié — ${(paie.employe.salaireAnnuel || 0).toFixed(2)} $/an`
    : `${(paie.employe.tauxHoraireEmploye || 0).toFixed(2)} $/h`;

  function recalculer() {
    onAjuster(paie.id, estVacances ? { montantVacances: montantValeur } : { heuresManuelles: heuresValeur, boni: boniValeur });
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, opacity: paie.statut === "CORRIGEE" ? 0.5 : 1 }}>
      <div onClick={() => setOuvert((v) => !v)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {paie.employe.nom}
            {paie.statut === "CORRIGEE" && <span style={{ fontSize: 10.5, color: "var(--danger)", fontWeight: 400 }}> — corrigée</span>}
          </span>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{infoRemuneration}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Brut {paie.salaireBrut.toFixed(2)} $</div>
          <span style={{ fontWeight: 700, fontSize: 13, textDecoration: paie.statut === "CORRIGEE" ? "line-through" : "none" }}>{paie.salaireNet.toFixed(2)} $</span>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{ouvert ? "▲ replier" : "▼ détails"}</div>
        </div>
      </div>

      {!ouvert && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
          Retenues {paie.totalDeductions.toFixed(2)} $
          {!estVacances && ` · ${paie.heuresTravaillees.toFixed(2)} h`}
          {!estVacances && paie.heuresHorodateur != null && paie.heuresHorodateur !== paie.heuresTravaillees && ` (${paie.heuresHorodateur.toFixed(2)} h réelles)`}
          {paie.boni > 0 && ` · +${paie.boni.toFixed(2)} $ boni`}
        </div>
      )}

      {ouvert && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
          {modifiable ? (
            <>
              {estVacances ? (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Montant de vacances ($)</label>
                  <input
                    type="number" min={0} step="0.01" value={montantValeur} onChange={(e) => setMontantValeur(e.target.value)}
                    style={{ width: "100%", padding: "7px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                      Heures
                      {paie.heuresHorodateur != null && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> ({paie.heuresHorodateur.toFixed(2)} h réelles)</span>}
                    </label>
                    <input
                      type="number" min={0} step="0.01" value={heuresValeur} onChange={(e) => setHeuresValeur(e.target.value)}
                      style={{ width: "100%", padding: "7px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Boni / extra ($)</label>
                    <input
                      type="number" min={0} step="0.01" value={boniValeur} onChange={(e) => setBoniValeur(e.target.value)}
                      style={{ width: "100%", padding: "7px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <button type="button" disabled={enCours} onClick={recalculer} style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "1px solid var(--border)", padding: "7px 10px", borderRadius: 6, cursor: "pointer" }}>
                  ↻ Recalculer
                </button>
                <button type="button" disabled={enCours} onClick={() => onRetirer(paie.id)} style={{ fontSize: 11, color: "var(--danger)", background: "none", border: "1px solid var(--border)", padding: "7px 10px", borderRadius: 6, cursor: "pointer" }}>
                  Retirer
                </button>
              </div>
            </>
          ) : (
            !estVacances && <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{paie.heuresTravaillees.toFixed(2)} h{paie.boni > 0 && ` · +${paie.boni.toFixed(2)} $ boni`}</div>
          )}

          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: 6 }}>Retenues détaillées</div>
          <LigneDetail label="RRQ" valeur={paie.rrqEmploye} />
          <LigneDetail label="RQAP" valeur={paie.rqapEmploye} />
          <LigneDetail label="Assurance-emploi" valeur={paie.aeEmploye} />
          <LigneDetail label="Impôt fédéral" valeur={paie.impotFederal} />
          <LigneDetail label="Impôt Québec" valeur={paie.impotQuebec} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginTop: 4, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
            <span>Total retenues</span>
            <span>{paie.totalDeductions.toFixed(2)} $</span>
          </div>

          {paie.statut === "VERSEE" && (
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <a href={`/gerant/paie/${paie.id}/talon`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--text)", background: "none", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: 6, textDecoration: "none" }}>
                🖨️ Talon
              </a>
              <button onClick={() => onCorriger(paie.id)} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}>
                ✎ Corriger
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LigneDetail({ label, valeur }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 3 }}>
      <span>{label}</span>
      <span>{valeur.toFixed(2)} $</span>
    </div>
  );
}
