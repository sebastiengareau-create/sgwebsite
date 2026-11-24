"use client";

import { useEffect, useRef, useState } from "react";
import { argent } from "@/lib/immobilierCalculs";

// Loyers des 12 derniers mois : pour chaque mois, deux colonnes côte à côte
// — loyers facturés (inscrits pour ce mois) et paiements reçus pendant le
// mois. Deux séries, donc une légende ; couleurs --serie-2 / --serie-1
// (app/globals.css, paire vérifiée pour le daltonisme et le contraste).
// Dessiné à la largeur réelle du panneau. Survol, toucher ou clavier : les
// montants du mois. Les mêmes chiffres en tableau (« Voir les chiffres »).
// Même facture que les ventes de l'élevage (app/elevage/viande/VentesParMois.js).
const H = 210, MARGE = { haut: 22, droite: 8, bas: 34, gauche: 46 };
const SERIES = [
  { cle: "facture", label: "Loyers facturés", couleur: "var(--serie-2)" },
  { cle: "percu", label: "Paiements reçus", couleur: "var(--serie-1)" },
];

// Graduations « rondes » à partir de 0 (pas de 1, 2 ou 5 × 10ⁿ)
function graduations(max, cible = 4) {
  if (!(max > 0)) return [0, 1];
  const brut = max / cible;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 5, 10].map((m) => m * puissance).find((p) => p >= brut);
  const liste = [];
  for (let v = 0; v < max + pas; v += pas) liste.push(v);
  return liste;
}

const compact = (v) => (v >= 10000 ? `${(v / 1000).toLocaleString("fr-CA")} k` : v.toLocaleString("fr-CA"));

// Colonne arrondie en haut (4 px), carrée à la base
function colonne(x, haut, largeur, bas) {
  const hauteur = Math.max(0, bas - haut);
  if (hauteur === 0) return "";
  const r = Math.min(4, hauteur, largeur / 2);
  return `M${x},${bas} V${haut + r} Q${x},${haut} ${x + r},${haut} H${x + largeur - r} Q${x + largeur},${haut} ${x + largeur},${haut + r} V${bas} Z`;
}

