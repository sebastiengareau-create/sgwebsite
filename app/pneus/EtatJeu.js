"use client";

import { ETATS_JEU, SEUILS_PNEUS_DEFAUT, pneusDuJeu, libellePosition, ageDot, evaluerJeu } from "@/lib/pneusCalculs";
import { Pastille } from "../components/StyleSection";
import { couleurUsure } from "./ChampsJeu";

// Pastille de l'état d'un jeu (bon, à surveiller, à remplacer) ; rien si
// aucune mesure. etat : evaluerJeu(...)
export function PastilleEtat({ etat, bonAussi = true }) {
  const e = etat?.code && ETATS_JEU[etat.code];
  if (!e || (!bonAussi && etat.code === "BON")) return null;
  return <Pastille couleur={e.couleur} fond={e.fond}>{e.libelle}</Pastille>;
}

// État d'un jeu en encadré : raisons et conseils pour la pose
export function EncadreEtat({ jeu, seuils = SEUILS_PNEUS_DEFAUT, conseils = true }) {
  const etat = evaluerJeu(jeu, seuils);
  const e = etat.code && ETATS_JEU[etat.code];
  const aConseils = conseils && etat.conseils.length > 0;
  if (!(e && etat.code !== "BON") && !aConseils) return null;
  return (
    <div style={{ borderRadius: 12, padding: "9px 12px", background: e && etat.code !== "BON" ? e.fond : "var(--bleu-fond)", fontSize: 13 }}>
      {e && etat.code !== "BON" && (
        <div><b style={{ color: e.couleur }}>{e.libelle}</b> — {etat.raisons.join(" · ")}</div>
      )}
      {aConseils && etat.conseils.map((c) => <div key={c} style={{ marginTop: 2 }}>↻ {c}</div>)}
    </div>
  );
}

// Détail pneu par pneu en lecture, disposé comme sur le véhicule
export function VueDetailPneus({ jeu, seuils = SEUILS_PNEUS_DEFAUT }) {
  const detail = pneusDuJeu(jeu);
  if (!detail.some((p) => p.usure != null || p.dot || p.remplacer || p.note)) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
      {detail.map((p, i) => {
        const couleur = p.remplacer ? "var(--danger)" : couleurUsure(p.usure, seuils);
        const age = ageDot(p.dot);
        return (
          <div key={i} style={{ border: "1px solid var(--border)", borderLeft: `4px solid ${couleur || "var(--border)"}`, borderRadius: 10, padding: "6px 9px", background: "var(--bg)", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{libellePosition(p.position)}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: couleur || "var(--text)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {p.usure != null ? <>{String(p.usure).replace(".", ",")}<span style={{ fontSize: 11, fontWeight: 600 }}>/32</span></> : "—"}
              </span>
            </div>
            {(p.dot || age != null) && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>DOT {p.dot}{age != null ? ` · ${age} an${age > 1 ? "s" : ""}` : ""}</div>}
            {(p.remplacer || p.note) && <div style={{ fontSize: 12, color: p.remplacer ? "var(--danger)" : "var(--text)", fontWeight: p.remplacer ? 700 : 400 }}>{p.remplacer ? "À remplacer" : ""}{p.remplacer && p.note ? " : " : ""}{p.note}</div>}
          </div>
        );
      })}
    </div>
  );
}
