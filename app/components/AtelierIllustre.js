"use client";

// Atelier illustré du garage (Vue d'ensemble), dessiné à partir de la
// journée : le bâtiment et son enseigne au nom de l'entreprise, une porte
// par bon en cours — le véhicule monté sur le pont avec le mécanicien quand
// un chrono est en marche —, et dans la cour les véhicules en attente ou
// prêts (client avisé), avec leur pastille (lib/garageVisuel.js). Toucher un
// véhicule ouvre son bon. Autos (berline, VUS, camionnette) ou, pour un
// garage de VR (profil typeVehicules « vr »), motorisés et roulottes. Piles
// de pneus (plus nombreuses en saison des pneus), neige l'hiver ; le ciel
// (CielIllustre) suit le moment de la journée au Québec. Tout est dessiné ici.

import { useRouter } from "next/navigation";
import { graine } from "@/lib/immobilierVisuel";
import { ETATS_VEHICULE } from "@/lib/garageVisuel";
import { cielDe, melanger, assombrir, eclaircir, Arbre, Lampadaire, NEIGE } from "./RueIllustree";

const BUREAU = 86;
const COULEURS_AUTO = ["#c0392b", "#2e6fbf", "#f2f2f0", "#9aa3ad", "#23272d", "#e07338", "#2f8f5b", "#7a4fb8", "#d4b23a"];
const BANDES_VR = ["#2e6fbf", "#c0392b", "#3a3f47", "#b8902f", "#2f8f5b"];

// Dimensions selon le genre de véhicules du garage
const GABARITS = {
  auto: { porte: 80, hauteurPorte: 58, mur: 98, place: 74 },
  vr: { porte: 122, hauteurPorte: 74, mur: 116, place: 118 },
};

function Roue({ x, y, r }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#1b1b1e" />
      <circle cx={x} cy={y} r={r * 0.45} fill="#b9bdc3" />
    </g>
  );
}

