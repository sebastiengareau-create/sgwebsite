"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const STATUT_INFO = {
  OUVERTE: { icone: "🟢", label: "Ouverte", couleur: "var(--success)" },
  VERROUILLEE: { icone: "🟡", label: "Verrouillée", couleur: "#C9A227" },
  FERMEE: { icone: "🔴", label: "Fermée", couleur: "var(--danger)" },
};

export default function AssistantFermetureClient({ annee, mois, statut, statutParNom, statutLe, resume, checklist, estGerantOuDev }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [afficherReouverture, setAfficherReouverture] = useState(false);
  const [motif, setMotif] = useState("");

  const info = STATUT_INFO[statut];

  async function verrouiller() {
    setErreur(""); setEnCours(true);
    const res = await fetch(`/api/comptabilite/periodes/${annee}/${mois}/verrouiller`, { method: "POST" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    router.refresh();
  }

  async function fermer() {
    if (!window.confirm(`Fermer ${NOMS_MOIS[mois - 1]} ${annee} ? Après fermeture, les écritures de cette période ne pourront plus être modifiées ni supprimées, et aucune nouvelle pièce datée dans cette période ne sera acceptée.`)) return;
    setErreur(""); setEnCours(true);
    const res = await fetch(`/api/comptabilite/periodes/${annee}/${mois}/fermer`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setErreur(data.erreur || "Erreur lors de la fermeture.");
      return;
    }
    router.refresh();
  }

  async function reouvrir() {
    if (!motif.trim()) {
      setErreur("Un motif est requis pour rouvrir cette période.");
      return;
    }
    if (!window.confirm("Rouvrir cette période ? Ça peut modifier les états financiers et les rapports fiscaux déjà produits.")) return;
    setErreur(""); setEnCours(true);
    const res = await fetch(`/api/comptabilite/periodes/${annee}/${mois}/reouvrir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motif }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setErreur(data.erreur || "Erreur lors de la réouverture.");
      return;
    }
    setMotif(""); setAfficherReouverture(false);
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href={`/gerant/comptabilite/fermeture?annee=${annee}`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour</Link>
      <h1 style={{ fontSize: 20, margin: "8px 0 4px" }}>Fermeture — {NOMS_MOIS[mois - 1]} {annee}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: info.couleur }}>{info.icone} {info.label}</span>
        {statutParNom && statutLe && (
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            par {statutParNom}, le {new Date(statutLe).toLocaleString("fr-CA", { timeZone: "America/Toronto" })}
          </span>
        )}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: 10 }}>
          Checklist de fermeture — {checklist.pourcentage}% complétée
        </div>
        {checklist.blocages.map((b) => (
          <div key={b.cle} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span>{b.ok ? "🟢" : "🔴"} {b.label}</span>
            {b.detail && <span style={{ color: "var(--danger)", fontSize: 11.5 }}>{b.detail}</span>}
          </div>
        ))}
        <div style={{ fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 10, marginBottom: 6 }}>Informatif</div>
        {checklist.informatifs.map((i) => (
          <div key={i.cle} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-muted)", marginBottom: 4 }}>
            <span>🟡 {i.label}</span>
            <span>{i.valeur}</span>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: 10 }}>Résumé</div>
        <LigneResume label="Revenus" valeur={resume.revenus} />
        <LigneResume label="Dépenses" valeur={resume.depenses} />
        <LigneResume label="Bénéfice net" valeur={resume.beneficeNet} gras />
        <LigneResume label="TPS à remettre" valeur={resume.tpsARemettre} />
        <LigneResume label="TVQ à remettre" valeur={resume.tvqARemettre} />
        <LigneResume label="Clients à recevoir" valeur={resume.clientsARecevoir} />
        <LigneResume label="Fournisseurs à payer" valeur={resume.fournisseursAPayer} />
        <LigneResume label="Solde bancaire" valeur={resume.soldeBancaire} />
      </div>

      {statut !== "FERMEE" && (
        <p style={{ fontSize: 11.5, color: "var(--danger)", marginBottom: 12 }}>
          ⚠️ Après fermeture, les écritures de cette période ne pourront plus être modifiées ni supprimées, et aucune nouvelle pièce datée dedans ne sera acceptée. Une correction nécessitera une écriture d'ajustement ou une réouverture autorisée.
        </p>
      )}

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {statut === "OUVERTE" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={verrouiller} disabled={enCours} className="bouton-3d-sombre" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
            🟡 Verrouiller
          </button>
          <button onClick={fermer} disabled={enCours || !checklist.peutFermer} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
            🔴 Fermer la période
          </button>
        </div>
      )}
      {statut === "VERROUILLEE" && (
        <button onClick={fermer} disabled={enCours || !checklist.peutFermer} className="bouton-3d" style={{ width: "100%", padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13, marginBottom: 16 }}>
          🔴 Fermer la période
        </button>
      )}

      {estGerantOuDev && statut !== "OUVERTE" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
          {!afficherReouverture ? (
            <button onClick={() => setAfficherReouverture(true)} style={{ background: "none", border: "1px dashed var(--danger)", color: "var(--danger)", width: "100%", padding: 10, borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}>
              🔄 Rouvrir la période
            </button>
          ) : (
            <>
              <p style={{ fontSize: 11.5, color: "var(--danger)", marginBottom: 8 }}>
                ⚠️ La réouverture peut modifier les états financiers et les rapports fiscaux déjà produits.
              </p>
              <textarea
                required
                placeholder="Motif de la réouverture (obligatoire)"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={reouvrir} disabled={enCours} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "var(--danger)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Confirmer la réouverture
                </button>
                <button onClick={() => setAfficherReouverture(false)} style={{ padding: "0 14px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                  Annuler
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LigneResume({ label, valeur, gras }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: gras ? 14 : 13, fontWeight: gras ? 700 : 400, marginBottom: 6 }}>
      <span style={{ color: gras ? "var(--text)" : "var(--text-muted)" }}>{label}</span>
      <span>{valeur.toFixed(2)} $</span>
    </div>
  );
}
