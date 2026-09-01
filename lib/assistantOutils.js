const { prisma } = require("./prisma");
const { aAccesSection, estGerantOuDev } = require("./auth");
const { dateAujourdhuiQuebec, limitesJourQuebec } = require("./temps");

// Chaque outil est décrit deux fois : sa "declaration" (le schéma envoyé à
// Gemini pour qu'il sache quand et comment l'appeler) et sa fonction
// "executer" (la vraie requête Prisma). "permis" détermine qui a le droit de
// l'utiliser — la plupart suivent aAccesSection (comme le reste du logiciel),
// mais certains (coordonnées des employés) suivent plutôt estGerantOuDev,
// exactement comme la page /gerant/employes qui les protège déjà.

async function rechercherClient(session, { nom } = {}) {
  if (!(await aAccesSection(session, "clients"))) {
    return { erreur: "Accès refusé à la section Clients pour cet employé." };
  }
  if (!nom) return { erreur: "Nom de client manquant." };

  const clients = await prisma.client.findMany({
    where: { nom: { contains: nom, mode: "insensitive" } },
    take: 10,
  });

  return {
    clients: clients.map((c) => ({
      nom: c.nom,
      telephone: c.telephone || null,
      courriel: c.courriel || null,
      adresse: c.adresse || null,
      ville: c.ville || null,
      codePostal: c.codePostal || null,
    })),
  };
}

// Reprend exactement la logique du rapport "Comptes clients" (voir
// app/gerant/comptabilite/rapports/comptes-clients/page.js) : une facture
// impayée est en retard depuis (maintenant - dateEmission), en jours.
async function comptesRecevoir(session, { joursMin } = {}) {
  if (!(await aAccesSection(session, "comptabilite"))) {
    return { erreur: "Accès refusé à la section Comptabilité pour cet employé." };
  }
  const seuil = Number(joursMin) || 30;

  const factures = await prisma.facture.findMany({
    where: { statut: "IMPAYEE" },
    include: { bon: { include: { client: true } } },
    orderBy: { dateEmission: "asc" },
  });

  const maintenant = new Date();
  const comptesEnRetard = [];
  for (const f of factures) {
    const joursDeRetard = Math.floor((maintenant - new Date(f.dateEmission)) / 86400000);
    if (joursDeRetard >= seuil) {
      comptesEnRetard.push({ client: f.bon.client.nom, facture: f.numero, joursDeRetard, montant: f.totalAvecTaxes });
    }
  }

  return { seuilJours: seuil, comptesEnRetard, totalDu: comptesEnRetard.reduce((s, c) => s + c.montant, 0) };
}

// Reprend le patron du tableau de bord gérant (app/gerant/page.js) : un
// poinçon actif = une entrée de temps (sur une tâche ou une tâche interne)
// dont "fin" est encore null.
async function employesEnTravail(session) {
  if (!(await aAccesSection(session, "operations"))) {
    return { erreur: "Accès refusé à la section Opérations pour cet employé." };
  }

  const [actifs, actifsInternes] = await Promise.all([
    prisma.entreeTemps.findMany({
      where: { fin: null },
      include: { employe: true, probleme: { include: { bon: { include: { client: true } } } } },
    }),
    prisma.entreeTempsInterne.findMany({
      where: { fin: null },
      include: { employe: true, tacheInterne: true },
    }),
  ]);

  const employesEnTravailListe = [
    ...actifs.map((e) => ({
      employe: e.employe.nom,
      tache: e.probleme.description,
      bon: e.probleme.bon?.numero || null,
      client: e.probleme.bon?.client?.nom || null,
      depuis: e.debut,
    })),
    ...actifsInternes.map((e) => ({
      employe: e.employe.nom,
      tache: e.tacheInterne.nom,
      tacheInterne: true,
      depuis: e.debut,
    })),
  ];

  return { employesEnTravail: employesEnTravailListe, total: employesEnTravailListe.length };
}

async function chercherBonTravail(session, { numero, clientNom } = {}) {
  if (!(await aAccesSection(session, "operations"))) {
    return { erreur: "Accès refusé à la section Opérations pour cet employé." };
  }
  if (!numero && !clientNom) return { erreur: "Précise un numéro de bon ou un nom de client." };

  const where = {};
  if (numero) where.numero = { contains: numero, mode: "insensitive" };
  if (clientNom) where.client = { nom: { contains: clientNom, mode: "insensitive" } };

  const bons = await prisma.bonTravail.findMany({
    where,
    include: { client: true, problemes: true },
    orderBy: { creeLe: "desc" },
    take: 10,
  });

  return {
    bons: bons.map((b) => ({
      numero: b.numero,
      statut: b.statut,
      client: b.client.nom,
      problemes: b.problemes.map((p) => p.description),
      creeLe: b.creeLe,
    })),
  };
}

