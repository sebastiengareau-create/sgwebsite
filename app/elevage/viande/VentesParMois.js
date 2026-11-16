"use client";

import { useEffect, useRef, useState } from "react";
import { CANAUX, argent } from "@/lib/elevageCalculs";

// Ventes de viande des 12 derniers mois : une colonne par mois, empilée par
// canal (boutique, puis en ligne). Deux séries, donc une légende ; couleurs
// --serie-1 / --serie-2 (app/globals.css). Dessiné à la largeur réelle du
// panneau pour que le texte garde sa taille sur un téléphone comme sur un
// grand écran. Survol ou toucher : les montants du mois. Les mêmes chiffres
// sont offerts en tableau (« Voir les chiffres »).
const H = 220, MARGE = { haut: 26, droite: 8, bas: 34, gauche: 46 };
const COULEURS = { BOUTIQUE: "var(--serie-1)", EN_LIGNE: "var(--serie-2)" };

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

// mois : [{ cle: "2026-11", BOUTIQUE: 1234.5, EN_LIGNE: 0 }, …] du plus ancien au plus récent
export default function VentesParMois({ mois }) {
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

  const total = (m) => CANAUX.reduce((s, c) => s + (m[c.code] || 0), 0);
  const axe = graduations(Math.max(...mois.map(total)));
  const yMax = axe[axe.length - 1];
  const zone = largeur - MARGE.gauche - MARGE.droite;
  const pas = zone / mois.length;
  const epaisseur = Math.min(24, Math.max(8, pas * 0.6));
  const y = (v) => H - MARGE.bas - (v / yMax) * (H - MARGE.haut - MARGE.bas);
  const centre = (i) => MARGE.gauche + pas * (i + 0.5);
  const etroit = pas < 44;
  const nomMois = (cle, format) => new Date(`${cle}-15T12:00:00Z`).toLocaleDateString("fr-CA", { month: format, timeZone: "UTC" });
  const libelleMois = (cle) => `${nomMois(cle, "long")} ${cle.slice(0, 4)}`;
  const actif = survol == null ? null : mois[survol];

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 14px", fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>
        {CANAUX.map((c) => (
          <span key={c.code} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: COULEURS[c.code] }} />{c.label}
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
                <tr>{["Mois", ...CANAUX.map((c) => c.label), "Total"].map((e, i) => <th key={e} style={{ textAlign: i === 0 ? "left" : "right", fontSize: 12, color: "var(--text-muted)", padding: "6px 4px", borderBottom: "2px solid var(--accent)" }}>{e}</th>)}</tr>
              </thead>
              <tbody>
                {[...mois].reverse().map((m) => (
                  <tr key={m.cle}>
                    <td style={{ padding: "7px 4px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{nomMois(m.cle, "short")} {m.cle.slice(0, 4)}</td>
                    {CANAUX.map((c) => <td key={c.code} style={{ padding: "7px 4px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>{argent(m[c.code] || 0)}</td>)}
                    <td style={{ padding: "7px 4px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 700 }}>{argent(total(m))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <svg
            width={largeur} height={H} role="img" style={{ display: "block", touchAction: "pan-y" }}
            aria-label={`Ventes de viande par mois, de ${libelleMois(mois[0].cle)} à ${libelleMois(mois[mois.length - 1].cle)}, en boutique et en ligne`}
            onPointerLeave={() => setSurvol(null)}
          >
            {axe.map((v) => (
              <g key={v}>
                <line x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
                <text x={MARGE.gauche - 8} y={y(v) + 4} textAnchor="end" fontSize={11.5} fill="var(--text-muted)">{compact(v)}</text>
              </g>
            ))}
            <text x={MARGE.gauche - 8} y={10} textAnchor="end" fontSize={11.5} fill="var(--text-muted)">$</text>
            {mois.map((m, i) => {
              // Segments empilés à partir de la base, séparés de 2 px ; seul le
              // dessus de la colonne est arrondi
              let bas = 0;
              const segments = CANAUX.map((c) => ({ code: c.code, de: bas, a: (bas += m[c.code] || 0) })).filter((s) => s.a > s.de);
              return (
                <g key={m.cle}>
                  {survol === i && <rect x={centre(i) - pas / 2} y={MARGE.haut} width={pas} height={H - MARGE.haut - MARGE.bas} fill="var(--surface-alt)" />}
                  {segments.map((s, k) => {
                    const dessus = k === segments.length - 1;
                    const haut = y(s.a) + (dessus ? 0 : 2);
                    const hauteur = Math.max(0, y(s.de) - haut);
                    const r = dessus ? Math.min(4, hauteur) : 0;
                    const x0 = centre(i) - epaisseur / 2;
                    return <path key={s.code} fill={COULEURS[s.code]} d={`M${x0},${haut + hauteur} V${haut + r} Q${x0},${haut} ${x0 + r},${haut} H${x0 + epaisseur - r} Q${x0 + epaisseur},${haut} ${x0 + epaisseur},${haut + r} V${haut + hauteur} Z`} />;
                  })}
                  <text x={centre(i)} y={H - MARGE.bas + 15} textAnchor="middle" fontSize={11.5} fill="var(--text-muted)">{etroit ? nomMois(m.cle, "narrow") : nomMois(m.cle, "short")}</text>
                  {/* L'année sous janvier, et sous le premier mois s'il n'est pas décembre (les deux se toucheraient) */}
                  {((i === 0 && !m.cle.endsWith("-12")) || m.cle.endsWith("-01")) && <text x={centre(i)} y={H - MARGE.bas + 29} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{m.cle.slice(0, 4)}</text>}
                  <rect x={centre(i) - pas / 2} y={0} width={pas} height={H} fill="transparent" onPointerMove={() => setSurvol(i)} onPointerDown={() => setSurvol(i)} />
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
            {CANAUX.map((c) => (
              <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: COULEURS[c.code] }} />{c.label}
                <strong style={{ marginLeft: "auto", paddingLeft: 14, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{argent(actif[c.code] || 0)}</strong>
              </div>
            ))}
            <div style={{ display: "flex", borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4, fontWeight: 800 }}>Total<span style={{ marginLeft: "auto", paddingLeft: 14, fontVariantNumeric: "tabular-nums" }}>{argent(total(actif))}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
