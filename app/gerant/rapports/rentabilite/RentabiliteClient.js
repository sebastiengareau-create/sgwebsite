"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { argent, nombre } from "@/lib/format";

function fmtHeures(h) {
  const heures = Math.floor(h);
  const min = Math.round((h - heures) * 60);
  return `${heures}h${String(min).padStart(2, "0")}`;
}

export default function RentabiliteClient({ donnees, debutStr, finStr }) {
  const router = useRouter();
  const [debut, setDebut] = useState(debutStr);
  const [fin, setFin] = useState(finStr);

  function changerPeriode(e) {
    e.preventDefault();
    router.push(`/gerant/rapports/rentabilite?debut=${debut}&fin=${fin}`);
  }

  const totalRevenu = donnees.reduce((s, d) => s + d.revenuGenere, 0);
  const totalCout = donnees.reduce((s, d) => s + d.coutReel, 0);
  const totalMarge = totalRevenu - totalCout;
  const totalHeures = donnees.reduce((s, d) => s + d.heuresPayees, 0);
  const totalFacturables = donnees.reduce((s, d) => s + d.heuresFacturables, 0);
  const totalInternes = donnees.reduce((s, d) => s + d.heuresInternes, 0);
  const totalCoutInternes = donnees.reduce((s, d) => s + d.coutInternes, 0);

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>📈 Rentabilité par employé</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        Ce que chaque employé a vraiment généré comme revenu, contre son coût réel pour le garage.
      </p>

      <form onSubmit={changerPeriode} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input type="date" max="9999-12-31" value={debut} onChange={(e) => setDebut(e.target.value)} style={champStyle} />
        <input type="date" max="9999-12-31" value={fin} onChange={(e) => setFin(e.target.value)} style={champStyle} />
        <button type="submit" className="bouton-3d-sombre" style={{ padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          Filtrer
        </button>
      </form>

      {/* Résumé global */}
      <div className="carte" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--success)" }}>{argent(totalRevenu)}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Revenu généré</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--danger)" }}>{argent(totalCout)}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Coût réel</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: totalMarge >= 0 ? "var(--accent)" : "var(--danger)" }}>{argent(totalMarge)}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Marge totale</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtHeures(totalFacturables)} <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>/ {fmtHeures(totalHeures)}</span></div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Heures facturables / réelles</div>
          </div>
        </div>
        {totalInternes > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5, color: "var(--text-muted)", marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
            <span>🛠️ Tâches internes ({fmtHeures(totalInternes)}) — compris dans le coût réel</span>
            <span style={{ fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{argent(totalCoutInternes)}</span>
          </div>
        )}
        <TauxRentabilite cout={totalCout} revenu={totalRevenu} libelle="Taux de rentabilité de l'équipe" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {donnees.map((d) => (
          <CarteEmploye key={d.employe.id} d={d} />
        ))}
        {donnees.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", marginTop: 20 }}>
            Aucune heure travaillée sur cette période.
          </p>
        )}
      </div>
    </div>
  );
}

function CarteEmploye({ d }) {
  const max = Math.max(d.revenuGenere, d.coutReel, 1);
  const largeurRevenu = Math.max(2, (d.revenuGenere / max) * 100);
  const largeurCout = Math.max(2, (d.coutReel / max) * 100);
  const margePct = d.revenuGenere > 0 ? (d.marge / d.revenuGenere) * 100 : null;

  return (
    <div className="carte">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{d.employe.nom}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: d.marge >= 0 ? "var(--success)" : "var(--danger)" }}>
          {d.marge >= 0 ? "+" : ""}{argent(d.marge)}
        </span>
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
          <span style={{ color: "var(--text-muted)" }}>Revenu généré</span>
          <span style={{ fontWeight: 600 }}>{argent(d.revenuGenere)}</span>
        </div>
        <div style={{ height: 8, background: "var(--bg)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${largeurRevenu}%`, height: "100%", background: "var(--success)", borderRadius: 999 }} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
          <span style={{ color: "var(--text-muted)" }}>Coût réel ({fmtHeures(d.heuresPayees)} × {argent(d.tauxCout)}/h)</span>
          <span style={{ fontWeight: 600 }}>{argent(d.coutReel)}</span>
        </div>
        <div style={{ height: 8, background: "var(--bg)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${largeurCout}%`, height: "100%", background: "var(--danger)", borderRadius: 999 }} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
        <span>{fmtHeures(d.heuresFacturables)} facturables sur {fmtHeures(d.heuresPayees)} réelles</span>
        {margePct !== null && <span>Marge {nombre(margePct, 0)} %</span>}
      </div>

      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>
        {fmtHeures(d.heuresTotales)} poinçonnées (heures réelles = horaire des jours poinçonnés, ou heures entrées dans Productivité)
      </div>

      {d.heuresInternes > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>
          <span>dont tâches internes ({fmtHeures(d.heuresInternes)} × {argent(d.tauxCout)}/h)</span>
          <span>{argent(d.coutInternes)}</span>
        </div>
      )}

      <TauxRentabilite cout={d.coutReel} revenu={d.revenuGenere} libelle="Taux de rentabilité" />

      {d.heuresEstimees > 0 && (
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>
          dont {fmtHeures(d.heuresEstimees)} estimées (bon pas encore facturé)
        </div>
      )}
    </div>
  );
}

// Revenu généré ÷ coût réel : au-dessus de 100 %, les employés rapportent
// plus qu'ils ne coûtent (rentable) ; en dessous, ils coûtent plus qu'ils
// ne rapportent (perte).
function TauxRentabilite({ cout, revenu, libelle }) {
  if (cout <= 0) {
    return (
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 8 }}>
        {libelle} : — <span style={{ fontStyle: "italic" }}>(aucun coût réel sur la période)</span>
      </div>
    );
  }
  const taux = (revenu / cout) * 100;
  const couleur = taux >= 125 ? "var(--success)" : taux >= 100 ? "#C9A227" : "var(--danger)";
  return (
    <div
      title="Revenu généré ÷ coût réel — au-dessus de 100 % : rentable ; en dessous : perte"
      style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)" }}
    >
      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
        {libelle}
        <span style={{ display: "block", fontSize: 10.5 }}>{argent(revenu)} de revenu généré pour {argent(cout)} de coût réel</span>
      </span>
      <span style={{ fontSize: 17, fontWeight: 800, color: couleur, whiteSpace: "nowrap" }}>{Math.round(taux)} %</span>
    </div>
  );
}

const champStyle = {
  flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 13,
};