async function inventairePiece(session, { nom } = {}) {
  if (!(await aAccesSection(session, "inventaire"))) {
    return { erreur: "Accès refusé à la section Inventaire pour cet employé." };
  }
  if (!nom) return { erreur: "Nom de pièce manquant." };

  const pieces = await prisma.piece.findMany({
    where: { nom: { contains: nom, mode: "insensitive" } },
    take: 10,
  });

  return {
    pieces: pieces.map((p) => ({
      nom: p.nom,
      numero: p.numero,
      qteEnStock: p.qte,
      seuilMinimum: p.qteMin,
      sousLeSeuil: p.qte <= p.qteMin,
      prix: p.prix,
    })),
  };
}

async function rendezVousDuJour(session, { date } = {}) {
  if (!(await aAccesSection(session, "calendrier"))) {
    return { erreur: "Accès refusé à la section Calendrier pour cet employé." };
  }
  const dateStr = date || dateAujourdhuiQuebec();
  const { debut, fin } = limitesJourQuebec(dateStr);

  const rendezVous = await prisma.rendezVous.findMany({
    where: { date: { gte: debut, lte: fin }, statut: { not: "ANNULE" } },
    orderBy: { date: "asc" },
  });

  return {
    date: dateStr,
    rendezVous: rendezVous.map((r) => ({
      heure: r.date,
      client: r.clientNom,
      telephone: r.clientTelephone || null,
      vehicule: r.vehiculeInfo || null,
      motif: r.motif,
      statut: r.statut,
    })),
  };
}

// Coordonnées des employés (adresse, courriel, téléphone) — mêmes données
// que la fiche employé sur /gerant/employes, protégée par estGerantOuDev
// là-bas, donc protégée pareil ici (pas de section "employes" dans le
// système de permissions, cette page-là a toujours été gérant seulement).
async function rechercherEmploye(session, { nom } = {}) {
  if (!estGerantOuDev(session)) {
    return { erreur: "Accès refusé — seul le gérant peut consulter les coordonnées des employés." };
  }
  if (!nom) return { erreur: "Nom d'employé manquant." };

  const employes = await prisma.user.findMany({
    where: { nom: { contains: nom, mode: "insensitive" } },
    take: 10,
  });

  return {
    employes: employes.map((e) => ({
      nom: e.nom,
      role: e.role,
      courriel: e.courriel,
      telephone: e.telephone || null,
      adresse: e.adresse || null,
      actif: e.actif,
    })),
  };
}

// Pages que l'assistant peut ouvrir pour l'employé sur demande ("ouvre la
// paie", "va dans l'inventaire"...). Chaque page revérifie exactement la
// même condition que son propre fichier page.js — voir les fichiers cités.
const PAGES_NAVIGABLES = {
  tableauDeBordGerant: { url: "/gerant", permis: (s) => estGerantOuDev(s) },
  paie: { url: "/gerant/paie", permis: (s) => aAccesSection(s, "paie") }, // app/gerant/paie/page.js
  employes: { url: "/gerant/employes", permis: (s) => estGerantOuDev(s) }, // app/gerant/employes/page.js
  administrateur: { url: "/gerant/administrateur", permis: (s) => estGerantOuDev(s) },
  comptabilite: { url: "/gerant/comptabilite", permis: (s) => aAccesSection(s, "comptabilite") },
  rapports: { url: "/gerant/rapports", permis: (s) => estGerantOuDev(s) },
  clients: { url: "/secretaire/clients", permis: (s) => aAccesSection(s, "clients") },
  inventaire: { url: "/secretaire/inventaire", permis: (s) => aAccesSection(s, "inventaire") },
  calendrier: { url: "/secretaire/calendrier", permis: (s) => aAccesSection(s, "calendrier") },
  factures: { url: "/secretaire/factures", permis: (s) => aAccesSection(s, "operations") },
  bonsDeTravail: { url: "/secretaire", permis: (s) => aAccesSection(s, "operations") },
  nouveauBon: { url: "/secretaire/nouveau", permis: (s) => aAccesSection(s, "operations") },
  soumissions: { url: "/secretaire/operations/soumissions", permis: (s) => aAccesSection(s, "operations") },
};

