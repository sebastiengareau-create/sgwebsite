"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const STATUT_INFO = {
  OUVERTE: { icone: "🟢", label: "Ouverte", couleur: "var(--success)" },
  VERROUILLEE: { icone: "🟡", label: "Verrouillée", couleur: "#C9A227" },
  FERMEE: { icone: "🔴", label: "Fermée", couleur: "var(--danger)" },
};

const TRIMESTRES = [
  { label: "T1 (jan-mars)", mois: [1, 2, 3] },
  { label: "T2 (avr-juin)", mois: [4, 5, 6] },
  { label: "T3 (juil-sept)", mois: [7, 8, 9] },
  { label: "T4 (oct-déc)", mois: [10, 11, 12] },
];

export default function FermetureClient({ periodes, annee }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [rapport, setRapport] = useState("");

  async function fermerPlage(moisListe, label) {
    if (!window.confirm(`Fermer ${label} ${annee} ? Chaque mois sera fermé un à la suite de l'autre.`)) return;
    setEnCours(true);
    setRapport("");
    const resultats = [];
    for (const mois of moisListe) {
      const res = await fetch(`/api/comptabilite/periodes/${annee}/${mois}/fermer`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      resultats.push(`${NOMS_MOIS[mois - 1]} : ${res.ok ? "✅ Fermé" : `❌ ${data.erreur || "Erreur"}`}`);
    }
    setEnCours(false);
    setRapport(resultats.join("\n"));
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20 }}>Fermeture de période</h1>
        <Link href="/gerant/comptabilite/fermeture/historique" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 8 }}>
          📜 Journal
        </Link>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        Ferme les livres d'un mois pour empêcher toute modification comptable accidentelle une fois vérifié.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <Link href={`/gerant/comptabilite/fermeture?annee=${annee - 1}`} className="bouton-3d-sombre" style={{ padding: "6px 12px", borderRadius: 8, textDecoration: "none", fontSize: 13 }}>◀</Link>
        <span style={{ fontSize: 16, fontWeight: 700, flex: 1, textAlign: "center" }}>{annee}</span>
        <Link href={`/gerant/comptabilite/fermeture?annee=${annee + 1}`} className="bouton-3d-sombre" style={{ padding: "6px 12px", borderRadius: 8, textDecoration: "none", fontSize: 13 }}>▶</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {periodes.map((p) => {
          const info = STATUT_INFO[p.statut];
          return (
            <Link
              key={p.mois}
              href={`/gerant/comptabilite/fermeture/${annee}/${p.mois}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div style={{ background: "var(--surface)", border: `1px solid ${info.couleur}`, borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{NOMS_MOIS[p.mois - 1]}</span>
                <span style={{ fontSize: 12 }}>{info.icone} {info.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Fermer une plage</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        {TRIMESTRES.map((t) => (
          <button
            key={t.label}
            onClick={() => fermerPlage(t.mois, t.label)}
            disabled={enCours}
            className="bouton-3d-sombre"
            style={{ padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700 }}
          >
            Fermer {t.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => fermerPlage(Array.from({ length: 12 }, (_, i) => i + 1), `l'année`)}
        disabled={enCours}
        className="bouton-3d-sombre"
        style={{ width: "100%", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, marginBottom: 16 }}
      >
        Fermer l'année {annee} au complet
      </button>

      {rapport && (
        <pre style={{ fontSize: 11.5, whiteSpace: "pre-wrap", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
          {rapport}
        </pre>
      )}
    </div>
  );
}
