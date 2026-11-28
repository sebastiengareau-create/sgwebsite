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

// Pastille d'un véhicule dans l'atelier illustré
export const ETATS_VEHICULE = {
  TRAVAIL: { label: "En réparation, chrono en marche", couleur: "#2f7fd6" },
  COURS: { label: "Bon en cours", couleur: "#7aa7d9" },
  ATTENTE: { label: "En attente", couleur: "#f0a429" },
  PRET: { label: "Prêt, client avisé", couleur: "#3fae5a" },
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