async function ouvrirPage(session, { page } = {}) {
  const cible = PAGES_NAVIGABLES[page];
  if (!cible) return { erreur: "Cette page n'est pas reconnue." };
  if (!(await cible.permis(session))) return { erreur: "Accès refusé à cette page pour cet employé." };
  return { url: cible.url };
}

const OUTILS = [
  {
    permis: (s) => aAccesSection(s, "clients"),
    executer: rechercherClient,
    declaration: {
      name: "rechercherClient",
      description: "Recherche un ou des clients par nom (recherche partielle) et retourne leurs coordonnées (téléphone, courriel, adresse).",
      parameters: {
        type: "OBJECT",
        properties: { nom: { type: "STRING", description: "Nom ou partie du nom du client à rechercher" } },
        required: ["nom"],
      },
    },
  },
  {
    permis: (s) => aAccesSection(s, "comptabilite"),
    executer: comptesRecevoir,
    declaration: {
      name: "comptesRecevoir",
      description: "Retourne la liste des factures impayées dont le retard dépasse un seuil de jours (comptes à recevoir en retard), avec le montant dû par client.",
      parameters: {
        type: "OBJECT",
        properties: { joursMin: { type: "NUMBER", description: "Nombre minimum de jours de retard à considérer (défaut 30 si non précisé)" } },
      },
    },
  },
  {
    permis: (s) => aAccesSection(s, "operations"),
    executer: employesEnTravail,
    declaration: {
      name: "employesEnTravail",
      description: "Retourne la liste des employés actuellement poinçonnés (au travail en ce moment) et sur quelle tâche chacun travaille.",
      parameters: { type: "OBJECT", properties: {} },
    },
  },
  {
    permis: (s) => aAccesSection(s, "operations"),
    executer: chercherBonTravail,
    declaration: {
      name: "chercherBonTravail",
      description: "Recherche un ou des bons de travail par numéro (partiel) et/ou nom de client, retourne leur statut, client et la liste des problèmes/tâches.",
      parameters: {
        type: "OBJECT",
        properties: {
          numero: { type: "STRING", description: "Numéro (ou partie du numéro) du bon de travail" },
          clientNom: { type: "STRING", description: "Nom (ou partie du nom) du client" },
        },
      },
    },
  },
  {
    permis: (s) => aAccesSection(s, "inventaire"),
    executer: inventairePiece,
    declaration: {
      name: "inventairePiece",
      description: "Recherche une pièce d'inventaire par nom, retourne sa quantité en stock, son seuil minimum et son prix de vente.",
      parameters: {
        type: "OBJECT",
        properties: { nom: { type: "STRING", description: "Nom (ou partie du nom) de la pièce à rechercher" } },
        required: ["nom"],
      },
    },
  },
  {
    permis: (s) => aAccesSection(s, "calendrier"),
    executer: rendezVousDuJour,
    declaration: {
      name: "rendezVousDuJour",
      description: "Retourne les rendez-vous prévus pour une journée donnée (aujourd'hui si aucune date n'est précisée).",
      parameters: {
        type: "OBJECT",
        properties: { date: { type: "STRING", description: "Date au format AAAA-MM-JJ — laisser vide pour aujourd'hui" } },
      },
    },
  },
  {
    permis: (s) => estGerantOuDev(s),
    executer: rechercherEmploye,
    declaration: {
      name: "rechercherEmploye",
      description: "Recherche un employé par nom et retourne ses coordonnées (adresse, courriel, téléphone) et son rôle. Réservé au gérant.",
      parameters: {
        type: "OBJECT",
        properties: { nom: { type: "STRING", description: "Nom (ou partie du nom) de l'employé à rechercher" } },
        required: ["nom"],
      },
    },
  },
  {
    permis: async () => true, // chaque page vérifie elle-même sa propre permission, voir PAGES_NAVIGABLES
    executer: ouvrirPage,
    declaration: {
      name: "ouvrirPage",
      description: "Ouvre (navigue vers) une page précise du logiciel pour l'employé. Utilise cet outil seulement quand l'employé demande explicitement d'ouvrir/aller à une page (ex: \"ouvre la paie\", \"va dans l'inventaire\").",
      parameters: {
        type: "OBJECT",
        properties: { page: { type: "STRING", enum: Object.keys(PAGES_NAVIGABLES), description: "Identifiant de la page à ouvrir" } },
        required: ["page"],
      },
    },
  },
];

module.exports = { OUTILS };
