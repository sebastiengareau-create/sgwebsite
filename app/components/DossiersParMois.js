"use client";

import { useState } from "react";
import { regrouperParMois, libelleMois } from "@/lib/regroupementDates";

// Un dossier repliable par mois (du plus récent au plus ancien) — pour les
// bons facturés et les factures des mois précédents, le mois en cours restant
// affiché un par un. `ouvert` (recherche en cours) ouvre tout pour montrer
// les résultats. `resume(elements)` ajoute un texte au titre (ex. un total).
export default function DossiersParMois({ elements, obtenirDate, carte, ouvert, compact, couleur = "#6FA96B", resume }) {
  return regrouperParMois(elements, obtenirDate).map((m) => (
    <Dossier
      key={`${m.cle}-${!!ouvert}`} open={!!ouvert} libelle={m.libelle} nombre={m.elements.length}
      resume={resume && resume(m.elements)} compact={compact} couleur={couleur}
    >
      {m.elements.map(carte)}
    </Dossier>
  ));
}

// Même dossiers, mais dont le contenu n'est pas encore chargé : `mois` ne
// donne que [{ cle, nombre }], et `charger(cle)` va chercher les éléments du
// mois à la première ouverture du dossier.
export function DossiersParMoisACharger({ mois, charger, carte, compact, couleur = "#6FA96B" }) {
  return mois.map((m) => (
    <DossierACharger key={m.cle} cleMois={m.cle} nombre={m.nombre} charger={charger} carte={carte} compact={compact} couleur={couleur} />
  ));
}

function DossierACharger({ cleMois, nombre, charger, carte, compact, couleur }) {
  const [elements, setElements] = useState(null);
  const [erreur, setErreur] = useState(false);

  function ouvrir(e) {
    if (!e.currentTarget.open || elements) return;
    setErreur(false);
    charger(cleMois).then(setElements, () => setErreur(true));
  }

  return (
    <Dossier libelle={libelleMois(cleMois)} nombre={nombre} compact={compact} couleur={couleur} onToggle={ouvrir}>
      {elements ? elements.map(carte) : (
        <p style={{ fontSize: 12, color: erreur ? "var(--danger)" : "var(--text-muted)", textAlign: "center", padding: "6px 0", margin: 0 }}>
          {erreur ? "Chargement impossible — referme et rouvre le dossier pour réessayer." : "Chargement…"}
        </p>
      )}
    </Dossier>
  );
}

function Dossier({ libelle, nombre, resume, compact, couleur, open, onToggle, children }) {
  return (
    <details open={open} onToggle={onToggle} className="dossier-mois" style={{ marginTop: compact ? 2 : 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: compact ? "6px 8px" : "8px 10px" }}>
      <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6, userSelect: "none", fontSize: compact ? 12 : 13, fontWeight: 700 }}>
        <span className="chevron-dossier" style={{ color: "var(--text-muted)", fontSize: 10 }}>▶</span>
        📁 {libelle}
        {resume && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>· {resume}</span>}
        <span style={{ marginLeft: "auto", fontSize: 11, color: couleur, background: `${couleur}22`, borderRadius: 999, padding: "1px 8px" }}>{nombre}</span>
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 8, marginTop: 8 }}>
        {children}
      </div>
    </details>
  );
}
