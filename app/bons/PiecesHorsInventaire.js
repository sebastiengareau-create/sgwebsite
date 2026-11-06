"use client";

import { useState } from "react";
import { CLIENT } from "@/lib/client";
import { ligneDePieceSoumission } from "@/lib/piecesSoumission";
import { argent } from "@/lib/format";

// Section « Pièces » du bon : lignes de pièces à ligne fixe (compte 4010,
// lib/piecesSoumission.js) — pièces d'une soumission facturée, et pièces hors
// inventaire achetées pour ce bon seulement (description, quantité, coûtant,
// vendant ; ni fiche ni mouvement de stock). Avant la facture, une pièce hors
// inventaire se modifie ou se retire, et « + Pièce hors inventaire » en ajoute
// une. Le coûtant (figé sur la ligne) va au coût des pièces vendues à la
// facture.
export default function PiecesHorsInventaire({ bonId, lignes, modifiable, onRafraichir }) {
  const [formulaire, setFormulaire] = useState(null); // null | { id?: ligne modifiée, ...champs }
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  if (lignes.length === 0 && !modifiable) return null;

  function ouvrir(pr) {
    setErreur("");
    setFormulaire(pr
      ? { id: pr.id, description: pr.description, qte: String(pr.factureQte ?? 1), coutant: pr.factureCoutant != null ? String(pr.factureCoutant) : "", prix: String(pr.facturePrixUnitaire ?? ""), prixManuel: true }
      : { description: "", qte: "1", coutant: "", prix: "", prixManuel: false });
  }

  // Profil margePrixVente : le vendant est proposé à partir du coûtant, comme
  // à la création d'une pièce d'inventaire, tant qu'il n'est pas saisi à la main
  function changerCoutant(valeur) {
    setFormulaire((f) => {
      const suivant = { ...f, coutant: valeur };
      const marge = CLIENT.margePrixVente;
      if (marge != null && !f.prixManuel) {
        const c = parseFloat(valeur.replace(",", "."));
        suivant.prix = Number.isFinite(c) && c >= 0 ? (c / (1 - marge / 100)).toFixed(2) : "";
      }
      return suivant;
    });
  }

  async function enregistrer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const { id, description, qte, coutant, prix } = formulaire;
    const res = await fetch(`/api/bons/${bonId}/pieces-hors-inventaire${id ? `/${id}` : ""}`, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, qte, coutant, prix }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de l'enregistrement.");
      return;
    }
    setFormulaire(null);
    onRafraichir();
  }

  async function retirer(pr) {
    if (!confirm(`Retirer « ${pr.description} » du bon ?`)) return;
    setEnCours(true);
    const res = await fetch(`/api/bons/${bonId}/pieces-hors-inventaire/${pr.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors du retrait.");
      return;
    }
    onRafraichir();
  }

  const nombre = (v) => parseFloat(String(v).replace(",", "."));
  const apercu = formulaire && Number.isFinite(nombre(formulaire.qte)) && Number.isFinite(nombre(formulaire.prix))
    ? nombre(formulaire.qte) * nombre(formulaire.prix)
    : null;

  return (
    <div style={{ marginTop: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-muted)", marginBottom: 8 }}>
        {lignes.length > 0 ? `Pièces (${lignes.length})` : "Pièces hors inventaire"}
      </div>
      {lignes.map((pr) => {
        const l = ligneDePieceSoumission(pr);
        // Une ligne qui porte une pièce d'inventaire (soumission) ne se modifie pas ici
        const horsInventaire = (pr.pieces || []).length === 0;
        return (
          <div key={pr.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 0", borderTop: "1px solid var(--border)" }}>
            <span style={{ minWidth: 0 }}>
              {pr.retourDeProblemeId && <span title="Pièce rapportée par le client" style={{ fontSize: 10, fontWeight: 700, color: "var(--success)", border: "1px solid var(--success)", borderRadius: 4, padding: "0 4px", marginRight: 6 }}>↩ RETOUR</span>}
              {pr.retourDeProblemeId ? pr.description : l.nom}
              {pr.retourDeProblemeId && (
                <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)" }}>
                  Facture {pr.retourFacture} · {pr.defectueuse ? "défectueuse, pas mise en inventaire" : `mise en inventaire${pr.retourPiece ? ` : ${pr.retourPiece.numero} — ${pr.retourPiece.nom}` : ""}`}
                </span>
              )}
              {modifiable && horsInventaire && !pr.retourDeProblemeId && l.coutant != null && (
                <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)" }}>Coûtant {argent(l.coutant)} / unité</span>
              )}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              <span>{l.qte} × {argent(l.prix)} = <strong style={{ color: "var(--text)" }}>{argent(l.total)}</strong></span>
              {modifiable && horsInventaire && (
                <>
                  {!pr.retourDeProblemeId && <button onClick={() => ouvrir(pr)} disabled={enCours} title="Modifier" style={boutonIcone}>✏️</button>}
                  <button onClick={() => retirer(pr)} disabled={enCours} title="Retirer" style={boutonIcone}>🗑</button>
                </>
              )}
            </span>
          </div>
        );
      })}

      {modifiable && !formulaire && (
        <button onClick={() => ouvrir(null)} style={{ marginTop: lignes.length > 0 ? 8 : 0, background: "none", border: "1px dashed var(--border)", color: "var(--accent)", fontSize: 12, padding: "7px 10px", borderRadius: 8, cursor: "pointer", width: "100%" }}>
          + Pièce hors inventaire
        </button>
      )}

      {modifiable && formulaire && (
        <form onSubmit={enregistrer} style={{ marginTop: 10, padding: 10, border: "1px solid var(--border)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
            Pièce achetée pour ce bon seulement : facturée sans fiche d&apos;inventaire ni mouvement de stock.
          </p>
          <label style={etiquette}>
            Description
            <input value={formulaire.description} onChange={(e) => setFormulaire({ ...formulaire, description: e.target.value })} autoFocus required style={champ} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            <label style={etiquette}>
              Quantité
              <input inputMode="decimal" value={formulaire.qte} onChange={(e) => setFormulaire({ ...formulaire, qte: e.target.value })} required style={champ} />
            </label>
            <label style={etiquette}>
              Coûtant ($/unité)
              <input inputMode="decimal" value={formulaire.coutant} onChange={(e) => changerCoutant(e.target.value)} placeholder="0,00" style={champ} />
            </label>
            <label style={etiquette}>
              Vendant ($/unité)
              <input inputMode="decimal" value={formulaire.prix} onChange={(e) => setFormulaire({ ...formulaire, prix: e.target.value, prixManuel: e.target.value !== "" })} required placeholder="0,00" style={champ} />
            </label>
          </div>
          {apercu != null && <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0 }}>Total facturé : <strong style={{ color: "var(--text)" }}>{argent(apercu)}</strong> (avant taxes)</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={enCours} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#17150f", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
              {formulaire.id ? "Enregistrer" : "Ajouter au bon"}
            </button>
            <button type="button" onClick={() => { setFormulaire(null); setErreur(""); }} disabled={enCours} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        </form>
      )}
      {erreur && <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{erreur}</p>}
    </div>
  );
}

const etiquette = { display: "flex", flexDirection: "column", gap: 3, fontSize: 10.5, color: "var(--text-muted)" };
const champ = {
  width: "100%", padding: "7px 8px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 13, boxSizing: "border-box",
};
const boutonIcone = { background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 2 };
