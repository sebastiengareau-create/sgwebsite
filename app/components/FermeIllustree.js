"use client";

// Ferme illustrée de l'Élevage (déclinaison Ferme), dessinée à partir du
// troupeau : la grange rouge à comble brisé et son silo, les collines et le
// pâturage de la saison (balles rondes enrubannées l'été et l'automne, neige
// l'hiver), la clôture de perches, et chaque bête au troupeau — taureau,
// vache, génisse, bouvillon, veau à côté de sa mère —, boucle jaune ATQ à
// l'oreille, avec une pastille si elle est en délai de retrait, gestante ou
// au poids d'abattage (lib/elevageVisuel.js). Toucher une bête ouvre sa
// fiche. Le ciel (CielIllustre) suit le moment de la journée au Québec.
// Aucune image téléchargée : tout est dessiné ici.

import { useRouter } from "next/navigation";
import { graine } from "@/lib/immobilierVisuel";
import { ETATS_BETE } from "@/lib/elevageVisuel";
import { cielDe, melanger, assombrir, eclaircir, Arbre, NEIGE } from "./RueIllustree";

const H = 262;
const HORIZON = 126; // pied des collines
const BASE_GRANGE = 182;
const CLOTURE = 252;
// Rangées du pâturage : pied des bêtes et échelle (perspective)
const RANGEES = [{ y: 176, echelle: 0.95, decalage: 0 }, { y: 209, echelle: 1.1, decalage: 22 }, { y: 242, echelle: 1.26, decalage: 44 }];
const COLONNE = 68;
const DEBUT = 238; // à droite de la grange et du silo
// Au-delà, le troupeau est représenté (lib/elevageVisuel.js, echantillonFerme)
const MAX = 36;

const CHAMPS = {
  printemps: { loin: "#8fcb7e", pres: "#79c35a", herbe: "#5ea544" },
  ete: { loin: "#6fae5c", pres: "#5aa845", herbe: "#3f8a35" },
  automne: { loin: "#b8a25e", pres: "#c4a95c", herbe: "#9c8540" },
  hiver: { loin: "#dde6f1", pres: "#f1f5fa", herbe: null },
};
const ECHELLES = { TAUREAU: 1.22, VACHE: 1, BOUVILLON: 0.95, GENISSE: 0.86, VEAU: 0.6 };
// Wagyu : noir le plus souvent ; un croisé tire parfois sur le brun
const ROBES = ["#1c1817", "#221b18", "#2a211c", "#191617"];
const ROBES_CROISE = ["#2a1f1a", "#3d2b22", "#4f3526"];

// Une bête, les pieds sur (x, y) ; sens : 1 regarde à droite, -1 à gauche
function Bete({ b, x, y, echelle, sens, ciel, href, onOuvrir }) {
  const alea = graine(b.id);
  const robes = b.genetique === "CROISE" ? ROBES_CROISE : ROBES;
  const robe = robes[Math.floor(alea() * robes.length)];
  const broute = b.categorie !== "VEAU" && alea() < 0.4;
  const taureau = b.categorie === "TAUREAU";
  const nuit = ciel.halo >= 0.5;
  const contour = nuit ? "rgba(255,255,255,0.28)" : "none";
  const e = b.etat && ETATS_BETE[b.etat];
  return (
    <a href={href} className="bete-ferme" onClick={(ev) => { ev.preventDefault(); onOuvrir(href); }} aria-label={b.texte}>
      <title>{b.texte}</title>
      <ellipse cx={x} cy={y} rx={19 * echelle} ry={3.2 * echelle} fill="#000" opacity={0.16} />
      <g transform={`translate(${x} ${y}) scale(${sens * echelle} ${echelle})`} stroke={contour} strokeWidth={0.8}>
        {/* Pattes */}
        {[-14, -9, 8, 13].map((px) => <rect key={px} x={px} y={-11} width={3.6} height={11} rx={1.2} fill={robe} />)}
        {/* Queue */}
        <path d="M-18 -20 Q-22 -15 -20.5 -9" fill="none" stroke={robe} strokeWidth={1.8} />
        <circle cx={-20.5} cy={-8.5} r={1.6} fill={robe} />
        {/* Corps, et la bosse du taureau */}
        <rect x={-19} y={-26} width={38} height={17} rx={8.5} fill={robe} />
        {taureau && <ellipse cx={9} cy={-25.5} rx={8.5} ry={5} fill={robe} />}
        {/* Tête : haute, ou basse quand elle broute */}
        <g transform={broute ? "translate(19 -16) rotate(38)" : "translate(18 -27)"}>
          <rect x={-2} y={-6} width={13} height={10.5} rx={4.2} fill={robe} />
          <rect x={8} y={-2.5} width={5.5} height={6.5} rx={2.4} fill={eclaircir(robe, 0.22)} />
          <ellipse cx={0} cy={-6} rx={3.6} ry={1.7} transform="rotate(-24)" fill={robe} />
          {/* Boucle jaune d'Agri-Traçabilité Québec */}
          <rect x={-2.2} y={-6.4} width={2.4} height={2.8} rx={0.5} fill="#f5c400" stroke="none" />
          <circle cx={5} cy={-2.6} r={0.95} fill="#fff" opacity={0.75} stroke="none" />
          {taureau && <path d="M3 -6 q-1.5 -3.8 1.6 -5.4 M6.5 -6 q0.2 -3.6 3 -4.4" fill="none" stroke="#e9dcc0" strokeWidth={1.3} />}
        </g>
      </g>
      {e && (
        <g>
          <circle cx={x} cy={y - 40 * echelle} r={6.2} fill={e.couleur} stroke="#fff" strokeWidth={1.4} />
          <text x={x} y={y - 40 * echelle + 2.6} textAnchor="middle" fontSize={7.5} fontWeight={800} fill="#fff" style={{ pointerEvents: "none" }}>{e.signe}</text>
        </g>
      )}
    </a>
  );
}

