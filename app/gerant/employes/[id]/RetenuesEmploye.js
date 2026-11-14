"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TitrePanneau, TEINTES, stylePanneau } from "../../../components/StyleSection";
import { argent } from "@/lib/format";

const TYPES = [
  ["REER", "REER ou régime de retraite", "réduit l'impôt retenu"],
  ["APRES_IMPOT", "Assurance collective ou autre", "après impôt"],
];

// Retenues propres à l'employé, appliquées à chaque paie régulière
// (lib/retenuesPaie.js). Enregistrées tout de suite, hors du formulaire de la fiche.
export default function RetenuesEmploye({ employeId, retenues }) {
  const router = useRouter();
  const [libelle, setLibelle] = useState("");
  const [type, setType] = useState("REER");
  const [montant, setMontant] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function appeler(methode, chemin, corps) {
    setErreur("");
    setEnCours(true);
    const res = await fetch(chemin, { method: methode, headers: { "Content-Type": "application/json" }, body: corps ? JSON.stringify(corps) : undefined });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function ajouter(e) {
    e.preventDefault();
    if (await appeler("POST", `/api/utilisateurs/${employeId}/retenues`, { libelle, type, montant })) {
      setLibelle("");
      setMontant("");
    }
  }

  return (
    <div style={stylePanneau}>
      <TitrePanneau
        icone="calculatrice" teinte={TEINTES.bleu} titre="Retenues sur la paie"
        sousTitre="REER, assurance collective, remboursement… retenus à chaque paie régulière, en plus des retenues obligatoires."
      />
      {retenues.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" }}>Aucune retenue.</p>}
      {retenues.map((r, i) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{r.libelle}</span>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)" }}>{r.type === "REER" ? "Régime de retraite — réduit l'impôt retenu" : "Après impôt"}</span>
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(r.montant)} / paie</span>
          <button
            type="button" disabled={enCours} title="Retirer cette retenue"
            onClick={() => window.confirm(`Retirer la retenue « ${r.libelle} » ? Les paies déjà calculées ne changent pas.`) && appeler("DELETE", `/api/utilisateurs/${employeId}/retenues/${r.id}`)}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 9px", cursor: "pointer", color: "var(--danger)", fontSize: 12, fontWeight: 700 }}
          >
            Retirer
          </button>
        </div>
      ))}

      <form onSubmit={ajouter} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <label className="etiquette">Nouvelle retenue</label>
        <input type="text" maxLength={60} value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. REER, Assurance collective" className="champ" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <select value={type} onChange={(e) => setType(e.target.value)} className="champ">
            {TYPES.map(([code, titre, detail]) => <option key={code} value={code}>{titre} ({detail})</option>)}
          </select>
          <input type="number" min={0} step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Montant par paie ($)" className="champ champ-sans-fleches" />
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "-2px 0 10px", lineHeight: 1.45 }}>
          La part de l'employeur d'une assurance collective (avantage imposable) n'est pas calculée par le logiciel.
        </p>
        {erreur && <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--danger)", margin: "0 0 10px" }}>{erreur}</p>}
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 10, fontWeight: 800, fontSize: 13 }}>
          Ajouter la retenue
        </button>
      </form>
    </div>
  );
}