// Un véhicule, les roues sur y ; sens 1 : l'avant à droite
function Vehicule({ v, x, y, sens = 1, vr, ciel, saison, dehors, neige }) {
  const alea = graine(v.cle);
  const nuit = ciel.halo >= 0.5;
  const vitre = melanger("#bfe0f5", ciel.ombre[0], ciel.ombre[1] * 0.7);
  const t = `translate(${x} ${y}) scale(${sens} 1)`;
  const neigeToit = (x1, x2, yy) => saison === "hiver" && dehors && <rect x={x1} y={yy - 2.5} width={x2 - x1} height={3} rx={1.5} fill={neige} />;
  if (vr) {
    const genre = alea() < 0.55 ? "motorise" : "roulotte";
    const bande = BANDES_VR[Math.floor(alea() * BANDES_VR.length)];
    const caisse = melanger("#f1ece2", ciel.ombre[0], ciel.ombre[1]);
    if (genre === "motorise") {
      return (
        <g transform={t}>
          <rect x={-52} y={-46} width={84} height={39} rx={5} fill={caisse} />
          <rect x={20} y={-46} width={22} height={14} rx={4} fill={caisse} />
          <path d="M32 -30 H44 Q52 -28 53 -18 V-8 H32 Z" fill={caisse} />
          <path d="M40 -28 H45 Q50 -26 50.5 -19 H40 Z" fill={vitre} />
          <rect x={-52} y={-24} width={104} height={4} fill={bande} />
          <rect x={-52} y={-19} width={104} height={2} fill={eclaircir(bande, 0.35)} />
          {[-44, -26].map((wx) => <rect key={wx} x={wx} y={-40} width={12} height={9} rx={1.5} fill={vitre} />)}
          <rect x={4} y={-38} width={8} height={30} rx={1} fill={assombrir(caisse, 0.08)} stroke={assombrir(caisse, 0.2)} strokeWidth={0.8} />
          {nuit && <circle cx={52} cy={-12} r={2.2} fill="#ffe9a3" />}
          <Roue x={-32} y={-6} r={7} />
          <Roue x={32} y={-6} r={7} />
          {neigeToit(-50, 42, -46)}
        </g>
      );
    }
    return (
      <g transform={t}>
        <path d="M38 -12 L54 -8 M50 -9 V0" stroke="#3a3f47" strokeWidth={2} fill="none" />
        <rect x={-44} y={-42} width={84} height={34} rx={9} fill={caisse} />
        <rect x={-44} y={-22} width={84} height={4} fill={bande} />
        {[-34, -12, 16].map((wx) => <rect key={wx} x={wx} y={-36} width={14} height={9} rx={2} fill={vitre} />)}
        <rect x={0} y={-36} width={9} height={27} rx={1} fill={assombrir(caisse, 0.08)} stroke={assombrir(caisse, 0.2)} strokeWidth={0.8} />
        <Roue x={-6} y={-6} r={6.5} />
        <Roue x={9} y={-6} r={6.5} />
        {neigeToit(-40, 36, -42)}
      </g>
    );
  }
  const genre = ["berline", "vus", "camionnette"][Math.floor(alea() * 3)];
  const teinte = melanger(COULEURS_AUTO[Math.floor(alea() * COULEURS_AUTO.length)], ciel.ombre[0], ciel.ombre[1]);
  const feux = (
    <>
      <rect x={genre === "camionnette" ? 31 : 28} y={-14} width={3} height={3} rx={1} fill={nuit ? "#fff1b8" : "#ffe08a"} />
      <rect x={genre === "camionnette" ? -33 : -30} y={-14} width={2.4} height={3} rx={1} fill="#e0473b" />
    </>
  );
  if (genre === "camionnette") {
    return (
      <g transform={t}>
        <rect x={-32} y={-18} width={30} height={12} rx={2} fill={teinte} />
        <rect x={-32} y={-19} width={30} height={2.5} fill={assombrir(teinte, 0.2)} />
        <path d="M-2 -18 L2 -30 H15 L21 -18 Z" fill={teinte} />
        <path d="M4 -19 L6.5 -27.5 H13.5 L17.5 -19 Z" fill={vitre} />
        <rect x={-2} y={-18} width={36} height={12} rx={3} fill={teinte} />
        {feux}
        <Roue x={-20} y={-5} r={6.2} />
        <Roue x={20} y={-5} r={6.2} />
        {neigeToit(2, 16, -30)}
      </g>
    );
  }
  const haut = genre === "vus" ? -29 : -25;
  return (
    <g transform={t}>
      <path d={genre === "vus" ? "M-25 -17 L-22 -29 H15 L22 -17 Z" : "M-17 -15 L-10 -25 H11 L19 -15 Z"} fill={teinte} />
      <path d={genre === "vus" ? "M-21 -18 L-19 -27 H-2 V-18 Z M1 -18 V-27 H13 L18.5 -18 Z" : "M-14 -16 L-9 -23.5 H0 V-16 Z M2 -16 V-23.5 H10 L16 -16 Z"} fill={vitre} />
      <rect x={-30} y={genre === "vus" ? -18 : -16} width={60} height={genre === "vus" ? 13 : 12} rx={4} fill={teinte} />
      {feux}
      <Roue x={-18} y={-5} r={6} />
      <Roue x={18} y={-5} r={6} />
      {neigeToit(genre === "vus" ? -21 : -9, genre === "vus" ? 14 : 10, haut)}
    </g>
  );
}

// Pastille d'un véhicule : clé (en cours), horloge (en attente), crochet (prêt)
function Pastille({ x, y, etat }) {
  const e = ETATS_VEHICULE[etat];
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={x} cy={y} r={7} fill={e.couleur} stroke="#fff" strokeWidth={1.5} />
      {etat === "ATTENTE" && <path d={`M${x} ${y - 3.5} V${y} L${x + 2.6} ${y + 1.6}`} stroke="#fff" strokeWidth={1.5} fill="none" strokeLinecap="round" />}
      {etat === "PRET" && <path d={`M${x - 3} ${y} L${x - 0.8} ${y + 2.4} L${x + 3.2} ${y - 2.4}`} stroke="#fff" strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {(etat === "TRAVAIL" || etat === "COURS") && <path d={`M${x - 3} ${y + 3} L${x + 1.2} ${y - 1.2} M${x + 2.6} ${y - 2.6} m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0`} stroke="#fff" strokeWidth={1.6} fill="none" strokeLinecap="round" />}
    </g>
  );
}

