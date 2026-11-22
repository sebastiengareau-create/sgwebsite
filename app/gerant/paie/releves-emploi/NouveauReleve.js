"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Choix de l'employé → relevé préparé à partir de ses paies, puis ouvert
export default function NouveauReleve({ employes }) {
  const router = useRouter();
  const [employeId, setEmployeId] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function creer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    const res = await fetch("/api/paie/releves-emploi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeId }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setEnCours(false);
      setErreur(data?.erreur || "Le relevé n'a pas pu être créé.");
      return;
    }
    router.push(`/gerant/paie/releves-emploi/${data.id}`);
  }

  if (employes.length === 0) return <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun employé n&apos;a encore de paie versée.</p>;
  return (
    <form onSubmit={creer} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select value={employeId} onChange={(e) => setEmployeId(e.target.value)} aria-label="Employé" className="champ" style={{ flex: "1 1 220px", fontSize: 14 }}>
        <option value="">Choisir l&apos;employé…</option>
        {employes.map((e) => <option key={e.id} value={e.id}>{e.nom}{e.actif ? "" : " (inactif)"}</option>)}
      </select>
      <button type="submit" disabled={!employeId || enCours} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}>
        {enCours ? "Préparation…" : "Préparer le relevé"}
      </button>
      {erreur && <p role="alert" style={{ flexBasis: "100%", fontSize: 12.5, color: "var(--danger)", margin: 0 }}>{erreur}</p>}
    </form>
  );
}
