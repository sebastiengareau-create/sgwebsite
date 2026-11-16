"use client";

import { useState } from "react";
import { kg, dateLisible, age } from "@/lib/elevageCalculs";

// Courbe de poids d'une bête : une seule série (le poids vif à chaque
// pesée), donc pas de légende — le titre du panneau la nomme. Ligne de 2 px,
// points de 8 px, grille discrète ; survol ou toucher : la pesée la plus
// proche, avec sa date, son poids et l'âge de la bête.
// Dessinée à peu près à sa taille d'affichage sur un téléphone, pour que le
// texte des axes reste lisible (12 px), et jamais plus large que 560 px.
// cible (kg/jour, bête en croissance) : droite pointillée du gain visé, à
// partir de la première pesée.
const L = 380, H = 200, MARGE = { haut: 24, droite: 12, bas: 24, gauche: 38 };

// Graduations « rondes » de l'axe des poids (pas de 1, 2 ou 5 × 10ⁿ)
function graduations(min, max, cible = 4) {
  const brut = (max - min) / cible || 1;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 5, 10].map((m) => m * puissance).find((p) => p >= brut);
  const debut = Math.floor(min / pas) * pas;
  const liste = [];
  for (let v = debut; v < max + pas; v += pas) liste.push(Math.round(v * 100) / 100);
  return liste;
}

export default function CourbePoids({ pesees, dateNaissance, cible }) {
  const [survol, setSurvol] = useState(null);
  const points = [...pesees].sort((a, b) => new Date(a.date) - new Date(b.date)).map((p) => ({ ...p, t: new Date(p.date).getTime() }));
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const axeY = graduations(Math.min(...points.map((p) => p.poids)), Math.max(...points.map((p) => p.poids)));
  const yMin = axeY[0];
  const yMax = axeY[axeY.length - 1];
  const x = (t) => MARGE.gauche + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (L - MARGE.gauche - MARGE.droite);
  const y = (v) => H - MARGE.bas - ((v - yMin) / (yMax - yMin || 1)) * (H - MARGE.haut - MARGE.bas);
  const actif = survol == null ? null : points[survol];
  const poidsVise = cible ? points[0].poids + (cible * (t1 - t0)) / 86400000 : null;

  // Pesée la plus proche du pointeur, en abscisse
  function viser(e) {
    const cadre = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - cadre.left) / cadre.width) * L;
    let proche = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.t) - px) < Math.abs(x(points[proche].t) - px)) proche = i; });
    setSurvol(proche);
  }

  return (
    <div style={{ position: "relative", marginBottom: 12, maxWidth: 560 }}>
      <svg
        viewBox={`0 0 ${L} ${H}`} role="img" aria-label={`Courbe de poids : de ${kg(points[0].poids)} le ${dateLisible(points[0].date)} à ${kg(points[points.length - 1].poids)} le ${dateLisible(points[points.length - 1].date)}`}
        style={{ width: "100%", height: "auto", display: "block", touchAction: "pan-y" }}
        onPointerMove={viser} onPointerDown={viser} onPointerLeave={() => setSurvol(null)}
      >
        {axeY.map((v) => (
          <g key={v}>
            <line x1={MARGE.gauche} x2={L - MARGE.droite} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={MARGE.gauche - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="var(--text-muted)">{v}</text>
          </g>
        ))}
        <text x={MARGE.gauche - 8} y={12} textAnchor="end" fontSize={12} fill="var(--text-muted)">kg</text>
        <text x={MARGE.gauche} y={H - 6} fontSize={12} fill="var(--text-muted)">{dateLisible(points[0].date)}</text>
        <text x={L - MARGE.droite} y={H - 6} textAnchor="end" fontSize={12} fill="var(--text-muted)">{dateLisible(points[points.length - 1].date)}</text>
        {poidsVise != null && t1 > t0 && (
          <>
            <clipPath id="zone-courbe"><rect x={MARGE.gauche} y={MARGE.haut} width={L - MARGE.gauche - MARGE.droite} height={H - MARGE.haut - MARGE.bas} /></clipPath>
            <line x1={x(t0)} y1={y(points[0].poids)} x2={x(t1)} y2={y(poidsVise)} stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="5 4" clipPath="url(#zone-courbe)" />
            <text x={L - MARGE.droite} y={12} textAnchor="end" fontSize={12} fill="var(--text-muted)">- - gain visé</text>
          </>
        )}
        {actif && <line x1={x(actif.t)} x2={x(actif.t)} y1={MARGE.haut} y2={H - MARGE.bas} stroke="var(--text-muted)" strokeWidth={1} />}
        <polyline points={points.map((p) => `${x(p.t)},${y(p.poids)}`).join(" ")} fill="none" stroke="var(--bleu)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={p.id || i} cx={x(p.t)} cy={y(p.poids)} r={survol === i ? 6 : 4} fill="var(--bleu)" stroke="var(--surface)" strokeWidth={2} />
        ))}
      </svg>
      {actif && (
        <div style={{
          position: "absolute", top: 0, left: `${(x(actif.t) / L) * 100}%`, transform: `translateX(${x(actif.t) > L * 0.6 ? "calc(-100% - 8px)" : "8px"})`,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 10px", fontSize: 12.5, pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{kg(actif.poids)}</div>
          <div style={{ color: "var(--text-muted)" }}>{dateLisible(actif.date)}{dateNaissance && age(dateNaissance, actif.date) ? ` · ${age(dateNaissance, actif.date)}` : ""}</div>
        </div>
      )}
    </div>
  );
}
