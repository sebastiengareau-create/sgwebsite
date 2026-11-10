"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { argent } from "@/lib/format";
import Link from "next/link";
import BandeauSection from "../../../components/BandeauSection";
import { CarteChiffre, GrilleChiffres, TitreGroupe } from "../../../components/StyleSection";

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

  const tauxEquipe = totalRevenu > 0 ? (totalMarge / totalRevenu) * 100 : null;

  return (
    <div className="conteneur-page">
      <Link href="/gerant/rapports" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux rapports</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="📊" titre="Rentabilité par employé" sousTitre="Ce que chaque employé a vraiment généré comme revenu, contre son coût réel pour le garage." />
      </div>

      <form onSubmit={changerPeriode} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 18, padding: 6, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
        <label style={champPeriode}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>Du</span>
          <input type="date" max="9999-12-31" value={debut} onChange={(e) => setDebut(e.target.value)} style={champStyle} />
        </label>
        <label style={champPeriode}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>Au</span>
          <input type="date" max="9999-12-31" value={fin} onChange={(e) => setFin(e.target.value)} style={champStyle} />
        </label>
        <button type="submit" style={{ flex: "1 1 100px", padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, border: "none", background: "var(--accent)", color: "#221f18", cursor: "pointer" }}>
          Filtrer
        </button>
      </form>

      <GrilleChiffres>
        <CarteChiffre
          titre="Revenu généré" montant={argent(totalRevenu)} couleur="var(--success)" teinte="var(--success)"
          note={`${fmtHeures(totalFacturables)} facturables`}
        />
        <CarteChiffre
          titre="Coût réel" montant={argent(totalCout)} couleur="var(--danger)" teinte="var(--danger)"
          note={totalInternes > 0 ? `${fmtHeures(totalHeures)} réelles · dont internes ${argent(totalCoutInternes)}` : `${fmtHeures(totalHeures)} réelles`}
        />
        <CarteChiffre
          titre="Marge totale" montant={argent(totalMarge)}
          couleur={totalMarge >= 0 ? "var(--success)" : "var(--danger)"} teinte={totalMarge >= 0 ? "var(--success)" : "var(--danger)"}
          note="Revenu généré − coût réel"
        />
        <CarteChiffre
          titre="Taux de rentabilité" montant={tauxEquipe === null ? "—" : `${Math.round(tauxEquipe)} %`}
          couleur={couleurTaux(tauxEquipe)} teinte={couleurTaux(tauxEquipe)}
          note="Marge ÷ revenu · rentable au-dessus de 0 %"
        />
      </GrilleChiffres>

      <TitreGroupe couleur="var(--accent)">Par employé</TitreGroupe>
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

function couleurTaux(taux) {
  if (taux === null) return "var(--text-muted)";
  return taux >= 20 ? "var(--success)" : taux >= 0 ? "var(--avertissement)" : "var(--danger)";
}

function CarteEmploye({ d }) {
  const max = Math.max(d.revenuGenere, d.coutReel, 1);
  const largeurRevenu = Math.max(2, (d.revenuGenere / max) * 100);
  const largeurCout = Math.max(2, (d.coutReel / max) * 100);
  const margePct = d.revenuGenere > 0 ? (d.marge / d.revenuGenere) * 100 : null;

  return (
    <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px 14px 20px" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: couleurTaux(margePct) }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", background: "rgba(232,163,61,0.16)", color: "var(--accent-ombre)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800 }}>
            {d.employe.nom.charAt(0).toUpperCase()}
          </span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{d.employe.nom}</span>
        </span>
        <span style={{ textAlign: "right" }}>
          <span style={{ display: "block", fontSize: 20, fontWeight: 800, color: d.marge >= 0 ? "var(--success)" : "var(--danger)", fontVariantNumeric: "tabular-nums" }}>
            {d.marge >= 0 ? "+" : ""}{argent(d.marge)}
          </span>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>marge</span>
        </span>
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: "var(--text-muted)" }}>Revenu généré</span>
          <span style={{ fontWeight: 600 }}>{argent(d.revenuGenere)}</span>
        </div>
        <div style={{ height: 10, background: "var(--bg)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${largeurRevenu}%`, height: "100%", background: "var(--success)", borderRadius: 999 }} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: "var(--text-muted)" }}>Coût réel ({fmtHeures(d.heuresPayees)} × {argent(d.tauxCout)}/h)</span>
          <span style={{ fontWeight: 600 }}>{argent(d.coutReel)}</span>
        </div>
        <div style={{ height: 10, background: "var(--bg)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${largeurCout}%`, height: "100%", background: "var(--danger)", borderRadius: 999 }} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "var(--text-muted)", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
        <span>{fmtHeures(d.heuresFacturables)} facturables sur {fmtHeures(d.heuresPayees)} réelles</span>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
        {fmtHeures(d.heuresTotales)} poinçonnées (heures réelles = horaire des jours poinçonnés, ou heures entrées dans Productivité)
      </div>

      {d.heuresInternes > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
          <span>dont tâches internes ({fmtHeures(d.heuresInternes)} × {argent(d.tauxCout)}/h)</span>
          <span>{argent(d.coutInternes)}</span>
        </div>
      )}

      <TauxRentabilite marge={d.marge} revenu={d.revenuGenere} libelle="Taux de rentabilité" />

      {d.heuresEstimees > 0 && (
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>
          dont {fmtHeures(d.heuresEstimees)} estimées (bon pas encore facturé)
        </div>
      )}
    </div>
  );
}

// Marge ÷ revenu généré : la part du revenu qui reste une fois le coût réel
// payé. Au-dessus de 0 %, l'employé rapporte plus qu'il ne coûte (rentable) ;
// en dessous, il coûte plus qu'il ne rapporte (perte).
function TauxRentabilite({ marge, revenu, libelle }) {
  if (revenu <= 0) {
    return (
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 8 }}>
        {libelle} : — <span style={{ fontStyle: "italic" }}>(aucun revenu généré sur la période)</span>
      </div>
    );
  }
  const taux = (marge / revenu) * 100;
  const couleur = couleurTaux(taux);
  return (
    <div
      title="Marge ÷ revenu généré — au-dessus de 0 % : rentable ; en dessous : perte"
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 12px", borderRadius: 12, background: "var(--bg)" }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>
        {libelle}
        <span style={{ display: "block", fontSize: 11.5, fontWeight: 400 }}>{argent(marge)} de marge sur {argent(revenu)} de revenu généré</span>
      </span>
      <span style={{ fontSize: 20, fontWeight: 800, color: couleur, whiteSpace: "nowrap" }}>{Math.round(taux)} %</span>
    </div>
  );
}

const champStyle = {
  flex: 1, minWidth: 0, padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 14,
};
const champPeriode = { flex: "1 1 150px", display: "flex", alignItems: "center", gap: 6 };
