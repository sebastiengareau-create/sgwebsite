"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dateAujourdhuiQuebec } from "@/lib/temps";

export default function NouveauLotClient({ employes }) {
  const router = useRouter();
  const [periodeDebut, setPeriodeDebut] = useState("");
  const [periodeFin, setPeriodeFin] = useState(dateAujourdhuiQuebec());
  const [dateVersement, setDateVersement] = useState(dateAujourdhuiQuebec());
  const [typePaie, setTypePaie] = useState("REGULIERE");
  const [selectionnes, setSelectionnes] = useState(() => new Set(employes.map((e) => e.id)));
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  function basculer(id) {
    setSelectionnes((prev) => {
      const nouveau = new Set(prev);
      if (nouveau.has(id)) nouveau.delete(id); else nouveau.add(id);
      return nouveau;
    });
  }

  async function calculerLot(e) {
    e.preventDefault();
    setErreur("");
    if (!periodeDebut || !periodeFin) {
      setErreur("Choisis une période complète.");
      return;
    }
    if (selectionnes.size === 0) {
      setErreur("Sélectionne au moins un employé.");
      return;
    }
    setEnCours(true);
    const res = await fetch("/api/paie/lots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typePaie,
        periodeDebut: `${periodeDebut}T00:00:00`,
        periodeFin: `${periodeFin}T23:59:59`,
        dateVersement: `${dateVersement}T00:00:00`,
        employeIds: Array.from(selectionnes),
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors du calcul du lot.");
      return;
    }
    const data = await res.json();
    router.push(`/gerant/paie/lots/${data.id}`);
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/paie" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour</Link>
      <h1 style={{ fontSize: 20, margin: "8px 0 16px" }}>Nouveau lot de paie</h1>

      <form onSubmit={calculerLot} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <label style={labelStyle}>Type de paie</label>
        <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 3, marginBottom: 10 }}>
          <button type="button" onClick={() => setTypePaie("REGULIERE")} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "7px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: typePaie === "REGULIERE" ? "var(--accent)" : "none", color: typePaie === "REGULIERE" ? "#17150f" : "var(--text-muted)" }}>
            Régulière
          </button>
          <button type="button" onClick={() => setTypePaie("VACANCES")} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "7px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: typePaie === "VACANCES" ? "var(--accent)" : "none", color: typePaie === "VACANCES" ? "#17150f" : "var(--text-muted)" }}>
            🏖️ Vacances
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Début</label>
            <input type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} style={champStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Fin</label>
            <input type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} style={champStyle} />
          </div>
        </div>

        <label style={labelStyle}>Date du versement</label>
        <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: -2, marginBottom: 6 }}>
          La même pour tout le lot, même si un employé est ajouté après coup.
        </p>
        <input type="date" value={dateVersement} onChange={(e) => setDateVersement(e.target.value)} style={champStyle} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Employés ({selectionnes.size}/{employes.length})</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setSelectionnes(new Set(employes.map((e) => e.id)))} style={boutonLien}>Tous</button>
            <button type="button" onClick={() => setSelectionnes(new Set())} style={boutonLien}>Aucun</button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12, maxHeight: 280, overflowY: "auto" }}>
          {employes.map((emp) => (
            <label key={emp.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", borderRadius: 8, padding: "8px 10px", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={selectionnes.has(emp.id)} onChange={() => basculer(emp.id)} />
              <span>{emp.nom}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{emp.typeRemuneration === "SALAIRE" ? "salarié" : "à l'heure"}</span>
            </label>
          ))}
          {employes.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun employé actif.</p>}
        </div>

        {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 8 }}>{erreur}</p>}
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 12, borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
          {enCours ? "Calcul…" : "Calculer le lot"}
        </button>
      </form>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginTop: 8, marginBottom: 3 };
const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 6, boxSizing: "border-box",
};
const boutonLien = { fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" };