function Grange({ x, ciel, saison, neige, halo }) {
  const mur = melanger("#a8322b", ciel.ombre[0], ciel.ombre[1]);
  const toit = melanger("#3e4850", ciel.ombre[0], ciel.ombre[1]);
  const blanc = melanger("#f1ece3", ciel.ombre[0], ciel.ombre[1] * 0.8);
  const allume = ciel.halo > 0;
  const y = BASE_GRANGE;
  const toitPts = `${x - 7},${y - 56} ${x + 14},${y - 88} ${x + 62},${y - 104} ${x + 110},${y - 88} ${x + 131},${y - 56}`;
  return (
    <g>
      {/* Silo */}
      <rect x={x + 134} y={y - 112} width={28} height={112} fill={melanger("#a9b7c2", ciel.ombre[0], ciel.ombre[1])} />
      <path d={`M${x + 134} ${y - 112} a14 12 0 0 1 28 0 z`} fill={melanger("#7f8f9c", ciel.ombre[0], ciel.ombre[1])} />
      {[24, 48, 72, 96].map((d) => <rect key={d} x={x + 134} y={y - d} width={28} height={2} fill={assombrir("#a9b7c2", 0.25 + ciel.ombre[1] * 0.4)} />)}
      {saison === "hiver" && <path d={`M${x + 134} ${y - 113} a14 12 0 0 1 28 0 a14 8 0 0 0 -28 0 z`} fill={neige} />}
      {/* Grange rouge à comble brisé */}
      <rect x={x} y={y - 58} width={124} height={58} fill={mur} />
      <polygon points={toitPts} fill={toit} />
      {/* Pignon sous le toit */}
      <polygon points={`${x + 8},${y - 58} ${x + 22},${y - 82} ${x + 62},${y - 95} ${x + 102},${y - 82} ${x + 116},${y - 58}`} fill={mur} />
      {Array.from({ length: 15 }, (_, i) => <line key={i} x1={x + 6 + i * 8} y1={y - 58} x2={x + 6 + i * 8} y2={y} stroke="#000" strokeOpacity={0.1} strokeWidth={0.8} />)}
      {/* Fenêtre du fenil et grande porte en X */}
      {allume && <rect x={x + 49} y={y - 88} width={26} height={20} rx={3} fill="#ffcf6a" opacity={ciel.halo * 0.55} filter={halo} />}
      <rect x={x + 52} y={y - 85} width={20} height={14} fill={allume ? "#ffd97a" : assombrir(mur, 0.45)} stroke={blanc} strokeWidth={2} />
      <rect x={x + 38} y={y - 42} width={48} height={42} fill={assombrir(mur, 0.12)} stroke={blanc} strokeWidth={2.4} />
      <path d={`M${x + 38} ${y - 42} L${x + 62} ${y} M${x + 62} ${y - 42} L${x + 38} ${y} M${x + 62} ${y - 42} L${x + 86} ${y} M${x + 86} ${y - 42} L${x + 62} ${y} M${x + 62} ${y - 42} V${y}`} stroke={blanc} strokeWidth={1.8} />
      <rect x={x + 12} y={y - 40} width={14} height={12} fill={allume ? "#ffd97a" : assombrir(mur, 0.45)} stroke={blanc} strokeWidth={1.6} />
      <rect x={x + 98} y={y - 40} width={14} height={12} fill={allume ? "#ffd97a" : assombrir(mur, 0.45)} stroke={blanc} strokeWidth={1.6} />
      {saison === "hiver" && <polyline points={toitPts} fill="none" stroke={neige} strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" />}
    </g>
  );
}

// Collines du fond, de « de » à « a »
function Collines({ de, a, couleur, base, amplitude, alea }) {
  let d = `M${de} ${H} L${de} ${base}`;
  for (let x = de; x < a; x += 160) {
    const h = base - amplitude * (0.4 + alea() * 0.6);
    d += ` Q${x + 80} ${h} ${x + 160} ${base}`;
  }
  return <path d={`${d} L${a} ${H} Z`} fill={couleur} />;
}

// Balles rondes enrubannées (les « guimauves » des champs du Québec)
function Balles({ x, y }) {
  return [0, 1, 2].map((i) => (
    <g key={i}>
      <rect x={x + i * 24} y={y - 12} width={20} height={13} rx={6} fill="#f5f3ee" />
      <rect x={x + i * 24} y={y - 12} width={6} height={13} rx={3} fill="#e2ded5" />
    </g>
  ));
}

// La ferme. betes : betesPourFerme() — [{ id, categorie, genetique, etat, texte }] ;
// hrefDe(bete) → lien de sa fiche ; cle : distingue deux scènes d'une même page
export function FermeIllustree({ betes, moment, saison, hrefDe, hauteurMax = 240, hauteurMin = 130, cle = "a" }) {
  const router = useRouter();
  const ciel = cielDe(moment, saison);
  const alea = graine(`ferme-${betes.length}`);
  const neige = NEIGE[ciel.moment];
  const visibles = betes.slice(0, MAX);
  // Petit troupeau : une bête par colonne, en zigzag d'une rangée à l'autre,
  // pour remplir le pâturage ; plus grand : deux ou trois par colonne
  const parColonne = visibles.length <= 10 ? 1 : visibles.length <= 24 ? 2 : 3;
  const colonne = parColonne === 3 ? 58 : COLONNE;
  const colonnes = Math.max(5, Math.ceil(visibles.length / parColonne));
  const largeur = DEBUT + colonnes * colonne + 60;
  const champ = CHAMPS[saison] || CHAMPS.ete;
  const teinte = (c) => melanger(c, ciel.ombre[0], ciel.ombre[1]);

  // Places au pâturage : colonne par colonne, de l'arrière à l'avant (un veau
  // suit sa mère dans l'ordre, donc se retrouve juste devant ou derrière elle)
  const places = visibles.map((b, i) => {
    const rang = parColonne === 1 ? [1, 2, 0, 2, 1, 0][i % 6] : parColonne === 2 ? [0, 2][i % 2] : i % 3;
    const r = RANGEES[rang];
    const c = Math.floor(i / parColonne);
    const a = graine(b.id);
    return { b, x: DEBUT + c * colonne + r.decalage + (a() - 0.5) * 14, y: r.y + (a() - 0.5) * 6, echelle: r.echelle * (ECHELLES[b.categorie] || 1), sens: a() < 0.5 ? 1 : -1 };
  }).sort((p, q) => p.y - q.y);

  const touffes = saison === "hiver" ? [] : Array.from({ length: 70 }, () => [-300 + alea() * (largeur + 600), HORIZON + 14 + alea() * (H - HORIZON - 20)]);

  return (
    <svg viewBox={`0 0 ${largeur} ${H}`} preserveAspectRatio="xMidYMax meet" role="group" aria-label="Ta ferme : chaque bête du troupeau"
      style={{ display: "block", width: "100%", aspectRatio: `${largeur} / ${H}`, maxHeight: hauteurMax, minHeight: hauteurMin, overflow: "visible" }}
    >
      <defs>
        <filter id={`halo-ferme-${cle}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" /></filter>
      </defs>
      <Collines de={-2400} a={largeur + 2400} couleur={teinte(champ.loin)} base={HORIZON} amplitude={34} alea={alea} />
      {[-260, -120, 60, largeur - 40, largeur + 120, largeur + 260].map((x) => <Arbre key={x} x={x} sol={HORIZON + 6} saison={saison} alea={alea} neige={neige} />)}
      <Collines de={-2400} a={largeur + 2400} couleur={teinte(champ.pres)} base={HORIZON + 18} amplitude={14} alea={alea} />
      {touffes.map(([x, y], i) => <path key={i} d={`M${x} ${y} l-2 -4 M${x} ${y} l0 -5 M${x} ${y} l2 -4`} stroke={teinte(champ.herbe)} strokeWidth={1.1} opacity={0.7} />)}
      {(saison === "ete" || saison === "automne") && <Balles x={largeur - 120} y={HORIZON + 26} />}
      <Grange x={22} ciel={ciel} saison={saison} neige={neige} halo={`url(#halo-ferme-${cle})`} />
      {places.map((p) => <Bete key={p.b.id} {...p} ciel={ciel} href={hrefDe(p.b)} onOuvrir={(h) => router.push(h)} />)}
      {/* Clôture de perches */}
      <g>
        <line x1={-2400} y1={CLOTURE - 14} x2={largeur + 2400} y2={CLOTURE - 14} stroke={teinte("#8a6a4a")} strokeWidth={2.2} />
        <line x1={-2400} y1={CLOTURE - 6} x2={largeur + 2400} y2={CLOTURE - 6} stroke={teinte("#8a6a4a")} strokeWidth={2.2} />
        {Array.from({ length: Math.ceil((largeur + 4800) / 32) }, (_, i) => -2400 + i * 32).map((x) => (
          <g key={x}>
            <rect x={x} y={CLOTURE - 20} width={4} height={22} fill={teinte("#6e523a")} />
            {saison === "hiver" && <rect x={x - 0.5} y={CLOTURE - 22} width={5} height={2.5} rx={1.2} fill={neige} />}
          </g>
        ))}
      </g>
    </svg>
  );
}
