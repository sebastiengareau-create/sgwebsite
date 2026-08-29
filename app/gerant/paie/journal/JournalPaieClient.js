"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function JournalPaieClient({ paies, sommaireEmployes, totaux, debutStr, finStr }) {
  const router = useRouter();
  const [debut, setDebut] = useState(debutStr);
  const [fin, setFin] = useState(finStr);
  const [vue, setVue] = useState("sommaire"); // "sommaire" | "journal"

  function changerPeriode(e) {
    e.preventDefault();
    router.push(`/gerant/paie/journal?debut=${debut}&fin=${fin}`);
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/paie" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Paie</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 12 }}>📖 Journal de paie</h1>

      <form onSubmit={changerPeriode} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} style={champStyle} />
        <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} style={champStyle} />
        <button type="submit" className="bouton-3d-sombre" style={{ padding: "0 14px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          Filtrer
        </button>
      </form>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{totaux.brut.toFixed(2)} $</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Total brut</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{totaux.net.toFixed(2)} $</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Total net versé</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--danger)" }}>{(totaux.deductions + totaux.chargesEmployeur).toFixed(2)} $</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Retenues + charges employeur</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{totaux.vacancesAccumulees.toFixed(2)} $</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Vacances accumulées</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{totaux.vacancesVersees.toFixed(2)} $</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Vacances versées</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 3, marginBottom: 16 }}>
        <button onClick={() => setVue("sommaire")} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "7px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: vue === "sommaire" ? "var(--accent)" : "none", color: vue === "sommaire" ? "#17150f" : "var(--text-muted)" }}>
          Sommaire par employé
        </button>
        <button onClick={() => setVue("journal")} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "7px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: vue === "journal" ? "var(--accent)" : "none", color: vue === "journal" ? "#17150f" : "var(--text-muted)" }}>
          Journal (chaque paie)
        </button>
      </div>

      {vue === "sommaire" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sommaireEmployes.map(([nom, d]) => (
            <div key={nom} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{nom}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.nbPaies} paie{d.nbPaies > 1 ? "s" : ""}</span>
              </div>
              <Ligne label="Brut" valeur={d.brut} />
              <Ligne label="Retenues employé" valeur={d.deductions} negatif />
              <Ligne label="Net versé" valeur={d.net} gras />
              <Ligne label="Charges employeur" valeur={d.chargesEmployeur} />
              <Ligne label="Vacances accumulées" valeur={d.vacancesAccumulees} />
              {d.vacancesVersees > 0 && <Ligne label="Vacances versées" valeur={d.vacancesVersees} negatif={false} accent />}
            </div>
          ))}
          {sommaireEmployes.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune paie sur cette période.</p>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {paies.map((p) => (
            <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.employe.nom} {p.typePaie === "VACANCES" && <span style={{ fontSize: 10.5, color: "var(--accent)", fontWeight: 400 }}>🏖️ vacances</span>}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                  {new Date(p.periodeDebut).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} → {new Date(p.periodeFin).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{p.salaireNet.toFixed(2)} $</div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>brut {p.salaireBrut.toFixed(2)} $</div>
              </div>
            </div>
          ))}
          {paies.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune paie sur cette période.</p>}
        </div>
      )}
    </div>
  );
}

function Ligne({ label, valeur, gras, negatif, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: gras ? 13 : 12, fontWeight: gras ? 700 : accent ? 600 : 400, color: accent ? "var(--accent)" : gras ? "var(--text)" : "var(--text-muted)", marginBottom: 3 }}>
      <span>{label}</span>
      <span>{negatif ? "−" : ""}{valeur.toFixed(2)} $</span>
    </div>
  );
}

const champStyle = {
  flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 13,
};
