// Visuel du garage (modèle de base et VR Premium), sans base de données : le
// calendrier de l'atelier (conseil du mois) et les véhicules de la journée
// pour l'atelier illustré de la Vue d'ensemble (app/components/AtelierIllustre.js).
// Moment de la journée et saison : lib/immobilierVisuel.js (momentQuebec).

// Le calendrier d'un garage au Québec : un rappel par mois (pneus d'hiver
// obligatoires du 1er décembre au 15 mars, Code de la sécurité routière)
export const CONSEILS_MOIS_GARAGE = [
  { texte: "Mois plus tranquille : bon moment pour compter l'inventaire et envoyer les rappels d'entretien.", href: "/secretaire/inventaire", lien: "Inventaire" },
  { texte: "Le froid use les batteries et les démarreurs : propose un test de batterie à chaque visite.", href: "/secretaire", lien: "Bons" },
  { texte: "Les pneus d'hiver restent obligatoires jusqu'au 15 mars : ouvre déjà l'horaire des changements d'avril.", href: "/secretaire/calendrier", lien: "Calendrier" },
  { texte: "Saison des changements de pneus : rappelle les clients dont les pneus sont entreposés chez toi.", href: "/secretaire/calendrier", lien: "Calendrier" },
  { texte: "Nids-de-poule du printemps : propose l'alignement et l'inspection de la suspension.", href: "/secretaire", lien: "Bons" },
  { texte: "Avant les vacances : inspection et climatisation — les clients partent sur la route.", href: "/secretaire/calendrier", lien: "Calendrier" },
  { texte: "Vacances de la construction : planifie l'horaire de l'équipe et les rendez-vous de la fin juillet.", href: "/secretaire/calendrier", lien: "Calendrier" },
  { texte: "Rentrée : relance les clients sans visite depuis six mois avec un rappel d'entretien.", href: "/secretaire/clients", lien: "Clients" },
  { texte: "Prépare la saison des pneus : stock de pneus d'hiver et horaire des rendez-vous d'octobre.", href: "/secretaire/inventaire", lien: "Inventaire" },
  { texte: "Pneus d'hiver obligatoires au Québec du 1er décembre au 15 mars : remplis l'horaire des changements.", href: "/secretaire/calendrier", lien: "Calendrier" },
  { texte: "Dernier mois avant le 1er décembre : relance les clients qui n'ont pas encore leurs pneus d'hiver.", href: "/secretaire/clients", lien: "Clients" },
  { texte: "Fin d'année : facture les bons terminés et prépare la remise de TPS et de TVQ.", href: "/secretaire", lien: "Bons" },
];

// Le calendrier d'un atelier de VR au Québec (profil typeVehicules « vr ») :
// mises en service au printemps, hivernisation à l'automne
export const CONSEILS_MOIS_VR = [
  { texte: "Saison des salons du VR : prépare tes promotions et l'arrivée des unités du printemps.", href: "/secretaire/inventaire/vehicules", lien: "VR à vendre" },
  { texte: "Ouvre l'horaire des mises en service du printemps : les rendez-vous d'avril partent vite.", href: "/secretaire/calendrier", lien: "Calendrier" },
  { texte: "Passe voir les VR en entreposage : batteries chargées et aucune infiltration sous la neige.", href: "/secretaire", lien: "Bons" },
  { texte: "Mises en service : purge de l'antigel, test d'étanchéité, propane, batteries et freins.", href: "/secretaire", lien: "Bons" },
  { texte: "Avant les premiers départs : freins électriques, roulements et âge des pneus à vérifier.", href: "/secretaire", lien: "Bons" },
  { texte: "Haute saison : garde en stock les pièces d'usage courant — fusibles, scellants, ampoules, raccords.", href: "/secretaire/inventaire", lien: "Inventaire" },
  { texte: "Les clients sont sur la route : priorise les dépannages, un bris gâche les vacances.", href: "/secretaire", lien: "Bons" },
  { texte: "Prépare l'automne : ouvre l'horaire d'hivernisation et propose l'entreposage.", href: "/secretaire/calendrier", lien: "Calendrier" },
  { texte: "Fin de saison : bon moment pour inspecter les scellants de toit avant la pluie et la neige.", href: "/secretaire", lien: "Bons" },
  { texte: "Hivernisation : antigel dans la plomberie, réservoirs vidés, batteries retirées ou sur chargeur.", href: "/secretaire", lien: "Bons" },
  { texte: "Dernières hivernisations avant le gel : relance les clients qui ne sont pas encore passés.", href: "/secretaire/clients", lien: "Clients" },
  { texte: "Fin d'année : facture les bons terminés, prépare la remise de TPS et de TVQ et le stock du printemps.", href: "/secretaire", lien: "Bons" },
];