function Mecanicien({ x, sol }) {
  return (
    <g>
      <rect x={x - 3.5} y={sol - 12} width={3} height={12} fill="#22364f" />
      <rect x={x + 0.5} y={sol - 12} width={3} height={12} fill="#22364f" />
      <rect x={x - 4.5} y={sol - 25} width={9} height={14} rx={2.5} fill="#2f5d8a" />
      <rect x={x + 3} y={sol - 24} width={6} height={2.6} rx={1.3} fill="#2f5d8a" transform={`rotate(-35 ${x + 3} ${sol - 23})`} />
      <circle cx={x} cy={sol - 29} r={4} fill="#e0b48c" />
      <path d={`M${x - 4.2} ${sol - 30} A4.2 4.2 0 0 1 ${x + 4.2} ${sol - 30} H${x + 6} V${sol - 29} H${x - 4.2} Z`} fill="#e07338" />
    </g>
  );
}

function PilePneus({ x, sol, etages }) {
  return Array.from({ length: etages }, (_, i) => (
    <g key={i}>
      <rect x={x} y={sol - 7 * (i + 1)} width={20} height={6.4} rx={3.2} fill="#1d1d20" />
      <rect x={x + 4} y={sol - 7 * (i + 1) + 2.2} width={12} height={2} rx={1} fill="#46464c" />
    </g>
  ));
}

