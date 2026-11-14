"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { argent } from "@/lib/format";
import BandeauSection from "../../../components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, stylePanneau } from "../../../components/StyleSection";

export default function JournalPaieClient({ paies, sommaireEmployes, totaux, debutStr, finStr }) {
  const router = useRouter();
  const [debut, setDebut] = useState(debutStr);
  const [fin, setFin] = useState(finStr);
  const [vue, setVue] = useState("sommaire"); // "sommaire" | "journal"

  function changerPeriode(e) {
    e.preventDefault();
    router.push(`/gerant/paie/journal?debut=${debut}&fin=${fin}`);
  }

  const nbPaies = paies.length;

  return (
    <div className="conteneur-page">
      <Link href="/gerant/paie" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la paie</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="📖" titre="Journal de paie" sousTitre="Toutes les paies versées sur une période : totaux, sommaire par employé et détail de chaque paie." />
      </div>

      <form onSubmit={changerPeriode} style={stylePanneau}>
        <TitrePanneau icone="calendrier" teinte={TEINTES.bleu} titre="Période" sousTitre={`${nbPaies} paie${nbPaies !== 1 ? "s" : ""} versée${nbPaies !== 1 ? "s" : ""} du ${debutStr} au ${finStr}`} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={labelStyle}>Du</label>
            <input type="date" max="9999-12-31" value={debut} onChange={(e) => setDebut(e.target.value)} style={champStyle} />
          </div>
          <div>
            <label style={labelStyle}>Au</label>
            <input type="date" max="9999-12-31" value={fin} onChange={(e) => setFin(e.target.value)} style={champStyle} />
          </div>
          <button type="submit" className="bouton-3d" style={{ gridColumn: "1 / -1", padding: 11, borderRadius: 12, fontSize: 14, fontWeight: 700, marginTop: 4 }}>
            Afficher cette période
          </button>
        </div>
      </form>

      <div className="grille-trois" style={{ marginBottom: 12 }}>
        <CarteChiffre titre="Salaire brut" montant={argent(totaux.brut)} teinte="var(--bleu)" note="Avant retenues" />
        <CarteChiffre titre="Retenues des employés" montant={argent(totaux.deductions)} teinte="var(--danger)" couleur="var(--danger)" note="Impôts et cotisations" />
        <CarteChiffre titre="Net versé" montant={argent(totaux.net)} teinte="var(--success)" couleur="var(--success)" note="Payé aux employés" />
      </div>
      <div className="grille-trois" style={{ marginBottom: 24 }}>
        <CarteChiffre titre="Charges employeur" montant={argent(totaux.chargesEmployeur)} teinte="var(--danger)" note="RRQ, RQAP, AE, FSS, CNESST, normes du travail" />
        <CarteChiffre titre="Vacances accumulées" montant={argent(totaux.vacancesAccumulees)} teinte="var(--accent)" note="Sur les paies régulières" />
        <CarteChiffre titre="Vacances versées" montant={argent(totaux.vacancesVersees)} teinte="var(--accent)" couleur="var(--accent-ombre)" note="Paies de vacances" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 14 }}>
        {[["sommaire", "Sommaire par employé"], ["journal", "Chaque paie"]].map(([cle, label]) => (
          <button
            key={cle} onClick={() => setVue(cle)}
            style={{ padding: "9px 6px", borderRadius: 9, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: vue === cle ? "var(--accent)" : "transparent", color: vue === cle ? "#221f18" : "var(--text-muted)" }}
          >
            {label}
          </button>
        ))}
      </div>

      {vue === "sommaire" ? (
        <div style={stylePanneau}>
          <TitrePanneau icone="utilisateurs" teinte={TEINTES.vert} titre="Sommaire par employé" sousTitre="Du plus haut salaire brut au plus bas." />
          {sommaireEmployes.map(([nom, d], i) => (
            <div key={nom} style={{ padding: "14px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: TEINTES.ambre.fond, color: TEINTES.ambre.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800 }}>
                  {nom.charAt(0).toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700 }}>{nom}</span>
                <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>{d.nbPaies} paie{d.nbPaies > 1 ? "s" : ""}</Pastille>
              </div>
              <Ligne label="Brut" valeur={d.brut} premiere />
              <Ligne label="Retenues employé" valeur={d.deductions} negatif />
              <Ligne label="Charges employeur" valeur={d.chargesEmployeur} />
              <Ligne label="Vacances accumulées" valeur={d.vacancesAccumulees} />
              {d.vacancesVersees > 0 && <Ligne label="Vacances versées" valeur={d.vacancesVersees} />}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderRadius: 12, background: "var(--success-fond)", marginTop: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--success)" }}>Net versé</span>
                <span style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--success)" }}>{argent(d.net)}</span>
              </div>
            </div>
          ))}
          {sommaireEmployes.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucune paie sur cette période.</p>}
        </div>
      ) : (
        <div style={stylePanneau}>
          <TitrePanneau icone="liste" teinte={TEINTES.ambre} titre="Chaque paie" sousTitre="Touche une paie pour voir son talon." />
          {paies.map((p, i) => (
            <Link key={p.id} href={`/gerant/paie/${p.id}/talon`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)", textDecoration: "none", color: "var(--text)" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: TEINTES.ambre.fond, color: TEINTES.ambre.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>
                {p.employe.nom.charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{p.employe.nom}</span>
                  {p.typePaie === "VACANCES" && <Pastille couleur="var(--success)" fond="var(--success-fond)">Vacances</Pastille>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Du {dateCourte(p.periodeDebut)} au {dateCourte(p.periodeFin)}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{argent(p.salaireNet)}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>brut {argent(p.salaireBrut)}</div>
              </div>
              <Icone nom="chevron" taille={16} couleur="var(--text-muted)" />
            </Link>
          ))}
          {paies.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucune paie sur cette période.</p>}
        </div>
      )}
    </div>
  );
}

function Ligne({ label, valeur, negatif, premiere }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5, padding: "7px 2px", borderTop: premiere ? "none" : "1px solid var(--border)" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: negatif ? "var(--danger)" : "var(--text)" }}>{negatif ? "−" : ""}{argent(valeur)}</span>
    </div>
  );
}

const dateCourte = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });
const labelStyle = { fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 };
const champStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box",
};