// mois : [{ cle: "2026-11", facture, percu }] du plus ancien au plus récent
export default function LoyersParMois({ mois }) {
  const cadre = useRef(null);
  const [largeur, setLargeur] = useState(380);
  const [survol, setSurvol] = useState(null);
  const [tableau, setTableau] = useState(false);
  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const observateur = new ResizeObserver(([e]) => setLargeur(Math.max(280, Math.round(e.contentRect.width))));
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  const axe = graduations(Math.max(...mois.map((m) => Math.max(m.facture, m.percu))));
  const yMax = axe[axe.length - 1];
  const zone = largeur - MARGE.gauche - MARGE.droite;
  const pas = zone / mois.length;
  const ecart = 2; // espace entre les deux colonnes d'un mois
  const epaisseur = Math.min(16, Math.max(5, (pas * 0.72 - ecart) / 2));
  const y = (v) => H - MARGE.bas - (v / yMax) * (H - MARGE.haut - MARGE.bas);
  const centre = (i) => MARGE.gauche + pas * (i + 0.5);
  const etroit = pas < 40;
  const nomMois = (cle, format) => new Date(`${cle}-15T12:00:00Z`).toLocaleDateString("fr-CA", { month: format, timeZone: "UTC" });
  const libelleMois = (cle) => `${nomMois(cle, "long")} ${cle.slice(0, 4)}`;
  const actif = survol == null ? null : mois[survol];

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 14px", fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>
        {SERIES.map((s) => (
          <span key={s.cle} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.couleur }} />{s.label}
          </span>
        ))}
        <button type="button" onClick={() => setTableau((v) => !v)} style={{ marginLeft: "auto", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: "var(--accent-ombre)" }}>
          {tableau ? "Voir le graphique" : "Voir les chiffres"}
        </button>
      </div>
      <div ref={cadre} style={{ position: "relative" }}>
        {tableau ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr>{["Mois", ...SERIES.map((s) => s.label), "Écart"].map((e, i) => <th key={e} style={{ textAlign: i === 0 ? "left" : "right", fontSize: 12, color: "var(--text-muted)", padding: "6px 4px", borderBottom: "2px solid var(--accent)" }}>{e}</th>)}</tr>
              </thead>
              <tbody>
                {[...mois].reverse().map((m) => (
                  <tr key={m.cle}>
                    <td style={{ padding: "7px 4px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{nomMois(m.cle, "short")} {m.cle.slice(0, 4)}</td>
                    {SERIES.map((s) => <td key={s.cle} style={{ padding: "7px 4px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>{argent(m[s.cle])}</td>)}
                    <td style={{ padding: "7px 4px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 700 }}>{argent(m.percu - m.facture)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <svg
            width={largeur} height={H} role="img" style={{ display: "block", touchAction: "pan-y" }}
            aria-label={`Loyers facturés et paiements reçus par mois, de ${libelleMois(mois[0].cle)} à ${libelleMois(mois[mois.length - 1].cle)}`}
            onPointerLeave={() => setSurvol(null)}
          >
            {axe.map((v) => (
              <g key={v}>
                <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
                <text x={MARGE.gauche - 8} y={y(v) + 4} textAnchor="end" fontSize={11.5} fill="var(--text-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{compact(v)}</text>
              </g>
            ))}
            <text x={MARGE.gauche - 8} y={10} textAnchor="end" fontSize={11.5} fill="var(--text-muted)">$</text>
            {mois.map((m, i) => {
              const x0 = centre(i) - epaisseur - ecart / 2;
              return (
                <g key={m.cle}>
                  {survol === i && <rect x={centre(i) - pas / 2} y={MARGE.haut} width={pas} height={H - MARGE.haut - MARGE.bas} rx={6} fill="var(--surface-alt)" />}
                  {SERIES.map((s, k) => <path key={s.cle} fill={s.couleur} d={colonne(x0 + k * (epaisseur + ecart), y(m[s.cle]), epaisseur, y(0))} />)}
                  <text x={centre(i)} y={H - MARGE.bas + 15} textAnchor="middle" fontSize={11.5} fill="var(--text-muted)">{etroit ? nomMois(m.cle, "narrow") : nomMois(m.cle, "short")}</text>
                  {/* L'année sous janvier, et sous le premier mois s'il n'est pas décembre (les deux se toucheraient) */}
                  {((i === 0 && !m.cle.endsWith("-12")) || m.cle.endsWith("-01")) && <text x={centre(i)} y={H - MARGE.bas + 29} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{m.cle.slice(0, 4)}</text>}
                  <rect
                    x={centre(i) - pas / 2} y={0} width={pas} height={H} fill="transparent" tabIndex={0} aria-label={`${libelleMois(m.cle)} : facturé ${argent(m.facture)}, reçu ${argent(m.percu)}`}
                    onPointerMove={() => setSurvol(i)} onPointerDown={() => setSurvol(i)} onFocus={() => setSurvol(i)} onBlur={() => setSurvol(null)} style={{ outline: "none" }}
                  />
                </g>
              );
            })}
            <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(0)} y2={y(0)} stroke="var(--text-muted)" strokeWidth={1} />
          </svg>
        )}
        {actif && !tableau && (
          <div style={{
            position: "absolute", top: 0, left: centre(survol), transform: `translateX(${centre(survol) > largeur * 0.6 ? "calc(-100% - 10px)" : "10px"})`,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", fontSize: 12.5, pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, textTransform: "capitalize" }}>{libelleMois(actif.cle)}</div>
            {SERIES.map((s) => (
              <div key={s.cle} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)" }}>
                <span style={{ width: 10, height: 2, borderRadius: 1, background: s.couleur }} />{s.label}
                <strong style={{ marginLeft: "auto", paddingLeft: 14, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{argent(actif[s.cle])}</strong>
              </div>
            ))}
            <div style={{ display: "flex", borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4, color: "var(--text-muted)" }}>
              Écart<strong style={{ marginLeft: "auto", paddingLeft: 14, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{argent(actif.percu - actif.facture)}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