// L'atelier. portes : véhicules aux portes (bons en cours) ; cour : en
// attente ou prêts — vehiculesAtelier() ; nomEntreprise : l'enseigne ;
// vr : motorisés et roulottes ; mois : 1 à 12 (saison des pneus)
export function AtelierIllustre({ portes, cour, nomEntreprise, vr = false, moment, saison, mois, hrefDe, couleurEnseigne = "#e07338", maxPortes = 6, hauteurMax = 240, hauteurMin = 130, cle = "a" }) {
  const router = useRouter();
  const ciel = cielDe(moment, saison);
  const neige = NEIGE[ciel.moment];
  const g = vr ? GABARITS.vr : GABARITS.auto;
  // Hauteur de la scène : celle de l'atelier, avec un peu de ciel au-dessus
  const SOL = g.mur + 40;
  const H = SOL + 34;
  const alea = graine(`atelier-${cle}`);
  const nbPortes = Math.min(maxPortes, Math.max(3, portes.length));
  const x0 = 30;
  const xPortes = x0 + BUREAU;
  const finBatiment = xPortes + nbPortes * g.porte + 10;
  const xCour = finBatiment + 46;
  const largeur = Math.max(640, xCour + Math.max(2, cour.length) * g.place + 50);
  const haut = SOL - g.mur;
  const teinte = (c, f = 1) => melanger(c, ciel.ombre[0], ciel.ombre[1] * f);
  const mur = teinte("#c9ced5");
  const allume = ciel.halo > 0;
  const saisonPneus = [3, 4, 10, 11].includes(mois);
  const ouvrir = (ev, href) => { ev.preventDefault(); router.push(href); };
  const enseigne = String(nomEntreprise || "Garage").slice(0, 26);

  // Immeubles lointains d'une zone commerciale
  const loin = [];
  for (let x = -2400; x < largeur + 2400;) {
    const l = 40 + alea() * 70;
    const h = 30 + alea() * 70;
    loin.push(<rect key={x} x={x} y={SOL - 10 - h} width={l} height={h + 10} fill={ciel.loin} opacity={0.7} />);
    x += l + 6 + alea() * 30;
  }

  return (
    <svg viewBox={`0 0 ${largeur} ${H}`} preserveAspectRatio="xMidYMax meet" role="group" aria-label="Ton atelier : chaque véhicule de la journée"
      style={{ display: "block", width: "100%", aspectRatio: `${largeur} / ${H}`, maxHeight: hauteurMax, minHeight: hauteurMin, overflow: "visible" }}
    >
      <defs>
        <filter id={`halo-atelier-${cle}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      {loin}
      {[-260, -130, largeur + 40, largeur + 170].map((x) => <Arbre key={x} x={x} sol={SOL} saison={saison} alea={alea} neige={neige} />)}

      {/* Sol : stationnement asphalté et trottoir */}
      <rect x={-2400} y={SOL - 2} width={largeur + 4800} height={H - SOL + 2} fill={teinte("#5d5c63")} />
      <rect x={-2400} y={H - 10} width={largeur + 4800} height={10} fill={saison === "hiver" ? neige : teinte("#b9b4aa")} />
      {Array.from({ length: Math.ceil((largeur + 4800) / 40) }, (_, i) => -2400 + i * 40).map((x) => <rect key={x} x={x} y={SOL + 14} width={20} height={2} fill="#e9e4d4" opacity={0.35} />)}

      {/* Bâtiment : bureau vitré, portes de garage, enseigne */}
      <rect x={x0} y={haut} width={finBatiment - x0} height={g.mur} fill={mur} />
      {Array.from({ length: Math.floor((finBatiment - x0) / 9) }, (_, i) => <line key={i} x1={x0 + 4 + i * 9} y1={haut} x2={x0 + 4 + i * 9} y2={SOL} stroke="#000" strokeOpacity={0.06} />)}
      <rect x={x0 - 3} y={haut - 7} width={finBatiment - x0 + 6} height={8} fill={teinte("#7c838c")} />
      {saison === "hiver" && <rect x={x0 - 4} y={haut - 11} width={finBatiment - x0 + 8} height={5} rx={2.5} fill={neige} />}
      {allume && <rect x={xPortes + 4} y={haut + 4} width={nbPortes * g.porte - 8} height={22} rx={4} fill={couleurEnseigne} opacity={0.55} filter={`url(#halo-atelier-${cle})`} />}
      <rect x={xPortes + 8} y={haut + 7} width={nbPortes * g.porte - 16} height={17} rx={3} fill={couleurEnseigne} />
      <text x={xPortes + (nbPortes * g.porte) / 2} y={haut + 19.5} textAnchor="middle" fontSize={11.5} fontWeight={800} fill="#fff" letterSpacing="0.06em" style={{ textTransform: "uppercase" }}>{enseigne}</text>
      {/* Bureau et comptoir */}
      {allume && <rect x={x0 + 8} y={SOL - 58} width={70} height={44} fill="#ffd97a" opacity={ciel.halo * 0.45} filter={`url(#halo-atelier-${cle})`} />}
      <rect x={x0 + 10} y={SOL - 56} width={40} height={30} fill={allume ? "#ffe3a0" : teinte("#a9d4ef")} stroke={teinte("#5a6068")} strokeWidth={2} />
      <line x1={x0 + 30} y1={SOL - 56} x2={x0 + 30} y2={SOL - 26} stroke={teinte("#5a6068")} strokeWidth={1.5} />
      <rect x={x0 + 56} y={SOL - 44} width={20} height={44} fill={allume ? "#ffe3a0" : teinte("#a9d4ef")} stroke={teinte("#5a6068")} strokeWidth={2} />
      <rect x={x0 + 54} y={SOL - 49} width={24} height={4} fill={couleurEnseigne} />

      {/* Portes : un bon en cours par porte ; fermée sinon */}
      {Array.from({ length: nbPortes }, (_, i) => {
        const v = portes[i];
        const px = xPortes + i * g.porte + 7;
        const lp = g.porte - 14;
        const haute = SOL - g.hauteurPorte;
        if (!v) {
          return (
            <g key={`p${i}`}>
              <rect x={px} y={haute} width={lp} height={g.hauteurPorte} fill={teinte("#e4e6ea")} stroke={teinte("#8d939b")} strokeWidth={1.5} />
              {Array.from({ length: Math.floor(g.hauteurPorte / 9) }, (_, k) => <line key={k} x1={px} y1={haute + 9 * (k + 1)} x2={px + lp} y2={haute + 9 * (k + 1)} stroke={teinte("#9aa0a8")} strokeWidth={1} />)}
              {[0.15, 0.4, 0.65].map((f) => <rect key={f} x={px + lp * f} y={haute + 12} width={lp * 0.2} height={6} fill={teinte("#a9d4ef")} />)}
            </g>
          );
        }
        const travail = v.etat === "TRAVAIL";
        const leve = travail ? 12 : 0;
        const href = hrefDe(v);
        return (
          <a key={v.id} href={href} className="vehicule-atelier" onClick={(ev) => ouvrir(ev, href)} aria-label={v.texte}>
            <title>{v.texte}</title>
            <rect x={px} y={haute} width={lp} height={g.hauteurPorte} fill={travail || allume ? "#6a5f4c" : "#3c4048"} />
            {(travail || allume) && <rect x={px + 4} y={haute + 6} width={lp - 8} height={g.hauteurPorte - 10} fill="#ffd27a" opacity={0.28} filter={`url(#halo-atelier-${cle})`} />}
            <rect x={px} y={haute} width={lp} height={8} fill={teinte("#e4e6ea")} stroke={teinte("#8d939b")} strokeWidth={1} />
            {travail && (
              <g>
                <rect x={px + 6} y={SOL - g.hauteurPorte + 12} width={3} height={g.hauteurPorte - 12} fill="#c7372f" />
                <rect x={px + lp - 9} y={SOL - g.hauteurPorte + 12} width={3} height={g.hauteurPorte - 12} fill="#c7372f" />
                <rect x={px + 9} y={SOL - leve - 1} width={lp - 18} height={3} fill="#7a7f87" />
              </g>
            )}
            <Vehicule v={v} x={px + lp / 2} y={SOL - leve} vr={vr} ciel={ciel} saison={saison} neige={neige} />
            {travail && <Mecanicien x={px + lp - 14} sol={SOL} />}
            <Pastille x={px + lp / 2} y={haute + 18} etat={v.etat} />
          </a>
        );
      })}

      {/* Pneus empilés : plus nombreux en saison des pneus */}
      <PilePneus x={finBatiment + 8} sol={SOL} etages={saisonPneus ? 5 : 3} />
      {saisonPneus && <PilePneus x={x0 - 26} sol={SOL} etages={4} />}

      {/* La cour : prêts près de la porte, puis en attente */}
      <Lampadaire x={xCour - 18} sol={SOL} ciel={ciel} />
      {cour.map((v, i) => {
        const cx = xCour + i * g.place + g.place / 2;
        const href = hrefDe(v);
        const hauteurV = vr ? 48 : 30;
        return (
          <a key={v.id} href={href} className="vehicule-atelier" onClick={(ev) => ouvrir(ev, href)} aria-label={v.texte}>
            <title>{v.texte}</title>
            <ellipse cx={cx} cy={SOL + 1} rx={g.place * 0.42} ry={3} fill="#000" opacity={0.18} />
            <Vehicule v={v} x={cx} y={SOL} sens={i % 2 ? -1 : 1} vr={vr} ciel={ciel} saison={saison} dehors neige={neige} />
            <Pastille x={cx} y={SOL - hauteurV - 10} etat={v.etat} />
          </a>
        );
      })}
      {saison === "hiver" && [-60, largeur + 20].map((x) => <path key={x} d={`M${x - 70} ${SOL + 2} Q${x} ${SOL - 26} ${x + 70} ${SOL + 2} Z`} fill={neige} />)}
    </svg>
  );
}