// Pastille d'un véhicule dans l'atelier illustré
export const ETATS_VEHICULE = {
  TRAVAIL: { label: "En réparation, chrono en marche", couleur: "#2f7fd6" },
  COURS: { label: "Bon en cours", couleur: "#7aa7d9" },
  ATTENTE: { label: "En attente", couleur: "#f0a429" },
  PRET: { label: "Prêt, client avisé", couleur: "#3fae5a" },
  VENTE: { label: "À vendre", couleur: "#d4a017" },
};

const nomVehicule = (v) => [v?.marque, v?.modele, v?.annee].filter(Boolean).join(" ");

// Véhicules de la journée à partir des bons pas encore facturés : ceux en
// cours dans les portes (chrono en marche d'abord), les autres dans la cour.
// bons : [{ id, numero, statut, avisPretLe, vehicule, client }] ; enChrono :
// { [bonId]: [noms des employés au chrono] } → { portes, cour }
export function vehiculesAtelier(bons, enChrono = {}) {
  const v = bons.map((b) => {
    const etat = b.statut === "EN_ATTENTE" ? "ATTENTE" : enChrono[b.id]?.length ? "TRAVAIL" : b.avisPretLe ? "PRET" : "COURS";
    const qui = enChrono[b.id]?.join(", ");
    return {
      id: b.id, etat, cle: b.vehicule?.id || b.id,
      texte: [`Bon ${b.numero}`, nomVehicule(b.vehicule), b.client?.nom, ETATS_VEHICULE[etat].label.toLowerCase(), qui && `au travail : ${qui}`].filter(Boolean).join(" · "),
    };
  });
  const rang = { TRAVAIL: 0, COURS: 1, PRET: 2, ATTENTE: 3 };
  v.sort((a, b) => rang[a.etat] - rang[b.etat]);
  return { portes: v.filter((x) => x.etat === "TRAVAIL" || x.etat === "COURS"), cour: v.filter((x) => x.etat === "PRET" || x.etat === "ATTENTE") };
}

// Disposition de l'atelier dans une scène, pour un garage de quelques bons
// comme d'une vingtaine : les bons en cours aux portes (chrono en marche
// d'abord) ; ceux qui n'y ont pas de place attendent leur tour dans la cour,
// entre les prêts (près de la porte) et ceux en attente. La cour prend une
// deuxième rangée, devant, quand elle déborde d'une. Au-delà de deux
// rangées, chaque état garde sa part (tour à tour). { portes, cour } :
// vehiculesAtelier() → { portes, fond, devant, cachees }
export function dispositionAtelier({ portes, cour }, { maxPortes = 6, maxParRangee = 6 } = {}) {
  const groupes = [cour.filter((v) => v.etat === "PRET"), portes.slice(maxPortes), cour.filter((v) => v.etat !== "PRET")];
  const total = groupes.reduce((n, g) => n + g.length, 0);
  const places = maxParRangee * 2;
  const pris = groupes.map((g) => g.length);
  if (total > places) {
    pris.fill(0);
    for (let n = 0; n < places;) {
      for (let i = 0; i < groupes.length && n < places; i += 1) {
        if (pris[i] < groupes[i].length) { pris[i] += 1; n += 1; }
      }
    }
  }
  const dehors = groupes.flatMap((g, i) => g.slice(0, pris[i]));
  const fond = dehors.length > maxParRangee ? dehors.slice(0, Math.ceil(dehors.length / 2)) : dehors;
  return { portes: portes.slice(0, maxPortes), fond, devant: dehors.slice(fond.length), cachees: total - dehors.length };
}

// Véhicules à vendre de l'entreprise (profil vehiculesAVendre), en stock :
// [{ id, numero, prixDemande, vehicule }] → pour la cour de vente de l'atelier
export function vehiculesAVendrePourAtelier(liste) {
  const prix = (n) => `${Math.round(n || 0).toLocaleString("fr-CA")} $`;
  return liste.map((v) => ({
    id: v.id, etat: "VENTE", cle: v.vehicule?.id || v.id, prix: v.prixDemande > 0 ? prix(v.prixDemande) : null,
    texte: [v.numero, nomVehicule(v.vehicule), v.prixDemande > 0 && `${prix(v.prixDemande)} demandé`, "à vendre"].filter(Boolean).join(" · "),
  }));
}
