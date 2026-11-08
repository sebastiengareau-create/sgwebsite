"use client";

import { useState } from "react";
import TacheInternePoincon from "./TacheInternePoincon";
import { Icone, TEINTES, Pastille, stylePanneau } from "../components/StyleSection";

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
    <div style={{ ...stylePanneau, padding: 0, overflow: "hidden" }}>
      <button
        type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: 16, background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "var(--text)", fontFamily: "inherit" }}
      >
        <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: TEINTES.bleu.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom="outils" taille={20} couleur={TEINTES.bleu.couleur} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 17, fontWeight: 800 }}>Tâches internes</span>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)" }}>Ménage, formation, entretien du garage…</span>
        </span>
        {enCoursCompte > 0 && <Pastille couleur="var(--success)" fond="var(--success-fond)">{enCoursCompte} en cours</Pastille>}
        <span style={{ display: "inline-flex", transform: ouvert ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
          <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
        </span>
      </button>

      {ouvert && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {taches.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucune tâche interne configurée — le gérant peut en ajouter dans Paramètres.</p>
          )}
          {taches.map((t) => {
            const monEntree = t.entreesTemps.find((e) => e.employeId === monId && !e.fin);
            const finies = t.entreesTemps.filter((e) => e.employeId === monId && e.fin);
            const totalFini = finies.reduce((s, e) => s + dureeHeures(e.debut, e.fin), 0);
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: monEntree ? "var(--success-fond)" : "var(--bg)", border: `1px solid ${monEntree ? "var(--success)" : "var(--border)"}`, borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{t.nom}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{totalFini > 0 ? `Ton temps : ${fmtHeures(totalFini)}` : "Non commencé"}</div>
                </div>
                <TacheInternePoincon tacheInterneId={t.id} actif={!!monEntree} debut={monEntree?.debut} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
