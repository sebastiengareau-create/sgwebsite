"use client";

// Rue illustrée de l'Immobilier et de la Copropriété, dessinée à partir des
// données : un immeuble par immeuble (ou bâtiment) inscrit (plex à corniche,
// balcons et escalier extérieur ; multilogement ; mixte avec ses commerces ;
// maison ; immeuble en copropriété « CONDO », moderne, à balcons vitrés), une
// fenêtre par logement ou unité, de la couleur de son état — allumée s'il
// est en règle, rouge en retard, bleue à surveiller, éteinte avec une
// pancarte « À louer » s'il est vacant, éteinte sans pancarte (« SANS ») pour
// une unité sans propriétaire inscrit. Le ciel suit le moment de la
// journée au Québec, les arbres et la neige suivent la saison
// (lib/immobilierVisuel.js). Aucune image téléchargée : tout est dessiné ici.
//
//   <CielIllustre>   ciel (dégradé, soleil ou lune, étoiles, nuages, neige)
//   <RueIllustree>    la rue entière (tableau de bord)
//   <FacadeIllustree> un seul immeuble, pour une carte ou une vignette

import { useRouter } from "next/navigation";
import { rangeesImmeuble, graine } from "@/lib/immobilierVisuel";

// ---------- Couleurs ----------

export const ETATS_FENETRE = {
  OK: { label: "Loué, en règle", verre: "#ffd36b", halo: "#ffb938" },
  RETARD: { label: "Loyer en retard", verre: "#ff7a68", halo: "#ff4b38" },
  SURVEILLER: { label: "Bail à surveiller", verre: "#8fd0ff", halo: "#45adff" },
  VACANT: { label: "Vacant", verre: "#2b2742", halo: null },
  SANS: { label: "Sans propriétaire inscrit", verre: "#2b2742", halo: null },
};

const MURS = ["#b4533c", "#c9773f", "#d8c29c", "#5a7899", "#7a5ea8", "#6f8f6b", "#a8475f", "#e2d1b1"];
// Immeubles en copropriété : béton clair, ardoise, bois, sable
const MURS_CONDO = ["#d7d2c9", "#9aa6b4", "#c49a72", "#e4ddd0", "#6f8396", "#b8c4bf"];
const PORTES = ["#2f5d8a", "#8a2f3b", "#2f6b4f", "#5b3d8f", "#c2632f"];
const AUVENTS = ["#d94f4f", "#2f8f6f", "#3a6fd1", "#e09a20", "#8e4fc9"];

const CIELS = {
  matin: { fond: "linear-gradient(180deg, #86bdf0 0%, #c3d6f3 48%, #fbcfae 100%)", loin: "#9fb2d6", ombre: ["#f4c6a5", 0.06], sol: "#cdc5ba", rue: "#56505f", halo: 0.25 },
  jour: { fond: "linear-gradient(180deg, #3d8de0 0%, #6aaef0 52%, #c4e6ff 100%)", loin: "#91b5de", ombre: ["#000000", 0], sol: "#d0c9bd", rue: "#57525f", halo: 0 },
  soir: { fond: "linear-gradient(180deg, #2a226e 0%, #67399c 40%, #d0548a 74%, #f7a65b 100%)", loin: "#583a8a", ombre: ["#3a2466", 0.3], sol: "#8c7f95", rue: "#3c3550", halo: 0.5 },
  nuit: { fond: "linear-gradient(180deg, #0a1131 0%, #1b2155 62%, #33296b 100%)", loin: "#252a5d", ombre: ["#120f33", 0.5], sol: "#57526c", rue: "#2a2739", halo: 0.7 },
};
const CIEL_JOUR_HIVER = "linear-gradient(180deg, #5c9ce0 0%, #93c1ee 55%, #dcecfb 100%)";
const NEIGE = { matin: "#f4f7fb", jour: "#f7fbff", soir: "#e6dcef", nuit: "#b8bfdc" };

const FEUILLAGES = {
  printemps: ["#86cf62", "#a3dc7b", "#74bf55"],
  ete: ["#3f9b4f", "#2f8442", "#58b160"],
  automne: ["#e07a2f", "#c8442b", "#f0b13a"],
};

