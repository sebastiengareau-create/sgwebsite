"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { argent } from "@/lib/format";
import { TEINTES, CarteChiffre, TitrePanneau, BoutonAction, stylePanneau } from "../../../components/StyleSection";

const GROUPEMENTS = [
  { valeur: "jour", label: "Jour" },
  { valeur: "semaine", label: "Semaine" },
  { valeur: "mois", label: "Mois" },
];

function fmt(montant) {
  return `${argent(montant)}`;
}

export default function RapportVentesClient({ lignes, totaux, ticketMoyen, debutStr, finStr, groupement, nombreAnnulees }) {
  const router = useRouter();
  const [debut, setDebut] = useState(debutStr);
  const [fin, setFin] = useState(finStr);
  const [grp, setGrp] = useState(groupement);

  function appliquerFiltre(e) {
    e.preventDefault();
    router.push(`/secretaire/factures/rapport-ventes?debut=${debut}&fin=${fin}&groupement=${grp}`);
  }

  const requete = `debut=${debutStr}&fin=${finStr}&groupement=${groupement}`;

  const libelleGroupement = GROUPEMENTS.find((g) => g.valeur === groupement)?.label.toLowerCase() || groupement;

  return (
    <div className="conteneur-page">
      <form onSubmit={appliquerFiltre} style={stylePanneau}>
        <TitrePanneau
          icone="tendance" teinte={TEINTES.ambre} titre="Rapport de ventes"
          sousTitre={`Chiffre d'affaires facturé, groupé par ${libelleGroupement}.${nombreAnnulees > 0 ? ` ${nombreAnnulees} facture${nombreAnnulees !== 1 ? "s" : ""} annulée${nombreAnnulees !== 1 ? "s" : ""} exclue${nombreAnnulees !== 1 ? "s" : ""}.` : ""}`}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={labelStyle}>Du</label>
            <input type="date" max="9999-12-31" value={debut} onChange={(e) => setDebut(e.target.value)} style={champStyle} />
          </div>
          <div>
            <label style={labelStyle}>Au</label>
            <input type="date" max="9999-12-31" value={fin} onChange={(e) => setFin(e.target.value)} style={champStyle} />
          </div>
        </div>
        <label style={{ ...labelStyle, marginTop: 10 }}>Grouper par</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg)", border: "1px solid var(--border)", marginBottom: 12 }}>
          {GROUPEMENTS.map((g) => (
            <button
              key={g.valeur} type="button" onClick={() => setGrp(g.valeur)}
              style={{ padding: "9px 4px", borderRadius: 9, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: grp === g.valeur ? "var(--accent)" : "transparent", color: grp === g.valeur ? "#221f18" : "var(--text-muted)" }}
            >
              {g.label}
            </button>
          ))}
        </div>
        <button type="submit" className="bouton-3d" style={{ width: "100%", padding: 11, borderRadius: 12, fontSize: 14, fontWeight: 700 }}>
          Afficher le rapport
        </button>
      </form>

      <div className="grille-deux" style={{ marginBottom: 20 }}>
        <CarteChiffre titre="Ventes (avant taxes)" montant={fmt(totaux.totalAvantTaxes)} teinte="var(--accent)" couleur="var(--accent-ombre)" note={`Pièces ${fmt(totaux.totalPieces || 0)} · main-d'œuvre ${fmt(totaux.totalMainOeuvre || 0)}`} />
        <CarteChiffre titre="Taxes perçues" montant={fmt(totaux.tps + totaux.tvq)} teinte="var(--bleu)" note={`TPS ${fmt(totaux.tps)} · TVQ ${fmt(totaux.tvq)}`} />
        <CarteChiffre titre="Total avec taxes" montant={fmt(totaux.totalAvecTaxes)} teinte="var(--success)" couleur="var(--success)" note="Facturé aux clients" />
        <CarteChiffre titre="Factures" montant={String(totaux.nombreFactures)} teinte="var(--bleu)" note={`Ticket moyen ${fmt(ticketMoyen)}`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        <BoutonAction icone="imprimante" compact onClick={() => window.print()}>Imprimer</BoutonAction>
        <BoutonAction icone="document" compact href={`/api/factures/rapport-ventes/pdf?${requete}`}>PDF</BoutonAction>
        <BoutonAction icone="grille" compact href={`/api/factures/rapport-ventes/csv?${requete}`}>Excel (.csv)</BoutonAction>
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="liste" teinte={TEINTES.bleu} titre={`Ventes par ${libelleGroupement}`} sousTitre={`Du ${debutStr} au ${finStr}`} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--accent)" }}>
                <th style={enteteStyle}>Période</th>
                <th style={{ ...enteteStyle, textAlign: "right" }}>Factures</th>
                <th style={{ ...enteteStyle, textAlign: "right" }}>Pièces</th>
                <th style={{ ...enteteStyle, textAlign: "right" }}>Main-d'œuvre</th>
                <th style={{ ...enteteStyle, textAlign: "right" }}>Avant taxes</th>
                <th style={{ ...enteteStyle, textAlign: "right" }}>Taxes</th>
                <th style={{ ...enteteStyle, textAlign: "right" }}>Avec taxes</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.cle} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ ...celluleStyle, fontWeight: 700, whiteSpace: "nowrap" }}>{l.libelle}</td>
                  <td style={{ ...celluleStyle, textAlign: "right" }}>{l.nombreFactures}</td>
                  <td style={{ ...celluleStyle, textAlign: "right" }}>{fmt(l.totalPieces)}</td>
                  <td style={{ ...celluleStyle, textAlign: "right" }}>{fmt(l.totalMainOeuvre)}</td>
                  <td style={{ ...celluleStyle, textAlign: "right", fontWeight: 700 }}>{fmt(l.totalAvantTaxes)}</td>
                  <td style={{ ...celluleStyle, textAlign: "right", color: "var(--text-muted)" }}>{fmt(l.tps + l.tvq)}</td>
                  <td style={{ ...celluleStyle, textAlign: "right", fontWeight: 800 }}>{fmt(l.totalAvecTaxes)}</td>
                </tr>
              ))}
              {lignes.length > 0 && (
                <tr style={{ background: "rgba(232,163,61,0.16)" }}>
                  <td style={{ ...celluleStyle, fontWeight: 800, color: "var(--accent-ombre)", borderRadius: "10px 0 0 10px" }}>Total</td>
                  <td style={{ ...celluleStyle, textAlign: "right", fontWeight: 800 }}>{totaux.nombreFactures}</td>
                  <td style={{ ...celluleStyle, textAlign: "right", fontWeight: 800 }}>{totaux.totalPieces != null ? fmt(totaux.totalPieces) : ""}</td>
                  <td style={{ ...celluleStyle, textAlign: "right", fontWeight: 800 }}>{totaux.totalMainOeuvre != null ? fmt(totaux.totalMainOeuvre) : ""}</td>
                  <td style={{ ...celluleStyle, textAlign: "right", fontWeight: 800 }}>{fmt(totaux.totalAvantTaxes)}</td>
                  <td style={{ ...celluleStyle, textAlign: "right", fontWeight: 800 }}>{fmt(totaux.tps + totaux.tvq)}</td>
                  <td style={{ ...celluleStyle, textAlign: "right", fontWeight: 800, borderRadius: "0 10px 10px 0" }}>{fmt(totaux.totalAvecTaxes)}</td>
                </tr>
              )}
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "16px 4px", color: "var(--text-muted)", textAlign: "center" }}>
                    Aucune vente sur cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 };
const champStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box",
};
const enteteStyle = { textAlign: "left", padding: "8px 8px", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", whiteSpace: "nowrap" };
const celluleStyle = { padding: "10px 8px", whiteSpace: "nowrap" };
