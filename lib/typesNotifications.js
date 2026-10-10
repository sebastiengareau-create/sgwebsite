// Raisons pour lesquelles un employé reçoit une notification — sans
// dépendance au serveur, donc utilisables aussi dans le navigateur (page
// Notifications). L'envoi lui-même : voir lib/notifications.js.
//
// Chaque avis va :
//  - aux personnes concernées (concerne) — l'employé à qui le bon est
//    envoyé, ceux qui ont travaillé sur le bon… ;
//  - et/ou aux rôles choisis (parRole) dans Notifications → « Qui reçoit
//    quoi », par ceux qui ont la section « Notifications » (Administrateur →
//    Rôles et accès, gérant par défaut) — rolesDefaut tant que rien n'y est
//    changé.
// Un employé peut couper un type pour lui-même, sauf s'il est obligatoire.

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
  MESSAGE: {
    icone: "📣",
    label: "Message du gérant",
    description: "Un message envoyé à la main par un gérant.",
    concerne: "Les employés choisis à l'envoi",
    obligatoire: true,
  },
};

module.exports = { TYPES_NOTIFICATIONS };