// Voile derrière le texte du tableau de bord, pour qu'il reste lisible sur le ciel
export const VOILES = {
  matin: "linear-gradient(100deg, rgba(30,50,110,0.5) 0%, rgba(30,50,110,0.18) 50%, rgba(30,50,110,0) 78%)",
  jour: "linear-gradient(100deg, rgba(18,50,115,0.42) 0%, rgba(18,50,115,0.14) 50%, rgba(18,50,115,0) 78%)",
  soir: "linear-gradient(100deg, rgba(20,10,50,0.55) 0%, rgba(20,10,50,0.22) 50%, rgba(20,10,50,0) 78%)",
  nuit: "linear-gradient(100deg, rgba(8,8,30,0.45) 0%, rgba(8,8,30,0.15) 50%, rgba(8,8,30,0) 78%)",
};

export function cielDe(moment, saison) {
  const c = CIELS[moment] || CIELS.jour;
  return { ...c, moment: CIELS[moment] ? moment : "jour", fond: moment === "jour" && saison === "hiver" ? CIEL_JOUR_HIVER : c.fond };
}

function hex(c) {
  const h = c.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function melanger(a, b, t) {
  const [x, y] = [hex(a), hex(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
const assombrir = (c, t) => melanger(c, "#000000", t);
const eclaircir = (c, t) => melanger(c, "#ffffff", t);

// ---------- Dimensions d'un immeuble ----------

const TRAVEE = 34; // largeur d'une travée (une fenêtre)
const ETAGE = 46;
const RC = 52;
const MARGE = 12;
const PORTE = 22; // colonne de la porte d'entrée
const CORNICHE = 14;
const ESPACE = 46; // entre deux immeubles (arbre ou lampadaire)

function plan(im) {
  const { rangees, sousSol, commercesAuRc } = rangeesImmeuble(im);
  const maxParEtage = Math.max(1, ...rangees.map((r) => r.length), sousSol.length);
  const travees = im.type === "MAISON" ? Math.max(2, maxParEtage) : maxParEtage === 1 ? 2 : maxParEtage;
  const largeur = MARGE * 2 + PORTE + travees * TRAVEE;
  const corps = RC + (rangees.length - 1) * ETAGE;
  const toit = im.type === "MAISON" ? Math.round(largeur * 0.36) : CORNICHE + 4;
  return { rangees, sousSol, commercesAuRc, travees, largeur, corps, hauteur: corps + toit };
}

// Travées occupées par chaque logement d'une rangée : [[logement, début, fin]…]
function repartir(rangee, travees) {
  const k = rangee.length;
  if (k === 0) return [];
  return rangee.map((l, i) => [l, Math.floor((i * travees) / k), Math.floor(((i + 1) * travees) / k) - 1]);
}

// ---------- Morceaux de décor ----------

function Fenetre({ x, y, l, h, etat, info, ciel, haute, moderne }) {
  const e = ETATS_FENETRE[etat] || ETATS_FENETRE.VACANT;
  const cadre = moderne ? "#363b46" : melanger("#f4eee3", ciel.ombre[0], ciel.ombre[1] * 0.8);
  const hauteur = haute ? h + 7 : h;
  return (
    <g>
      {info && <title>{info}</title>}
      {e.halo && ciel.halo > 0 && <rect x={x - 5} y={y - 5} width={l + 10} height={hauteur + 10} rx={6} fill={e.halo} opacity={ciel.halo * 0.55} filter="url(#halo-immo)" />}
      <rect x={x - 2} y={y - 4} width={l + 4} height={3} fill={cadre} opacity={0.9} />
      <rect x={x} y={y} width={l} height={hauteur} rx={1.5} fill={e.verre} stroke={cadre} strokeWidth={2} />
      <line x1={x + l / 2} y1={y} x2={x + l / 2} y2={y + hauteur} stroke={cadre} strokeWidth={1.3} />
      <line x1={x} y1={y + hauteur * 0.42} x2={x + l} y2={y + hauteur * 0.42} stroke={cadre} strokeWidth={1.3} />
      {etat === "VACANT" && (
        <g>
          <rect x={x + l / 2 - 7} y={y + hauteur * 0.5} width={14} height={8} rx={1} fill="#ffffff" stroke="#d8262f" strokeWidth={1.2} />
          <line x1={x + l / 2 - 4} y1={y + hauteur * 0.5 + 3} x2={x + l / 2 + 4} y2={y + hauteur * 0.5 + 3} stroke="#d8262f" strokeWidth={1.1} />
          <line x1={x + l / 2 - 3} y1={y + hauteur * 0.5 + 5.4} x2={x + l / 2 + 3} y2={y + hauteur * 0.5 + 5.4} stroke="#d8262f" strokeWidth={1} />
        </g>
      )}
      {!haute && <rect x={x - 2} y={y + hauteur + 1} width={l + 4} height={2.5} fill={cadre} opacity={0.9} />}
    </g>
  );
}

function Vitrine({ x, y, l, h, etat, info, ciel, auvent }) {
  const e = ETATS_FENETRE[etat] || ETATS_FENETRE.VACANT;
  const rayures = Math.max(3, Math.round((l + 14) / 8));
  const lr = (l + 14) / rayures;
  return (
    <g>
      {info && <title>{info}</title>}
      {e.halo && ciel.halo > 0 && <rect x={x - 4} y={y - 2} width={l + 8} height={h + 4} rx={4} fill={e.halo} opacity={ciel.halo * 0.5} filter="url(#halo-immo)" />}
      <rect x={x} y={y} width={l} height={h} fill={etat === "VACANT" ? e.verre : eclaircir(e.verre, 0.25)} stroke="#3a3346" strokeWidth={2} />
      {Array.from({ length: Math.max(0, Math.round(l / TRAVEE) - 1) }, (_, i) => (
        <line key={i} x1={x + ((i + 1) * l) / Math.round(l / TRAVEE)} y1={y} x2={x + ((i + 1) * l) / Math.round(l / TRAVEE)} y2={y + h} stroke="#3a3346" strokeWidth={1.5} />
      ))}
      {etat === "VACANT" && <rect x={x + l / 2 - 9} y={y + h * 0.35} width={18} height={10} rx={1} fill="#ffffff" stroke="#d8262f" strokeWidth={1.4} />}
      {Array.from({ length: rayures }, (_, i) => (
        <polygon
          key={i}
          points={`${x - 7 + i * lr},${y - 10} ${x - 7 + (i + 1) * lr},${y - 10} ${x - 9 + (i + 1) * lr + 2},${y - 2} ${x - 9 + i * lr + 2},${y - 2}`}
          fill={i % 2 ? "#fbf6ee" : auvent}
        />
      ))}
    </g>
  );
}

function Arbre({ x, sol, saison, alea, neige }) {
  const tronc = "#6b4a35";
  if (saison === "hiver") {
    return (
      <g>
        <rect x={x - 2.5} y={sol - 34} width={5} height={34} fill={tronc} />
        <path d={`M${x} ${sol - 28} l-11 -12 M${x} ${sol - 33} l9 -13 M${x - 6} ${sol - 34} l-3 -8 M${x + 4} ${sol - 40} l6 -5`} stroke={tronc} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        <ellipse cx={x - 10} cy={sol - 41} rx={4} ry={1.8} fill={neige} />
        <ellipse cx={x + 9} cy={sol - 46} rx={4} ry={1.8} fill={neige} />
      </g>
    );
  }
  const f = FEUILLAGES[saison] || FEUILLAGES.ete;
  const d = (alea() - 0.5) * 4;
  return (
    <g>
      <rect x={x - 2.5} y={sol - 26} width={5} height={26} fill={tronc} />
      <circle cx={x - 9} cy={sol - 32 + d} r={11} fill={f[0]} />
      <circle cx={x + 10} cy={sol - 34 - d} r={12} fill={f[2]} />
      <circle cx={x} cy={sol - 44} r={15} fill={f[1]} />
      {saison === "printemps" && [0, 1, 2, 3].map((i) => <circle key={i} cx={x - 9 + i * 6} cy={sol - 40 + (i % 2) * 7} r={1.8} fill="#f7a8c8" />)}
    </g>
  );
}

function Lampadaire({ x, sol, ciel }) {
  const allume = ciel.halo >= 0.5;
  return (
    <g>
      {allume && <circle cx={x} cy={sol - 47} r={14} fill="#ffe08a" opacity={0.35} filter="url(#halo-immo)" />}
      <line x1={x} y1={sol} x2={x} y2={sol - 46} stroke="#2c2838" strokeWidth={2.6} />
      <rect x={x - 6} y={sol - 52} width={12} height={4} rx={1.5} fill="#2c2838" />
      <circle cx={x} cy={sol - 46.5} r={2.8} fill={allume ? "#fff1b8" : "#d9d4c7"} />
    </g>
  );
}

// Un immeuble, posé sur le sol en x ; infos : { [logementId]: { etat, texte } }
function Immeuble({ im, p, x, sol, ciel, saison, infos, href, onOuvrir }) {
  const alea = graine(im.id || im.nom);
  const condo = im.type === "CONDO";
  const murs = condo ? MURS_CONDO : MURS;
  const mur = murs[Math.floor(alea() * murs.length)];
  const porte = PORTES[Math.floor(alea() * PORTES.length)];
  const fonce = assombrir(mur, 0.28);
  const neige = NEIGE[ciel.moment];
  const haut = sol - p.corps;
  const x0 = x + MARGE + PORTE;
  const etatDe = (l) => infos[l.id]?.etat || "VACANT";
  const texteDe = (l) => infos[l.id]?.texte || `Logement ${l.numero}`;
  const maison = im.type === "MAISON";
  const plex = im.type === "PLEX" || im.type === "AUTRE";
  const fenL = 18;
  const fenH = 26;

  // Façade, toit, fondation
  const facade = (
    <>
      <rect x={x} y={haut} width={p.largeur} height={p.corps} fill={mur} />
      {!condo && <rect x={x} y={haut} width={p.largeur} height={p.corps} fill="url(#briques-immo)" />}
      <rect x={x} y={sol - 5} width={p.largeur} height={5} fill={assombrir(mur, 0.35)} />
      {condo ? (
        <>
          {/* Dalles de béton à chaque étage, parapet et local technique sur le toit */}
          {p.rangees.slice(1).map((_, r) => <rect key={r} x={x} y={sol - RC - r * ETAGE - 2} width={p.largeur} height={3} fill={eclaircir(mur, 0.35)} />)}
          <rect x={x - 2} y={haut - 6} width={p.largeur + 4} height={6} fill={assombrir(mur, 0.22)} />
          <rect x={x + p.largeur * 0.58} y={haut - CORNICHE} width={Math.max(18, p.largeur * 0.22)} height={8} fill={assombrir(mur, 0.3)} />
        </>
      ) : maison ? (
        <>
          <rect x={x + p.largeur * 0.68} y={haut - p.largeur * 0.3} width={10} height={p.largeur * 0.2} fill={assombrir(mur, 0.2)} />
          <polygon points={`${x - 8},${haut + 2} ${x + p.largeur / 2},${haut - p.largeur * 0.36} ${x + p.largeur + 8},${haut + 2}`} fill="#4c3f57" />
        </>
      ) : (
        <>
          <rect x={x - 3} y={haut - CORNICHE} width={p.largeur + 6} height={9} fill={fonce} />
          {Array.from({ length: Math.floor((p.largeur + 2) / 7) }, (_, i) => <rect key={i} x={x + 1 + i * 7} y={haut - 5} width={3.5} height={3.5} fill={fonce} />)}
          <rect x={x - 1} y={haut - 5} width={6} height={12} fill={fonce} />
          <rect x={x + p.largeur - 5} y={haut - 5} width={6} height={12} fill={fonce} />
        </>
      )}
    </>
  );

  // Ombre du moment (soir, nuit) sur la façade, sous les fenêtres
  const ombre = ciel.ombre[1] > 0 && (
    <>
      <rect x={x - 3} y={haut - CORNICHE} width={p.largeur + 6} height={p.corps + CORNICHE} fill={ciel.ombre[0]} opacity={ciel.ombre[1]} />
      {maison && <polygon points={`${x - 8},${haut + 2} ${x + p.largeur / 2},${haut - p.largeur * 0.36} ${x + p.largeur + 8},${haut + 2}`} fill={ciel.ombre[0]} opacity={ciel.ombre[1]} />}
    </>
  );

  // Fenêtres : rez-de-chaussée puis étages
  const fenetres = [];
  p.rangees.forEach((rangee, r) => {
    const basEtage = r === 0 ? sol : sol - RC - (r - 1) * ETAGE;
    const hautEtage = r === 0 ? sol - RC : basEtage - ETAGE;
    const commerces = r === 0 && p.commercesAuRc;
    for (const [l, debut, fin] of repartir(rangee, p.travees)) {
      if (commerces) {
        const gx = x0 + debut * TRAVEE + 3;
        fenetres.push(<Vitrine key={l.id} x={gx} y={hautEtage + 18} l={(fin - debut + 1) * TRAVEE - 6} h={RC - 18 - 5} etat={etatDe(l)} info={texteDe(l)} ciel={ciel} auvent={AUVENTS[Math.floor(alea() * AUVENTS.length)]} />);
        continue;
      }
      for (let t = debut; t <= fin; t++) {
        const fx = x0 + t * TRAVEE + (TRAVEE - fenL) / 2;
        const fy = hautEtage + (r === 0 ? 12 : 9);
        // Porte-fenêtre sur le balcon : la première travée de chaque logement
        // d'un plex, et chaque unité en copropriété au-dessus du rez-de-chaussée
        const haute = (plex && r > 0 && t === debut && fin > debut) || (condo && r > 0);
        fenetres.push(<Fenetre key={`${l.id}-${t}`} x={fx} y={fy} l={fenL} h={fenH} etat={etatDe(l)} info={texteDe(l)} ciel={ciel} haute={haute} moderne={condo} />);
      }
    }
  });
  // Demi-sous-sol : petites fenêtres au ras du sol
  for (const [l, debut, fin] of repartir(p.sousSol, p.travees)) {
    for (let t = debut; t <= fin; t++) {
      fenetres.push(<Fenetre key={`ss-${l.id}-${t}`} x={x0 + t * TRAVEE + (TRAVEE - fenL) / 2} y={sol - 14} l={fenL} h={8} etat={etatDe(l)} info={texteDe(l)} ciel={ciel} moderne={condo} />);
    }
  }

  // Porte d'entrée (et marquise d'un multilogement)
  const px = x + MARGE + 3;
  const entree = (
    <>
      {ciel.halo > 0 && <rect x={px - 2} y={sol - 42} width={20} height={9} fill="#ffcf6a" opacity={ciel.halo * 0.5} filter="url(#halo-immo)" />}
      {condo ? (
        <>
          <rect x={px} y={sol - 38} width={16} height={38} fill={ciel.halo > 0 ? "#ffe3a0" : "#9fd0ee"} stroke="#2d3440" strokeWidth={1.6} />
          <line x1={px + 8} y1={sol - 38} x2={px + 8} y2={sol} stroke="#2d3440" strokeWidth={1.2} />
          <rect x={px - 6} y={sol - 44} width={28} height={4} rx={1} fill="#2d3440" />
        </>
      ) : (
        <>
          <rect x={px} y={sol - 40} width={16} height={7} fill="#ffd982" stroke={eclaircir(porte, 0.5)} strokeWidth={1} />
          <rect x={px} y={sol - 32} width={16} height={32} fill={porte} />
          <circle cx={px + 12.5} cy={sol - 15} r={1.3} fill="#f2d27a" />
        </>
      )}
      <rect x={px - 3} y={sol - 2} width={22} height={2} fill={assombrir(mur, 0.4)} />
      {im.type === "MULTILOGEMENT" && <rect x={px - 5} y={sol - 46} width={26} height={4} rx={1} fill="#2c2838" />}
    </>
  );

  // Balcons et escalier extérieur (plex et mixte), à l'avant
  const fer = ciel.halo >= 0.5 ? "#4a4560" : "#2c2838";
  const balcons = [];
  // Balcons vitrés d'un immeuble en copropriété : un par unité, aux étages
  if (condo) {
    p.rangees.forEach((rangee, r) => {
      if (r === 0) return;
      const y = sol - RC - (r - 1) * ETAGE;
      for (const [l, debut, fin] of repartir(rangee, p.travees)) {
        const xa = x0 + debut * TRAVEE + 2;
        const xb = x0 + (fin + 1) * TRAVEE - 2;
        balcons.push(
          <g key={`bv-${l.id}`}>
            <rect x={xa} y={y - 12} width={xb - xa} height={11} fill="#b9e2fb" opacity={0.5} />
            <line x1={xa} y1={y - 12} x2={xb} y2={y - 12} stroke="#e8edf2" strokeWidth={1.6} />
            <rect x={xa - 1} y={y - 1} width={xb - xa + 2} height={3} fill={eclaircir(mur, 0.35)} />
            {saison === "hiver" && <rect x={xa} y={y - 14} width={xb - xa} height={2} rx={1} fill={neige} />}
          </g>,
        );
      }
    });
  }
  if (!maison && !condo && im.type !== "MULTILOGEMENT") {
    for (let r = 1; r < p.rangees.length; r++) {
      const y = sol - RC - (r - 1) * ETAGE;
      const xa = x0 - 4;
      const xb = x + p.largeur - MARGE + 4;
      balcons.push(
        <g key={`b${r}`}>
          <rect x={xa} y={y - 1} width={xb - xa} height={3.5} fill={fer} />
          <line x1={xa} y1={y - 12} x2={xb} y2={y - 12} stroke={fer} strokeWidth={1.6} />
          {Array.from({ length: Math.floor((xb - xa) / 6) + 1 }, (_, i) => <line key={i} x1={xa + i * 6} y1={y - 12} x2={xa + i * 6} y2={y} stroke={fer} strokeWidth={0.9} />)}
          {saison === "hiver" && <rect x={xa} y={y - 2.5} width={xb - xa} height={2} fill={neige} />}
        </g>,
      );
    }
    // Escalier extérieur jusqu'au premier balcon (plex de deux étages et plus)
    if (plex && p.rangees.length >= 2) {
      const xb = x + p.largeur - MARGE - 2;
      const xh = xb - 44;
      const yh = sol - RC;
      const marches = 9;
      balcons.push(
        <g key="escalier">
          <line x1={xb} y1={sol} x2={xh} y2={yh} stroke={fer} strokeWidth={2.4} />
          <line x1={xb + 1} y1={sol - 12} x2={xh + 1} y2={yh - 12} stroke={fer} strokeWidth={1.4} />
          {Array.from({ length: marches }, (_, i) => {
            const t = (i + 0.5) / marches;
            const mx = xb + (xh - xb) * t;
            const my = sol + (yh - sol) * t;
            return <line key={i} x1={mx - 3} y1={my} x2={mx + 4} y2={my} stroke={fer} strokeWidth={1.6} />;
          })}
        </g>,
      );
    }
  }

  // Neige sur le toit
  const neigeToit = saison === "hiver" && (condo
    ? <rect x={x - 3} y={haut - 9} width={p.largeur + 6} height={4.5} rx={2} fill={neige} />
    : maison
    ? <polygon points={`${x - 6},${haut - 1} ${x + p.largeur / 2},${haut - p.largeur * 0.36 + 2} ${x + p.largeur + 6},${haut - 1} ${x + p.largeur / 2},${haut - p.largeur * 0.3}`} fill={neige} opacity={0.95} />
    : <rect x={x - 4} y={haut - CORNICHE - 4} width={p.largeur + 8} height={5} rx={2.5} fill={neige} />);

  return (
    <a href={href} className={href ? "immeuble-rue" : undefined} onClick={(e) => { if (onOuvrir) { e.preventDefault(); onOuvrir(href); } }} aria-label={href ? `Ouvrir ${im.nom}` : undefined}>
      <title>{im.nom}</title>
      {facade}
      {ombre}
      {entree}
      {fenetres}
      {balcons}
      {neigeToit}
    </a>
  );
}

// Décor commun : immeubles lointains, sol, arbres et lampadaires de part et
// d'autre (dessinés hors du cadre : ils remplissent les côtés quand la rue
// est plus étroite que l'écran)
function Decor({ de, a, sol, ciel, saison, alea }) {
  const loin = [];
  const fenetresLoin = [];
  for (let x = de; x < a;) {
    const l = 26 + alea() * 50;
    const h = 40 + alea() * 95;
    loin.push(<rect key={x} x={x} y={sol - h} width={l + 1} height={h} fill={ciel.loin} />);
    if (ciel.halo >= 0.5) {
      for (let i = 0; i < 3; i++) {
        if (alea() < 0.55) fenetresLoin.push(<rect key={`${x}-${i}`} x={x + 5 + alea() * (l - 10)} y={sol - h + 8 + alea() * (h - 20)} width={3} height={4} fill="#ffd36b" opacity={0.55} />);
      }
    }
    x += l + 2 + alea() * 10;
  }
  const neige = NEIGE[ciel.moment];
  const sol2 = saison === "hiver" ? melanger(neige, ciel.ombre[0], ciel.ombre[1] * 0.5) : ciel.sol;
  return (
    <>
      <g opacity={0.75}>{loin}{fenetresLoin}</g>
      <rect x={de} y={sol} width={a - de} height={9} fill={sol2} />
      <rect x={de} y={sol + 9} width={a - de} height={2} fill={saison === "hiver" ? assombrir(sol2, 0.12) : assombrir(ciel.sol, 0.25)} />
      <rect x={de} y={sol + 11} width={a - de} height={40} fill={ciel.rue} />
    </>
  );
}

const defs = (
  <defs>
    <pattern id="briques-immo" width="14" height="7" patternUnits="userSpaceOnUse">
      <path d="M0 6.5 H14 M7 0 V3.2 M0 3.2 H14 M0 3.2 V6.5" stroke="#000" strokeOpacity="0.09" strokeWidth="0.8" fill="none" />
    </pattern>
    <filter id="halo-immo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" /></filter>
  </defs>
);

// Arbres et lampadaires à intervalles, de `de` à `a`, en sautant les immeubles
function Plantations({ points, sol, ciel, saison, alea }) {
  const neige = NEIGE[ciel.moment];
  return points.map((x, i) => (i % 3 === 1
    ? <Lampadaire key={x} x={x} sol={sol} ciel={ciel} />
    : <Arbre key={x} x={x} sol={sol} saison={saison} alea={alea} neige={neige} />));
}

const styleSvg = (largeur, hauteur, max, min) => ({ display: "block", width: "100%", aspectRatio: `${largeur} / ${hauteur}`, maxHeight: max, minHeight: min, overflow: "visible" });

// La rue du parc. immeubles : [{ id, nom, type, logements: [{ id, numero, type, etage }] }] ;
// infos : { [logementId]: { etat, texte } } ; hrefDe(immeuble) → lien de sa fiche
export function RueIllustree({ immeubles, infos, moment, saison, hrefDe, max = 6, hauteurMax = 230, hauteurMin = 120 }) {
  const router = useRouter();
  const ciel = cielDe(moment, saison);
  const alea = graine(immeubles.map((i) => i.id).join());
  const blocs = [];
  let x = 40;
  for (const im of immeubles.slice(0, max)) {
    const p = plan(im);
    blocs.push({ im, p, x });
    x += p.largeur + ESPACE;
  }
  const largeur = blocs.length ? Math.max(x - ESPACE + 40, 260) : 640; // sans immeuble : la rue seule, à l'échelle
  const hautMax = Math.max(120, ...blocs.map((b) => b.p.hauteur));
  const sol = hautMax + 16;
  const hauteur = sol + 22;
  // Entre les immeubles, puis sur les côtés, hors cadre
  const points = [
    ...blocs.slice(1).map((b) => b.x - ESPACE / 2),
    ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((i) => [20 - (i - 1) * 70, largeur - 20 + (i - 1) * 70]),
  ];
  return (
    <svg viewBox={`0 0 ${largeur} ${hauteur}`} preserveAspectRatio="xMidYMax meet" style={styleSvg(largeur, hauteur, hauteurMax, hauteurMin)} role="group" aria-label="Ta rue : chaque fenêtre est un logement">
      {defs}
      <Decor de={-2400} a={largeur + 2400} sol={sol} ciel={ciel} saison={saison} alea={alea} />
      <Plantations points={points} sol={sol} ciel={ciel} saison={saison} alea={alea} />
      {blocs.map((b) => <Immeuble key={b.im.id} im={b.im} p={b.p} x={b.x} sol={sol} ciel={ciel} saison={saison} infos={infos} href={hrefDe(b.im)} onOuvrir={(h) => router.push(h)} />)}
    </svg>
  );
}

// Un seul immeuble, dans son ciel (cartes et vignettes) ; sans lien
export function FacadeIllustree({ immeuble, infos, moment, saison, hauteur = 150, arrondi = 0 }) {
  const ciel = cielDe(moment, saison);
  const alea = graine(`${immeuble.id}-decor`);
  const p = plan(immeuble);
  const largeur = p.largeur + 80;
  const sol = p.hauteur + 26;
  const h = sol + 14;
  return (
    <div style={{ position: "relative", height: hauteur, overflow: "hidden", background: ciel.fond, borderRadius: arrondi }}>
      <svg viewBox={`0 0 ${largeur} ${h}`} preserveAspectRatio="xMidYMax meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} aria-hidden="true">
        {defs}
        <Decor de={-1600} a={largeur + 1600} sol={sol} ciel={ciel} saison={saison} alea={alea} />
        <Plantations points={[18, largeur - 18, -60, largeur + 60, -140, largeur + 140, -220, largeur + 220]} sol={sol} ciel={ciel} saison={saison} alea={alea} />
        <g style={{ pointerEvents: "none" }}>
          <Immeuble im={immeuble} p={p} x={40} sol={sol} ciel={ciel} saison={saison} infos={infos} href={undefined} />
        </g>
      </svg>
    </div>
  );
}

// Ciel du moment : dégradé, soleil ou lune, étoiles, nuages, neige qui tombe
export function CielIllustre({ moment, saison }) {
  const ciel = cielDe(moment, saison);
  const alea = graine(`ciel-${moment}`);
  const etoiles = moment === "nuit" ? Array.from({ length: 46 }, () => [alea() * 1000, alea() * 260, 0.5 + alea() * 1.3, 0.4 + alea() * 0.6]) : [];
  const nuages = moment === "jour" || moment === "matin" ? [[640, 40, 0.85], [905, 120, 0.6]] : [];
  const astre = {
    matin: { left: "66%", top: "58%", taille: 64, fond: "radial-gradient(circle, #fff6d8 0%, #ffd58a 55%, rgba(255,213,138,0) 72%)" },
    jour: { left: "82%", top: "12%", taille: 64, fond: "radial-gradient(circle, #fffbe8 0%, #ffe48a 50%, rgba(255,228,138,0) 72%)" },
    soir: { left: "78%", top: "58%", taille: 90, fond: "radial-gradient(circle, #ffe7b0 0%, #ffab5e 48%, rgba(255,140,80,0) 72%)" },
  }[moment];
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: ciel.fond, overflow: "hidden" }}>
      <svg viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {etoiles.map(([x, y, r, o], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={o} className={i % 5 === 0 ? "etoile-immo" : undefined} />)}
        {nuages.map(([x, y, o]) => (
          <g key={x} opacity={o} fill="#ffffff">
            <ellipse cx={x} cy={y} rx={46} ry={12} />
            <ellipse cx={x - 18} cy={y - 8} rx={22} ry={13} />
            <ellipse cx={x + 14} cy={y - 11} rx={26} ry={16} />
          </g>
        ))}
      </svg>
      {astre && <div style={{ position: "absolute", left: astre.left, top: astre.top, width: astre.taille, height: astre.taille, marginLeft: -astre.taille / 2, marginTop: -astre.taille / 2, borderRadius: "50%", background: astre.fond }} />}
      {moment === "nuit" && <div style={{ position: "absolute", left: "86%", top: 26, width: 34, height: 34, borderRadius: "50%", boxShadow: "inset 10px -5px 0 0 #f4eed4", filter: "drop-shadow(0 0 10px rgba(244,238,212,0.45))", transform: "rotate(-18deg)" }} />}
      {saison === "hiver" && <div className="neige-immo" />}
    </div>
  );
}
