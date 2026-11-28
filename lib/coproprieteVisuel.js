// Visuel de la Copropriété, sans base de données : le calendrier du syndicat
// (conseil du mois), l'état de chaque unité pour sa fenêtre dans la rue
// illustrée (app/components/RueIllustree.js) et les bâtiments mis en
// immeubles « CONDO » pour la dessiner. Moment de la journée et saison :
// lib/immobilierVisuel.js (momentQuebec).

// Le calendrier d'un syndicat de copropriété au Québec : un rappel par mois
export const CONSEILS_MOIS_COPRO = [
  { texte: "Début d'année : relis le carnet d'entretien et planifie les travaux à financer par le fonds de prévoyance.", href: "/copropriete/entretien", lien: "Entretien" },
  { texte: "Exercice terminé le 31 décembre ? L'assemblée annuelle doit se tenir dans les six mois : prépare les états financiers et l'avis de convocation.", href: "/copropriete/documents", lien: "Documents" },
  { texte: "Fin de l'hiver : fais laver le stationnement intérieur ; le calcium ronge le béton et les armatures.", href: "/copropriete/entretien", lien: "Entretien" },
  { texte: "Inspection de printemps des parties communes après le dégel : toiture, solins, drains de toit, fondation.", href: "/copropriete/entretien", lien: "Entretien" },
  { texte: "Assurance : l'immeuble doit être assuré pour sa valeur de reconstruction, évaluée par un évaluateur agréé au moins tous les cinq ans.", href: "/copropriete/documents", lien: "Documents" },
  { texte: "Avant les vacances : fais vérifier l'alarme incendie, les gicleurs et l'éclairage d'urgence selon le calendrier d'entretien.", href: "/copropriete/entretien", lien: "Entretien" },
  { texte: "Déménagements du 1er juillet : rappelle les règles d'usage de l'ascenseur et protège les corridors.", href: "/copropriete/documents", lien: "Documents" },
  { texte: "Prépare le budget du prochain exercice avec le conseil : charges courantes, fonds de prévoyance et fonds d'autoassurance.", href: "/copropriete/finances", lien: "Charges" },
  { texte: "L'étude du fonds de prévoyance est à refaire aux cinq ans : vérifie la date de la dernière et ce qu'elle recommande.", href: "/copropriete/finances", lien: "Charges" },
  { texte: "Avant le gel : gouttières et drains de toit nettoyés, robinets extérieurs fermés, contrat de déneigement prêt.", href: "/copropriete/entretien", lien: "Entretien" },
  { texte: "L'hiver arrive : vérifie le chauffage des parties communes, la porte de garage et l'éclairage des entrées.", href: "/copropriete/entretien", lien: "Entretien" },
  { texte: "Fin d'exercice qui approche : rassemble factures et relevés pour les états financiers du syndicat.", href: "/copropriete/finances", lien: "Charges" },
];

// Nom des états d'une unité dans la légende
export const ETATS_UNITE = {
  OK: "Cotisations à jour",
  SURVEILLER: "Demande en cours",
  RETARD: "Cotisations en retard",
  SANS: "Sans propriétaire inscrit",
};

// État d'une unité : en retard si elle doit plus que les charges du mois en
// cours ; une demande de réparation ouverte ; aucun propriétaire inscrit
export function etatUnite({ solde = 0, duCeMois = 0, demandes = 0, proprietaires = 1 }) {
  if (solde - duCeMois > 0.005) return "RETARD";
  if (demandes > 0) return "SURVEILLER";
  if (proprietaires === 0) return "SANS";
  return "OK";
}

// Bâtiments mis en immeubles pour la rue : { id, nom, type: "CONDO",
// adresse, photo, logements: unités } ; les unités sans bâtiment forment un
// immeuble à part (ou le seul, s'il n'y a aucun bâtiment)
export function batimentsPourRue(batiments, unites, nomParDefaut = "La copropriété") {
  const unite = (u) => ({ id: u.id, numero: u.numero, type: u.type, etage: u.etage });
  const liste = batiments.map((b) => ({ ...b, type: "CONDO", logements: unites.filter((u) => u.batimentId === b.id).map(unite) }));
  const seules = unites.filter((u) => !u.batimentId || !batiments.some((b) => b.id === u.batimentId));
  if (seules.length > 0) liste.push({ id: "sans-batiment", nom: batiments.length ? "Autres unités" : nomParDefaut, type: "CONDO", logements: seules.map(unite) });
  return liste;
}
