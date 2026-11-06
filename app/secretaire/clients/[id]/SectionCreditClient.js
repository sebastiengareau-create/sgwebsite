"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TitreSection } from "../../../components/ui";
import SelecteurCompteMode, { compteParDefaut } from "../../../components/SelecteurCompteMode";
import { LABEL_MODE_PAIEMENT } from "@/lib/modesPaiement";
import { argent } from "@/lib/format";

const LABEL_TYPE = {
  TROP_PAYE: "Trop-payé",
  DEPOT: "Excédent de dépôt",
  APPLIQUE: "Appliqué",
  REMBOURSE: "Remboursé",
  RETOUR: "Retour de pièce",
  GESTE: "Geste commercial",
};
const dateCourte = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });

// Crédit client (lib/creditClient.js) : solde, historique des mouvements et
// remboursement. Le crédit se garde à l'encaissement d'une facture (trop-payé)
// ou depuis un dépôt plus grand que sa facture, et s'applique sur la facture
// d'un bon (« Appliquer … sur la facture »). Le gérant peut aussi accorder
// un geste commercial (peutAccorderGeste).
export default function SectionCreditClient({ clientId, credits, comptesTresorerie, peutModifier, peutAccorderGeste = false }) {
  const router = useRouter();
  const solde = Math.round(credits.reduce((s, c) => s + c.montant, 0) * 100) / 100;
  const [ouvert, setOuvert] = useState(false);
  const [montant, setMontant] = useState("");
  const [modePaiement, setModePaiement] = useState("COMPTANT");
  const [compteTresorerieId, setCompteTresorerieId] = useState(() => compteParDefaut(comptesTresorerie));
  const [reference, setReference] = useState("");
  const [erreur, setErreur] = useState("");
  const [avertissement, setAvertissement] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [gesteOuvert, setGesteOuvert] = useState(false);
  const [gesteMontant, setGesteMontant] = useState("");
  const [gesteRaison, setGesteRaison] = useState("");

  if (credits.length === 0 && !peutAccorderGeste) return null;

  async function accorderGeste() {
    if (!(Number(gesteMontant) > 0)) { setErreur("Entre le montant du geste."); return; }
    if (!gesteRaison.trim()) { setErreur("Indique la raison du geste."); return; }
    const ok = await appel(`/api/clients/${clientId}/geste`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ montant: Number(gesteMontant), note: gesteRaison }),
    });
    if (ok) { setGesteOuvert(false); setGesteMontant(""); setGesteRaison(""); }
  }

  async function appel(url, options) {
    setErreur("");
    setAvertissement("");
    setEnCours(true);
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) { setErreur(data.erreur || "Erreur."); return false; }
    if (data.avertissementComptable) setAvertissement(`Enregistré, mais aucune écriture comptable créée : ${data.avertissementComptable}.`);
    router.refresh();
    return true;
  }

  async function rembourser() {
    const m = Number(montant);
    if (!(m > 0)) { setErreur("Entre le montant remboursé."); return; }
    if (m > solde + 0.005) { setErreur(`Le client n'a que ${argent(solde)} de crédit.`); return; }
    const ok = await appel(`/api/clients/${clientId}/credit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ montant: m, modePaiement, compteTresorerieId, reference }),
    });
    if (ok) { setOuvert(false); setMontant(""); setReference(""); }
  }

  async function retirer(c) {
    if (!window.confirm(`Retirer ce mouvement de ${argent(Math.abs(c.montant))} ? Son écriture comptable sera supprimée (entré par erreur).`)) return;
    await appel(`/api/credits/${c.id}`, { method: "DELETE" });
  }

  return (
    <div className="carte" style={{ marginBottom: 12 }}>
      <TitreSection>🎟️ Crédit client</TitreSection>
      <div style={{ fontSize: 18, fontWeight: 700, color: solde > 0.005 ? "var(--success)" : "var(--text-muted)" }}>{argent(solde)}</div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "2px 0 8px" }}>
        {solde > 0.005 ? "À appliquer sur une prochaine facture (bouton sur la facture du bon), ou à rembourser." : "Aucun crédit disponible."}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {credits.map((c) => {
          const factureNumero = c.facture?.numero || c.paiementFacture?.facture?.numero;
          const bonId = c.facture?.bonId || c.paiementFacture?.facture?.bonId;
          return (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12, padding: "4px 8px", borderRadius: 6, background: "var(--bg)" }}>
              <span style={{ color: "var(--text-muted)", minWidth: 0 }}>
                {dateCourte(c.date)} — <strong style={{ color: "var(--text)" }}>{LABEL_TYPE[c.type] || c.type}</strong>
                {factureNumero && bonId && <> · <Link href={`/bons/${bonId}`} style={{ color: "inherit" }}>#{factureNumero}</Link></>}
                {c.modePaiement && LABEL_MODE_PAIEMENT[c.modePaiement] ? ` · ${LABEL_MODE_PAIEMENT[c.modePaiement]}` : ""}
                {c.compteTresorerie ? ` · ${c.compteTresorerie.nom}` : ""}{c.reference ? ` · réf. ${c.reference}` : ""}
                {c.note && <> · <em>{c.note}</em></>}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                <strong style={{ color: c.montant >= 0 ? "var(--success)" : "var(--text)" }}>{c.montant >= 0 ? "+" : "−"}{argent(Math.abs(c.montant))}</strong>
                {peutModifier && !c.paiementFactureId && ( // un crédit lié à un paiement se retire sur la facture
                  <button onClick={() => retirer(c)} disabled={enCours} aria-label="Retirer ce mouvement" style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 13, padding: 0 }}>✕</button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {peutModifier && solde > 0.005 && (
        ouvert ? (
          <div style={{ background: "var(--bg)", borderRadius: 8, padding: 10, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number" inputMode="decimal" min={0} step="0.01" placeholder="Montant" value={montant}
                onChange={(e) => setMontant(e.target.value)} style={{ ...champStyle, width: 110, fontWeight: 700 }}
              />
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>$</span>
              <input placeholder="Réf. / no de chèque (opt.)" value={reference} onChange={(e) => setReference(e.target.value)} style={{ ...champStyle, flex: 1, minWidth: 0 }} />
            </div>
            <SelecteurCompteMode
              comptes={comptesTresorerie}
              compteTresorerieId={compteTresorerieId} setCompteTresorerieId={setCompteTresorerieId}
              modePaiement={modePaiement} setModePaiement={setModePaiement}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={rembourser} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                {enCours ? "…" : `✓ Rembourser ${argent((Number(montant) || 0))}`}
              </button>
              <button onClick={() => setOuvert(false)} style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setMontant(solde.toFixed(2)); setOuvert(true); }}
            style={{ width: "100%", marginTop: 8, padding: 9, borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--accent)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
          >
            💵 Rembourser le client
          </button>
        )
      )}
      {peutAccorderGeste && (
        gesteOuvert ? (
          <div style={{ background: "var(--bg)", borderRadius: 8, padding: 10, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number" inputMode="decimal" min={0} step="0.01" placeholder="Montant" value={gesteMontant}
                onChange={(e) => setGesteMontant(e.target.value)} style={{ ...champStyle, width: 110, fontWeight: 700 }}
              />
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>$</span>
              <input
                placeholder="Raison (ex. retard de livraison)" value={gesteRaison} maxLength={300}
                onChange={(e) => setGesteRaison(e.target.value)} style={{ ...champStyle, flex: 1, minWidth: 0 }}
              />
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
              Crédit offert, à utiliser sur une prochaine facture (dépense « Gestes commerciaux »). Les taxes de cette facture restent normales — pour réduire le prix d'un travail précis, utilise plutôt l'escompte du bon.
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={accorderGeste} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                {enCours ? "…" : `✓ Accorder ${argent((Number(gesteMontant) || 0))}`}
              </button>
              <button onClick={() => setGesteOuvert(false)} style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setGesteOuvert(true)}
            style={{ width: "100%", marginTop: 8, padding: 9, borderRadius: 8, border: "1px dashed var(--border)", background: "none", color: "var(--text-muted)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
          >
            🎁 Geste commercial
          </button>
        )
      )}
      {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5, margin: "6px 0 0" }}>{erreur}</p>}
      {avertissement && <p style={{ color: "var(--accent)", fontSize: 11, margin: "6px 0 0" }}>⚠️ {avertissement}</p>}
    </div>
  );
}

const champStyle = {
  padding: "8px 9px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 12.5, boxSizing: "border-box",
};
