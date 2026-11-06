"use client";

import { useState } from "react";
import SelecteurCompteMode, { compteParDefaut } from "./SelecteurCompteMode";
import { argent } from "@/lib/format";

// Facture négative (retour de pièce, lib/retours.js) : le montant dû au
// client est gardé en crédit client ou lui est remboursé
// (lib/creditClient.js → reglerFactureNegative). onRegler(corps) retourne un
// message d'erreur, ou null.
export default function ReglementRetour({ montant, comptesTresorerie, onRegler, peutModifier }) {
  const [rembourser, setRembourser] = useState(false);
  const [compteTresorerieId, setCompteTresorerieId] = useState(() => compteParDefaut(comptesTresorerie));
  const [modePaiement, setModePaiement] = useState("COMPTANT");
  const [reference, setReference] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function regler(corps) {
    setErreur("");
    setEnCours(true);
    const err = await onRegler(corps);
    setEnCours(false);
    if (err) setErreur(err);
  }

  return (
    <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: "var(--bg)", border: "1px dashed var(--accent)", fontSize: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: 700 }}>
        <span>↩ À remettre au client</span>
        <span style={{ color: "var(--accent)" }}>{argent(montant)}</span>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 8px" }}>
        Le retour vaut plus que ce qui a été ajouté : garde la différence en crédit pour une prochaine facture, ou rembourse le client.
      </p>
      {peutModifier && (rembourser ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input placeholder="Réf. / no de chèque (opt.)" value={reference} onChange={(e) => setReference(e.target.value)} style={champStyle} />
          <SelecteurCompteMode
            comptes={comptesTresorerie}
            compteTresorerieId={compteTresorerieId} setCompteTresorerieId={setCompteTresorerieId}
            modePaiement={modePaiement} setModePaiement={setModePaiement}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => regler({ mode: "REMBOURSEMENT", compteTresorerieId, modePaiement, reference })} disabled={enCours}
              className="bouton-3d" style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 700 }}
            >
              {enCours ? "…" : `✓ Rembourser ${argent(montant)}`}
            </button>
            <button onClick={() => setRembourser(false)} style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => regler({ mode: "CREDIT" })} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
            🎟️ Garder en crédit client
          </button>
          <button onClick={() => setRembourser(true)} disabled={enCours} style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, background: "none", border: "1px solid var(--border)", color: "var(--accent)", fontWeight: 700, cursor: "pointer" }}>
            💵 Rembourser
          </button>
        </div>
      ))}
      {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5, margin: "6px 0 0" }}>{erreur}</p>}
    </div>
  );
}

const champStyle = {
  padding: "8px 9px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 12.5, boxSizing: "border-box",
};
