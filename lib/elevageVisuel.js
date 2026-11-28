// Visuel de l'Élevage (déclinaison Ferme), sans base de données : le
// calendrier de l'éleveur (conseil du mois), l'état de chaque bête pour sa
// pastille dans la ferme illustrée (app/components/FermeIllustree.js) et
// l'ordre des bêtes au pâturage (chaque veau à côté de sa mère). Moment de
// la journée et saison : lib/immobilierVisuel.js (momentQuebec).

import { categorieBete, retraitEnCours, abattagePrevu, velagePrevu, dernierePesee, nomBete, libelle, CATEGORIES_TROUPEAU, kg, dateLisible } from "./elevageCalculs";

// Le calendrier d'un éleveur de bœuf au Québec : un rappel par mois
export const CONSEILS_MOIS_FERME = [
  { texte: "Plein hiver : vérifie les abreuvoirs chauffés et l'énergie de la ration ; le froid fait grimper les besoins du troupeau.", href: "/elevage", lien: "Troupeau" },
  { texte: "Les vêlages approchent : prépare le parc de vêlage, la litière sèche et du colostrum de réserve.", href: "/elevage", lien: "Troupeau" },
  { texte: "Saison des vêlages : pèse chaque veau, pose sa boucle et déclare sa naissance à Agri-Traçabilité Québec.", href: "/elevage/registre", lien: "Registre" },
  { texte: "Avant la mise à l'herbe : vaccins et vermifuges du printemps, et un tour des clôtures.", href: "/elevage", lien: "Troupeau" },
  { texte: "Mise à l'herbe : passe au pâturage graduellement pour éviter la météorisation, et note les déplacements d'enclos.", href: "/elevage/registre", lien: "Registre" },
  { texte: "Saillies : le taureau rejoint les vaches pour des vêlages au printemps prochain (environ 285 jours de gestation).", href: "/elevage", lien: "Troupeau" },
  { texte: "Saison des foins : fais les réserves de l'hiver et entre leur coût dans les frais des bêtes.", href: "/elevage", lien: "Troupeau" },
  { texte: "Pesées de fin d'été : compare le gain par jour des bouvillons à ta cible.", href: "/elevage", lien: "Troupeau" },
  { texte: "Sevrage des veaux du printemps : pèse-les le jour même, c'est le point de départ de leur courbe.", href: "/elevage", lien: "Troupeau" },
  { texte: "Retour à l'étable : vermifuge d'automne et confirmation de gestation des vaches saillies.", href: "/elevage", lien: "Troupeau" },
  { texte: "Les fêtes approchent : planifie les abattages pour avoir de la viande en boutique en décembre.", href: "/elevage/viande", lien: "Viande" },
  { texte: "Boutique des fêtes : mets en avant les coupes nobles et les boîtes-cadeaux de wagyu.", href: "/elevage/viande", lien: "Viande" },
];

// Pastille d'une bête dans la ferme illustrée, de la plus pressante à la plus calme
export const ETATS_BETE = {
  RETRAIT: { label: "Délai de retrait en cours", couleur: "#e5533f", signe: "!" },
  PRETE: { label: "Poids d'abattage atteint", couleur: "#f0b429", signe: "★" },
  GESTANTE: { label: "Gestante", couleur: "#e46fa5", signe: "♥" },
};

// État d'une bête au troupeau : RETRAIT, PRETE, GESTANTE ou null
export function etatBete(bete, poidsAbattage) {
  if (retraitEnCours(bete.soins)) return "RETRAIT";
  if (abattagePrevu(bete, poidsAbattage)?.atteint) return "PRETE";
  if ((bete.saillies || []).some((s) => s.statut === "GESTANTE")) return "GESTANTE";
  return null;
}

// Bêtes au troupeau dans l'ordre du pâturage (chaque veau juste après sa
// mère), avec { id, categorie, sexe, genetique, etat, texte }
export function betesPourFerme(betes, poidsAbattage) {
  const actives = betes.filter((b) => b.statut === "ACTIVE");
  const veauxDe = {};
  for (const b of actives) if (b.mereId && categorieBete(b) === "VEAU") (veauxDe[b.mereId] ||= []).push(b);
  const places = new Set();
  const ordre = [];
  const placer = (b) => {
    if (places.has(b.id)) return;
    places.add(b.id);
    ordre.push(b);
    for (const v of veauxDe[b.id] || []) placer(v);
  };
  for (const b of actives) if (!(b.mereId && veauxDe[b.mereId]?.includes(b) && actives.some((m) => m.id === b.mereId))) placer(b);
  for (const b of actives) placer(b);
  return ordre.map((b) => {
    const categorie = categorieBete(b);
    const etat = etatBete(b, poidsAbattage);
    const pesee = dernierePesee(b.pesees);
    const gestation = (b.saillies || []).find((s) => s.statut === "GESTANTE");
    return {
      id: b.id, categorie, sexe: b.sexe, genetique: b.genetique, mereId: b.mereId, etat,
      texte: [
        nomBete(b), libelle(CATEGORIES_TROUPEAU, categorie).replace(/s$/, "").toLowerCase(), pesee && kg(pesee.poids, 0),
        gestation && `vêlage prévu le ${dateLisible(velagePrevu(gestation.date))}`, etat && etat !== "GESTANTE" && ETATS_BETE[etat].label.toLowerCase(),
      ].filter(Boolean).join(" · "),
    };
  });
}

// Prochain vêlage prévu parmi les vaches gestantes : { bete, date, jours } ou null
export function prochainVelage(betes, maintenant = new Date()) {
  let meilleur = null;
  for (const b of betes) {
    if (b.statut !== "ACTIVE") continue;
    for (const s of b.saillies || []) {
      if (s.statut !== "GESTANTE") continue;
      const date = velagePrevu(s.date);
      const jours = Math.ceil((date - maintenant) / 86400000);
      if (jours >= -7 && (!meilleur || date < meilleur.date)) meilleur = { bete: b, date, jours };
    }
  }
  return meilleur;
}

// Troupeau représentatif pour la ferme illustrée, quand il compte plus de
// bêtes que la scène n'en montre lisiblement (quelques centaines) : d'abord
// celles qui ont une pastille (retrait, abattage, gestation — jusqu'à la
// moitié des places), puis les autres catégories dans leur proportion du
// troupeau (au moins une de chaque), dans l'ordre du pâturage (le veau suit
// sa mère quand les deux sont retenus). liste : betesPourFerme().
// → { visibles, autres }
export function echantillonFerme(liste, max = 36) {
  if (liste.length <= max) return { visibles: liste, autres: 0 };
  const retenus = new Set();
  for (const b of liste) if (b.etat && retenus.size < Math.floor(max / 2)) retenus.add(b.id);
  const reste = liste.filter((b) => !retenus.has(b.id));
  const places = max - retenus.size;
  const parCategorie = {};
  for (const b of reste) parCategorie[b.categorie] = (parCategorie[b.categorie] || 0) + 1;
  const quotas = Object.fromEntries(Object.entries(parCategorie).map(([c, n]) => [c, Math.max(1, Math.round((n / reste.length) * places))]));
  for (const b of reste) {
    if (retenus.size >= max) break;
    if (quotas[b.categorie] > 0) {
      retenus.add(b.id);
      quotas[b.categorie] -= 1;
    }
  }
  const visibles = liste.filter((b) => retenus.has(b.id));
  return { visibles, autres: liste.length - visibles.length };
}
