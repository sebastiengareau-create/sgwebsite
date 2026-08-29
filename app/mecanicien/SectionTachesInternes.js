"use client";

import { useState } from "react";
import TacheInternePoincon from "./TacheInternePoincon";

function fmtHeures(h) {
  const heures = Math.floor(h);
  const min = Math.round((h - heures) * 60);
  return `${heures}h${String(min).padStart(2, "0")}`;
}
function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}

export default function SectionTachesInternes({ taches, monId }) {
  const [ouvert, setOuvert] = useState(false);
  const enCoursCompte = taches.filter((t) => t.entreesTemps.some((e) => e.employeId === monId && !e.fin)).length;

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        onClick={() => setOuvert((v) => !v)}
        className="bouton-3d-sombre"
        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>🛠️ Tâche interne {enCoursCompte > 0 && <span style={{ color: "var(--accent)" }}>· {enCoursCompte} en cours</span>}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ouvert ? "▲" : "▼"}</span>
      </button>

      {ouvert && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {taches.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucune tâche interne configurée — le gérant peut en ajouter dans Paramètres.</p>
          )}
          {taches.map((t) => {
            const monEntree = t.entreesTemps.find((e) => e.employeId === monId && !e.fin);
            const finies = t.entreesTemps.filter((e) => e.employeId === monId && e.fin);
            const totalFini = finies.reduce((s, e) => s + dureeHeures(e.debut, e.fin), 0);
            return (
              <div key={t.id} style={{ background: "var(--bg)", border: monEntree ? "1px solid var(--accent)" : "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 13 }}>{t.nom}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {totalFini > 0 ? `Ton temps : ${fmtHeures(totalFini)}` : "Non commencé"}
                  </span>
                  <TacheInternePoincon tacheInterneId={t.id} actif={!!monEntree} debut={monEntree?.debut} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
