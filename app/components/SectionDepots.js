"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormulaireEncaissement from "./FormulaireEncaissement";
import { LABEL_MODE_PAIEMENT } from "@/lib/modesPaiement";

const arrondir = (n) => Math.round(n * 100) / 100;

// Dépôts reçus avant la facture, sur une soumission ou un bon de commande
// (lib/depots.js) : liste, solde estimé après dépôts et bouton « 💰 Encaisser
// un dépôt » (mêmes lignes de paiement qu'une facture). Utilisé par
// app/bons/BonDetailClient.js et la liste des soumissions.
// cible : { soumissionId } ou { bonId } ; totalEstime : total taxes incluses
// (null : pas de solde affiché) ; peutEncaisser : faux une fois facturé.
export default function SectionDepots({ depots = [], totalEstime = null, comptesTresorerie = [], cible, peutModifier = true, peutEncaisser = true, compact = false }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState("");
  const [avertissement, setAvertissement] = useState("");
  const [enCours, setEnCours] = useState(false);

  const totalDepots = arrondir(depots.reduce((s, d) => s + d.montant, 0));
  const solde = totalEstime == null ? null : arrondir(totalEstime - totalDepots);

  async function encaisser(paiements) {
    setAvertissement("");
    const res = await fetch("/api/depots", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cible, paiements }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.erreur || "Erreur.";
    if (data.avertissementComptable) setAvertissement(`Dépôt enregistré, mais aucune écriture comptable créée : ${data.avertissementComptable}.`);
    setOuvert(false);
    router.refresh();
    return null;
  }

  // Excédent d'un dépôt sur sa facture : passé au crédit du client au lieu
  // d'être remboursé (lib/creditClient.js)
  async function crediter(d, reste) {
    if (!window.confirm(`Garder l'excédent de ${reste.toFixed(2)} $ en crédit au client, pour une prochaine facture ?`)) return;
    setErreur("");
    setAvertissement("");
    setEnCours(true);
    const res = await fetch(`/api/depots/${d.id}/crediter`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) { setErreur(data.erreur || "Erreur."); return; }
    if (data.avertissementComptable) setAvertissement(`Crédit enregistré, mais aucune écriture comptable créée : ${data.avertissementComptable}.`);
    router.refresh();
  }

  async function retirer(d) {
    if (!window.confirm(`Retirer le dépôt de ${d.montant.toFixed(2)} $ ? Son écriture comptable sera supprimée (dépôt entré par erreur, ou remboursé au client).`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/depots/${d.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) { setErreur(data.erreur || "Erreur."); return; }
    router.refresh();
  }

  if (depots.length === 0 && !(peutModifier && peutEncaisser)) return null;

  return (
    <div style={{ marginTop: compact ? 8 : 12, padding: compact ? 0 : 10, borderRadius: 8, background: compact ? "none" : "var(--bg)", border: compact ? "none" : "1px solid var(--border)" }}>
      {depots.length > 0 && (
        <div style={{ marginBottom: peutModifier && peutEncaisser ? 8 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Dépôts reçus</div>
          {depots.map((d) => {
            const applique = d.paiementFacture != null;
            const auCredit = d.creditClient?.montant ?? 0;
            const reste = applique ? arrondir(d.montant - d.paiementFacture.montant - auCredit) : 0;
            return (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12, padding: "3px 0" }}>
                <span style={{ color: "var(--text-muted)", minWidth: 0 }}>
                  {new Date(d.datePaiement).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} — {LABEL_MODE_PAIEMENT[d.modePaiement] || "Paiement"}
                  {d.compteTresorerie ? ` · ${d.compteTresorerie.nom}` : ""}{d.reference ? ` · réf. ${d.reference}` : ""}
                  {applique && <span style={{ color: "var(--success)" }}> · appliqué à la facture</span>}
                  {auCredit > 0.005 && <span style={{ color: "var(--success)" }}> · {auCredit.toFixed(2)} $ au crédit du client</span>}
                  {reste > 0.005 && <span style={{ color: "var(--danger)" }}> · {reste.toFixed(2)} $ à rembourser</span>}
                  {reste > 0.005 && peutModifier && (
                    <button onClick={() => crediter(d, reste)} disabled={enCours} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, cursor: "pointer", fontSize: 11.5, padding: "0 0 0 6px" }}>
                      → garder en crédit
                    </button>
                  )}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                  <strong>{d.montant.toFixed(2)} $</strong>
                  {peutModifier && !applique && !auCredit && (
                    <button onClick={() => retirer(d)} disabled={enCours} aria-label="Retirer ce dépôt" style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 13, padding: 0 }}>✕</button>
                  )}
                </span>
              </div>
            );
          })}
          {solde != null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, paddingTop: 5, marginTop: 3, borderTop: "1px solid var(--border)" }}>
              <span>Solde après dépôt{depots.length > 1 ? "s" : ""}</span>
              <span style={{ color: solde < -0.005 ? "var(--danger)" : "#C9A227" }}>{solde.toFixed(2)} $</span>
            </div>
          )}
        </div>
      )}
      {peutModifier && peutEncaisser && (
        ouvert ? (
          <FormulaireEncaissement
            depot comptesTresorerie={comptesTresorerie} solde={Math.max(0, solde ?? 0)}
            onConfirmer={encaisser} onAnnuler={() => setOuvert(false)}
          />
        ) : (
          <button
            onClick={() => setOuvert(true)}
            style={{ width: compact ? "auto" : "100%", padding: compact ? "6px 10px" : 9, borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--accent)", fontWeight: 700, fontSize: compact ? 11 : 12.5, cursor: "pointer" }}
          >
            💰 Encaisser un dépôt
          </button>
        )
      )}
      {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5, margin: "6px 0 0" }}>{erreur}</p>}
      {avertissement && <p style={{ color: "var(--accent)", fontSize: 11, margin: "6px 0 0" }}>⚠️ {avertissement}</p>}
    </div>
  );
}
