// Raisons pour lesquelles un employé reçoit une notification — sans
// dépendance au serveur, donc utilisables aussi dans le navigateur (page
// Notifications). L'envoi lui-même : voir lib/notifications.js.
//
// Chaque avis va :
//  - aux personnes concernées (concerne) — l'employé à qui le bon est
//    envoyé, ceux qui ont travaillé sur le bon… ;
//  - et/ou aux rôles choisis (parRole) dans Notifications → « Qui reçoit
//    quoi », par le niveau 4 seulement — rolesDefaut tant que rien n'y est
//    changé.
// Le niveau 4 peut aussi couper un type pour lui-même, sauf s'il est
// obligatoire ; les autres reçoivent tout ce qui leur est destiné, sans voir
// ces choix.

const TYPES_NOTIFICATIONS = {
  BON_ENVOYE: {
    icone: "🚐",
    label: "Bon qui m'est envoyé",
    description: "Un bon t'est envoyé (Jobs en déplacement).",
    concerne: "L'employé à qui le bon est envoyé",
    obligatoire: true,
  },
  BON_MODIFIE: {
    icone: "🔧",
    label: "Tâche ajoutée à un bon",
    description: "Une tâche est ajoutée à un bon sur lequel tu as travaillé ou qui t'est envoyé.",
    concerne: "Les employés qui ont du temps sur le bon ou à qui il est envoyé",
  },
  PIECES_RECUES: {
    icone: "📦",
    label: "Pièces reçues pour un bon",
    description: "Une commande de pièces est reçue avec des pièces qu'un bon attendait.",
    concerne: "Les employés qui ont du temps sur le bon ou à qui il est envoyé",
    parRole: true,
    rolesDefaut: [],
  },
  BON_TERMINE: {
    icone: "✅",
    label: "Job terminée — bon à facturer",
    description: "Un employé marque terminé un bon qui lui a été envoyé.",
    parRole: true,
    rolesDefaut: ["SECRETAIRE", "GERANT", "NIVEAU4"],
  },
  RENDEZVOUS_WEB: {
    icone: "📅",
    label: "Rendez-vous pris en ligne",
    description: "Un client réserve un rendez-vous sur le site, ou l'annule.",
    parRole: true,
    rolesDefaut: ["SECRETAIRE", "GERANT", "NIVEAU4"],
  },
  SOUMISSION_REPONSE: {
    icone: "✍️",
    label: "Soumission approuvée ou refusée en ligne",
    description: "Un client approuve (et signe) ou refuse sa soumission depuis le lien reçu.",
    parRole: true,
    rolesDefaut: ["SECRETAIRE", "GERANT", "NIVEAU4"],
  },
  INSPECTION_REPONSE: {
    icone: "🔎",
    label: "Rapport d'inspection approuvé ou refusé en ligne",
    description: "Un client approuve (et signe) des travaux recommandés de son rapport d'inspection, ou répond « pas maintenant ».",
    parRole: true,
    rolesDefaut: ["SECRETAIRE", "GERANT", "NIVEAU4"],
  },
  PAIEMENT_EN_LIGNE: {
    icone: "💳",
    label: "Paiement en ligne reçu",
    description: "Un client paie une facture ou verse un dépôt en ligne (Stripe) — ou un paiement reçu doit être traité à la main.",
    parRole: true,
    rolesDefaut: ["SECRETAIRE", "GERANT", "NIVEAU4"],
  },
  TEXTO_RECU: {
    icone: "💬",
    label: "Texto reçu d'un client",
    description: "Un client répond par texto (module Textos automatiques) ; la conversation s'ouvre dans la page Textos.",
    parRole: true,
    rolesDefaut: ["SECRETAIRE", "GERANT", "NIVEAU4"],
  },
  STOCK_BAS: {
    icone: "📉",
    label: "Pièces sous le seuil",
    description: "Une pièce tombe à son seuil minimum ou sous lui, sans rien en commande pour la remonter.",
    parRole: true,
    rolesDefaut: ["GERANT", "NIVEAU4"],
  },
  COMPTE_A_PAYER: {
    icone: "💵",
    label: "Compte à payer bientôt dû",
    description: "Une facture fournisseur impayée arrive à échéance dans 3 jours ou moins.",
    parRole: true,
    rolesDefaut: ["GERANT", "NIVEAU4"],
  },
  DEMANDE_COPRO: {
    icone: "🏢",
    label: "Demande d'un copropriétaire",
    description: "Un copropriétaire fait une demande de réparation ou signale un problème depuis son portail (module Copropriété).",
    parRole: true,
    rolesDefaut: ["SECRETAIRE", "GERANT", "NIVEAU4"],
  },
  DEMANDE_IMMO: {
    icone: "🏘️",
    label: "Demande d'un locataire",
    description: "Un locataire fait une demande de réparation ou répond à un avis de modification du bail depuis son portail (module Immobilier).",
    parRole: true,
    rolesDefaut: ["SECRETAIRE", "GERANT", "NIVEAU4"],
  },
  IMMO_A_SURVEILLER: {
    icone: "🏘️",
    label: "Immobilier : baux et loyers à surveiller",
    description: "Une fois par jour au plus (module Immobilier, Automatisations) : période d'avis de modification qui s'ouvre ou finit bientôt, avis sans réponse, refus à porter au TAL, bail échu ou à renouveler, loyer en retard de plus de trois semaines, entretien préventif en retard ou à venir, assurance ou contrat qui expire — et ce que les automatisations ont fait (loyers inscrits, rappels envoyés).",
    parRole: true,
    rolesDefaut: ["GERANT", "NIVEAU4"],
  },
  MESSAGE: {
    icone: "📣",
    label: "Message du gérant",
    description: "Un message envoyé à la main par un gérant.",
    concerne: "Les employés choisis à l'envoi",
    obligatoire: true,
  },
  POINCON_OUBLIE: {
    icone: "⏱️",
    label: "Poinçon oublié",
    description: "Une heure après la fermeture, l'employé encore poinçonné reçoit un rappel d'arrêter son poinçon.",
    concerne: "L'employé encore poinçonné",
    obligatoire: true,
  },
  RAPPEL_CEDULE: {
    icone: "⏰",
    label: "Notification cédulée",
    description: "Un rappel envoyé tout seul à l'heure choisie (ex. début et fin du break ou du dîner).",
    concerne: "Les employés choisis dans la notification cédulée",
    obligatoire: true,
  },
};

// Notifications cédulées (voir lib/notificationsCedulees.js)
const FREQUENCES_CEDULEES = {
  QUOTIDIEN: "Chaque jour",
  SEMAINE: "Du lundi au vendredi",
  JOURS: "Jours choisis",
  UNE_FOIS: "Une seule fois",
};
const JOURS_SEMAINE = { lun: "Lun", mar: "Mar", mer: "Mer", jeu: "Jeu", ven: "Ven", sam: "Sam", dim: "Dim" };

module.exports = { TYPES_NOTIFICATIONS, FREQUENCES_CEDULEES, JOURS_SEMAINE };
