"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icone, TEINTES, TitrePanneau, BoutonAction, stylePanneau } from "../../../components/StyleSection";
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
    <div style={stylePanneau}>
      <TitrePanneau
        icone="etiquette" teinte={TEINTES.bleu} titre="Crédit client"
        sousTitre={solde > 0.005 ? "À appliquer sur une prochaine facture (bouton sur la facture du bon), ou à rembourser." : "Aucun crédit disponible."}
        droite={<span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: solde > 0.005 ? "var(--bleu)" : "var(--text-muted)", paddingTop: 2 }}>{argent(solde)}</span>}
      />

      <div style={{ display: "flex", flexDirection: "column" }}>
        {credits.map((c, i) => {
          const factureNumero = c.facture?.numero || c.paiementFacture?.facture?.numero;
          const bonId = c.facture?.bonId || c.paiementFacture?.facture?.bonId;
          return (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)", minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 14, color: "var(--text)" }}>{LABEL_TYPE[c.type] || c.type}</strong>
                {dateCourte(c.date)}
                {factureNumero && bonId && <> · <Link href={`/bons/${bonId}`} style={{ color: "inherit" }}>#{factureNumero}</Link></>}
                {c.modePaiement && LABEL_MODE_PAIEMENT[c.modePaiement] ? ` · ${LABEL_MODE_PAIEMENT[c.modePaiement]}` : ""}
                {c.compteTresorerie ? ` · ${c.compteTresorerie.nom}` : ""}{c.reference ? ` · réf. ${c.reference}` : ""}
                {c.note && <> · <em>{c.note}</em></>}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                <strong style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", color: c.montant >= 0 ? "var(--success)" : "var(--text)" }}>{c.montant >= 0 ? "+" : "−"}{argent(Math.abs(c.montant))}</strong>
                {peutModifier && !c.paiementFactureId && ( // un crédit lié à un paiement se retire sur la facture
                  <button onClick={() => retirer(c)} disabled={enCours} aria-label="Retirer ce mouvement" title="Retirer ce mouvement" style={{ width: 30, height: 30, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <Icone nom="poubelle" taille={14} couleur="var(--danger)" />
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {(() => {
        const peutRembourser = peutModifier && solde > 0.005;
        const boutons = [
          peutRembourser && { cle: "rembourser", icone: "banque", label: "Rembourser", onClick: () => { setGesteOuvert(false); setMontant(solde.toFixed(2)); setOuvert(true); } },
          peutAccorderGeste && { cle: "geste", icone: "cadeau", label: "Geste commercial", onClick: () => { setOuvert(false); setGesteOuvert(true); } },
        ].filter(Boolean);
        if (boutons.length === 0 || ouvert || gesteOuvert) return null;
        return (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${boutons.length}, 1fr)`, gap: 8, marginTop: 12 }}>
            {boutons.map((b) => <BoutonAction key={b.cle} icone={b.icone} couleur="var(--bleu)" onClick={b.onClick}>{b.label}</BoutonAction>)}
          </div>
        );
      })()}

      {peutModifier && solde > 0.005 && ouvert && (
        <div style={boiteFormulaire}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Rembourser le client</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="number" inputMode="decimal" min={0} step="0.01" placeholder="Montant" value={montant}
              onChange={(e) => setMontant(e.target.value)} style={{ ...champStyle, width: 120, fontWeight: 700 }}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>$</span>
            <input placeholder="Réf. / no de chèque (opt.)" value={reference} onChange={(e) => setReference(e.target.value)} style={{ ...champStyle, flex: 1, minWidth: 0 }} />
          </div>
          <SelecteurCompteMode
            comptes={comptesTresorerie}
            compteTresorerieId={compteTresorerieId} setCompteTresorerieId={setCompteTresorerieId}
            modePaiement={modePaiement} setModePaiement={setModePaiement}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={rembourser} disabled={enCours} className="bouton-3d" style={{ padding: 10, borderRadius: 12, fontSize: 13.5, fontWeight: 700 }}>
              {enCours ? "…" : `✓ Rembourser ${argent((Number(montant) || 0))}`}
            </button>
            <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={() => setOuvert(false)}>Annuler</BoutonAction>
          </div>
        </div>
      )}
      {peutAccorderGeste && gesteOuvert && (
        <div style={boiteFormulaire}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Geste commercial</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="number" inputMode="decimal" min={0} step="0.01" placeholder="Montant" value={gesteMontant}
              onChange={(e) => setGesteMontant(e.target.value)} style={{ ...champStyle, width: 120, fontWeight: 700 }}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>$</span>
            <input
              placeholder="Raison (ex. retard de livraison)" value={gesteRaison} maxLength={300}
              onChange={(e) => setGesteRaison(e.target.value)} style={{ ...champStyle, flex: 1, minWidth: 0 }}
            />
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Crédit offert, à utiliser sur une prochaine facture (dépense « Gestes commerciaux »). Les taxes de cette facture restent normales — pour réduire le prix d'un travail précis, utilise plutôt l'escompte du bon.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={accorderGeste} disabled={enCours} className="bouton-3d" style={{ padding: 10, borderRadius: 12, fontSize: 13.5, fontWeight: 700 }}>
              {enCours ? "…" : `✓ Accorder ${argent((Number(gesteMontant) || 0))}`}
            </button>
            <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={() => setGesteOuvert(false)}>Annuler</BoutonAction>
          </div>
        </div>
      )}
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12.5, fontWeight: 700, margin: "8px 0 0" }}>{erreur}</p>}
      {avertissement && <p style={{ color: "var(--accent-ombre)", fontSize: 12, margin: "8px 0 0" }}>⚠️ {avertissement}</p>}
    </div>
  );
}

const boiteFormulaire = { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 12, display: "flex", flexDirection: "column", gap: 8 };
const champStyle = {
  padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 12.5, boxSizing: "border-box",
};
