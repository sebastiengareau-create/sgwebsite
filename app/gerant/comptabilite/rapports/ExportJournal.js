"use client";

import { useState } from "react";
import { dateAujourdhuiQuebec } from "@/lib/temps";

// Périodes offertes pour l'export du journal, calculées à partir
// d'aujourd'hui (au Québec) → { debut, fin } en AAAA-MM-JJ ; null : tout
const pad = (n) => String(n).padStart(2, "0");
const dernierJour = (an, mois) => new Date(Date.UTC(an, mois, 0)).getUTCDate(); // mois : 1 à 12
const du = (an, mois, jour) => `${an}-${pad(mois)}-${pad(jour)}`;

function periodes(aujourdhui) {
  const [an, mois] = aujourdhui.split("-").map(Number);
  const moisPrec = mois === 1 ? { an: an - 1, mois: 12 } : { an, mois: mois - 1 };
  const trim = Math.floor((mois - 1) / 3); // 0 à 3
  const trimPrec = trim === 0 ? { an: an - 1, t: 3 } : { an, t: trim - 1 };
  return [
    { cle: "mois-dernier", libelle: "Mois dernier", debut: du(moisPrec.an, moisPrec.mois, 1), fin: du(moisPrec.an, moisPrec.mois, dernierJour(moisPrec.an, moisPrec.mois)) },
    { cle: "ce-mois", libelle: "Ce mois-ci", debut: du(an, mois, 1), fin: aujourdhui },
    { cle: "trimestre-dernier", libelle: "Trimestre dernier", debut: du(trimPrec.an, trimPrec.t * 3 + 1, 1), fin: du(trimPrec.an, trimPrec.t * 3 + 3, dernierJour(trimPrec.an, trimPrec.t * 3 + 3)) },
    { cle: "annee-derniere", libelle: `Année ${an - 1}`, debut: du(an - 1, 1, 1), fin: du(an - 1, 12, 31) },
    { cle: "cette-annee", libelle: `Année ${an} à ce jour`, debut: du(an, 1, 1), fin: aujourdhui },
    { cle: "tout", libelle: "Tout le journal", debut: "", fin: "" },
    { cle: "dates", libelle: "Dates précises…", debut: null, fin: null },
  ];
}

const DATE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const lisible = (d) => DATE.format(new Date(`${d}T12:00:00Z`));

// Export du journal général en CSV pour un comptable externe, pour la
// période choisie (/api/comptabilite/export?debut=…&fin=…)
export default function ExportJournal() {
  const [aujourdhui] = useState(dateAujourdhuiQuebec);
  const choix = periodes(aujourdhui);
  const [cle, setCle] = useState("mois-dernier");
  const [debutPrecis, setDebutPrecis] = useState(choix[0].debut);
  const [finPrecise, setFinPrecise] = useState(choix[0].fin);
  const periode = choix.find((c) => c.cle === cle);
  const debut = cle === "dates" ? debutPrecis : periode.debut;
  const fin = cle === "dates" ? finPrecise : periode.fin;
  const invalide = cle === "dates" && (!debut || !fin || debut > fin);
  const lien = `/api/comptabilite/export${debut || fin ? `?${new URLSearchParams({ ...(debut && { debut }), ...(fin && { fin }) })}` : ""}`;

  return (
    <div>
      <div role="radiogroup" aria-label="Période à exporter" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {choix.map((c) => (
          <button
            key={c.cle} type="button" role="radio" aria-checked={cle === c.cle} onClick={() => setCle(c.cle)}
            style={{
              fontSize: 12.5, fontWeight: 700, padding: "7px 11px", borderRadius: 999, cursor: "pointer",
              border: `1px solid ${cle === c.cle ? "var(--text)" : "var(--border)"}`,
              background: cle === c.cle ? "var(--text)" : "var(--surface)", color: cle === c.cle ? "var(--bg)" : "var(--text)",
            }}
          >
            {c.libelle}
          </button>
        ))}
      </div>
      {cle === "dates" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Du
            <input type="date" value={debutPrecis} max={aujourdhui} onChange={(e) => setDebutPrecis(e.target.value)} className="champ" style={{ display: "block", fontSize: 14, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Au
            <input type="date" value={finPrecise} onChange={(e) => setFinPrecise(e.target.value)} className="champ" style={{ display: "block", fontSize: 14, marginTop: 4 }} />
          </label>
        </div>
      )}
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
        {invalide
          ? "Choisis une date de début et une date de fin (le début avant la fin)."
          : debut || fin
            ? `Écritures du ${lisible(debut)} au ${lisible(fin)}, avec les comptes, débits, crédits et qui les a créées.`
            : "Toutes les écritures, avec les comptes, débits, crédits et qui les a créées."}
      </p>
      <a
        href={invalide ? undefined : lien}
        aria-disabled={invalide}
        style={{
          display: "block", textAlign: "center", padding: 13, borderRadius: 12, textDecoration: "none", fontSize: 15, fontWeight: 700,
          background: "var(--accent)", color: "#221f18", opacity: invalide ? 0.5 : 1, pointerEvents: invalide ? "none" : "auto",
        }}
      >
        Télécharger le journal (.csv)
      </a>
    </div>
  );
}
