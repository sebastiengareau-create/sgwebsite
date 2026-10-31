"use client";

import { useState } from "react";
import SelecteurCompteMode, { compteParDefaut } from "./SelecteurCompteMode";

const arrondir = (n) => Math.round(n * 100) / 100;
let prochaineCle = 1;

// Encaissement d'une facture en un ou plusieurs paiements (voir
// lib/paiementsFactures.js) — ex. 1000 $ comptant + 3500 $ par virement.
// Le total peut être plus petit que le solde : la facture reste alors
// impayée avec le reste, à encaisser plus tard. Utilisé par
// app/bons/BonDetailClient.js et app/secretaire/factures/FacturesClient.js.
// onConfirmer(paiements) retourne un message d'erreur, ou null.
export default function FormulaireEncaissement({ comptesTresorerie, solde, onConfirmer, onAnnuler }) {
  const nouvelleLigne = (montant, modePaiement = "CARTE_DEBIT") => ({
    cle: prochaineCle++, montant: montant > 0 ? montant.toFixed(2) : "", modePaiement,
    compteTresorerieId: compteSuggere(comptesTresorerie, modePaiement), reference: "",
  });
  const [lignes, setLignes] = useState(() => [nouvelleLigne(solde)]);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const total = arrondir(lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0));
  const reste = arrondir(solde - total);
  const depasse = reste < -0.005;

  function modifier(cle, champs) {
    setLignes((ls) => ls.map((l) => {
      if (l.cle !== cle) return l;
      const suite = { ...l, ...champs };
      // Le mode choisi suggère son compte (comptant → caisse), sans écraser un compte choisi à la main
      if (champs.modePaiement && l.compteTresorerieId === compteSuggere(comptesTresorerie, l.modePaiement)) {
        suite.compteTresorerieId = compteSuggere(comptesTresorerie, champs.modePaiement);
      }
      return suite;
    }));
  }

  async function confirmer() {
    if (lignes.some((l) => !l.compteTresorerieId)) { setErreur("Aucun compte de trésorerie disponible."); return; }
    if (lignes.some((l) => !(Number(l.montant) > 0)) && solde > 0) { setErreur("Entre le montant de chaque paiement."); return; }
    if (depasse) { setErreur(`Le total dépasse le solde de ${solde.toFixed(2)} $.`); return; }
    setErreur("");
    setEnCours(true);
    const erreurRes = await onConfirmer(lignes.map(({ cle, ...l }) => ({ ...l, montant: Number(l.montant) || 0 })));
    setEnCours(false);
    if (erreurRes) setErreur(erreurRes);
  }

  return (
    <div style={{ background: "var(--bg)", borderRadius: 8, padding: 10, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
      {lignes.map((l, i) => (
        <div key={l.cle} style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: i > 0 ? 8 : 0, borderTop: i > 0 ? "1px dashed var(--border)" : "none" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="number" inputMode="decimal" min={0} step="0.01" placeholder="Montant" value={l.montant}
              onChange={(e) => modifier(l.cle, { montant: e.target.value })}
              style={{ ...champStyle, width: 110, fontWeight: 700 }}
            />
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>$</span>
            <input
              placeholder="Réf. / no de chèque (opt.)" value={l.reference}
              onChange={(e) => modifier(l.cle, { reference: e.target.value })}
              style={{ ...champStyle, flex: 1, minWidth: 0 }}
            />
            {lignes.length > 1 && (
              <button
                onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))} aria-label="Retirer ce paiement"
                style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 15, cursor: "pointer", padding: "0 2px" }}
              >
                ✕
              </button>
            )}
          </div>
          <SelecteurCompteMode
            comptes={comptesTresorerie}
            compteTresorerieId={l.compteTresorerieId} setCompteTresorerieId={(id) => modifier(l.cle, { compteTresorerieId: id })}
            modePaiement={l.modePaiement} setModePaiement={(m) => modifier(l.cle, { modePaiement: m })}
          />
        </div>
      ))}
      <button
        onClick={() => setLignes((ls) => [...ls, nouvelleLigne(reste, "CHEQUE")])}
        style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
      >
        + Ajouter un autre mode de paiement
      </button>
      <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between", gap: 8, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
        <span style={{ color: "var(--text-muted)" }}>Solde de la facture : {solde.toFixed(2)} $</span>
        <span style={{ fontWeight: 700, color: depasse ? "var(--danger)" : reste > 0.005 ? "var(--accent)" : "var(--success)" }}>
          {depasse ? `${(-reste).toFixed(2)} $ de trop` : reste > 0.005 ? `Reste à payer : ${reste.toFixed(2)} $` : "Payée au complet"}
        </span>
      </div>
      {reste > 0.005 && !depasse && (
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0 }}>
          La facture restera impayée avec un solde de {reste.toFixed(2)} $, à encaisser plus tard.
        </p>
      )}
      {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5, margin: 0 }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={confirmer} disabled={enCours || depasse} className="bouton-3d" style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
          {enCours ? "…" : `✓ Encaisser ${total.toFixed(2)} $`}
        </button>
        <button onClick={onAnnuler} style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// Comptant → la première caisse s'il y en a une ; sinon le compte par défaut (banque)
function compteSuggere(comptes, modePaiement) {
  if (modePaiement === "COMPTANT") {
    const caisse = comptes.find((c) => c.categorie === "CAISSE");
    if (caisse) return caisse.id;
  }
  return compteParDefaut(comptes);
}

const champStyle = {
  padding: "8px 9px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 12.5, boxSizing: "border-box",
};
