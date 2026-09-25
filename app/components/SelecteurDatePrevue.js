"use client";

import { cleJourQuebec, decalerCle, libelleJour } from "@/lib/regroupementDates";

// Choix de la journée (et de l'heure) où un bon est planifié. La valeur est
// "YYYY-MM-DDTHH:MM" en heure du Québec, comme un <input type="datetime-local">.
export default function SelecteurDatePrevue({ valeur, onChange }) {
  const aujourdHui = cleJourQuebec(new Date());
  const [date, heure] = (valeur || `${aujourdHui}T08:00`).split("T");
  const raccourcis = [
    { label: "Aujourd'hui", cle: aujourdHui },
    { label: "Demain", cle: decalerCle(aujourdHui, 1) },
    { label: "Dans 1 semaine", cle: decalerCle(aujourdHui, 7) },
  ];
  const aVenir = date > aujourdHui;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {raccourcis.map((r) => (
          <button
            key={r.label} type="button" onClick={() => onChange(`${r.cle}T${heure}`)}
            style={{
              fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
              background: date === r.cle ? "var(--accent)" : "var(--surface)",
              color: date === r.cle ? "#17150f" : "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="date" value={date} required
          onChange={(e) => e.target.value && onChange(`${e.target.value}T${heure}`)}
          style={{ ...champ, flex: 1 }}
        />
        <input
          type="time" value={heure} required
          onChange={(e) => e.target.value && onChange(`${date}T${e.target.value}`)}
          style={{ ...champ, width: 110 }}
        />
      </div>
      <div style={{ fontSize: 11, marginTop: 4, color: aVenir ? "var(--accent)" : "var(--text-muted)" }}>
        {aVenir
          ? `📅 Planifié ${libelleJour(date, aujourdHui).toLowerCase()} — le bon reste en attente sous cette journée.`
          : date < aujourdHui ? `Date passée : ${libelleJour(date, aujourdHui).toLowerCase()}.` : "Le bon est prévu pour aujourd'hui."}
      </div>
    </div>
  );
}

const champ = {
  padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 13, boxSizing: "border-box", colorScheme: "dark light",
};
