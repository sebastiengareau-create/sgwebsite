const { prisma } = require("./prisma");
const { aAccesSection, estGerantOuDev } = require("./auth");
const { dateAujourdhuiQuebec, limitesJourQuebec, limitesMoisQuebec } = require("./temps");

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

// Recherche libre de factures — contrairement à comptesRecevoir (qui ne
// montre que les impayées en retard d'un certain nombre de jours), sert à
// retrouver une facture précise (par numéro) ou toutes les factures d'un
// client, peu importe leur statut ou leur ancienneté.
async function rechercherFacture(session, { numero, clientNom, statut } = {}) {
  if (!(await aAccesSection(session, "operations"))) {
    return { erreur: "Accès refusé à la section Opérations pour cet employé." };
  }
  if (!numero && !clientNom && !statut) {
    return { erreur: "Précise un numéro de facture, un nom de client ou un statut." };
  }

  const where = {};
  if (numero) where.numero = { contains: numero, mode: "insensitive" };
  if (statut) where.statut = statut.toUpperCase();
  if (clientNom) where.bon = { client: { nom: { contains: clientNom, mode: "insensitive" } } };

  const factures = await prisma.facture.findMany({
    where,
    include: { bon: { include: { client: true } } },
    orderBy: { dateEmission: "desc" },
    take: 15,
  });

  return {
    factures: factures.map((f) => ({
      numero: f.numero,
      statut: f.statut,
      client: f.bon.client.nom,
      bon: f.bon.numero,
      totalAvecTaxes: f.totalAvecTaxes,
      dateEmission: f.dateEmission,
      datePaiement: f.datePaiement,
    })),
  };
}

// Reprend exactement la logique du rapport "Comptes fournisseurs" (voir
// app/gerant/comptabilite/rapports/comptes-fournisseurs/page.js) : une
// dépense impayée est due depuis (maintenant - dateFacture), en jours.
// Contrairement à comptesRecevoir, le seuil par défaut est 0 (tout ce qui
// est impayé) — "qu'est-ce qu'on doit à nos fournisseurs" doit tout montrer,
// pas seulement ce qui est en retard.
async function comptesAPayer(session, { joursMin } = {}) {
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return { erreur: "Accès refusé à la section Fournisseurs pour cet employé." };
  }
  const seuil = Number(joursMin) || 0;

  const depenses = await prisma.depense.findMany({
    where: { statut: "IMPAYEE" },
    include: { fournisseur: true },
    orderBy: { dateFacture: "asc" },
  });

  const maintenant = new Date();
  const comptesAPayerListe = [];
  for (const d of depenses) {
    const joursDepuisFacture = Math.floor((maintenant - new Date(d.dateFacture)) / 86400000);
    if (joursDepuisFacture >= seuil) {
      comptesAPayerListe.push({ fournisseur: d.fournisseur.nom, description: d.description, joursDepuisFacture, montant: d.montant });
    }
  }

  return { seuilJours: seuil, comptesAPayer: comptesAPayerListe, totalDu: comptesAPayerListe.reduce((s, c) => s + c.montant, 0) };
}

// Recherche/filtre l'historique des dépenses — pour des questions du genre
// "combien on a payé en électricité en août" (categorie="Électricité",
// mois=8). Le total et le nombre viennent d'un aggregate séparé de la liste
// retournée (plafonnée à 25) pour rester exacts même si plus de 25 dépenses
// correspondent.
async function rechercherDepenses(session, { categorie, fournisseurNom, mois, annee } = {}) {
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return { erreur: "Accès refusé à la section Fournisseurs pour cet employé." };
  }

  const where = {};
  if (categorie) where.lignes = { some: { categorieDepense: { nom: { contains: categorie, mode: "insensitive" } } } };
  if (fournisseurNom) where.fournisseur = { nom: { contains: fournisseurNom, mode: "insensitive" } };
  if (mois) {
    const anneeFinale = Number(annee) || Number(dateAujourdhuiQuebec().split("-")[0]);
    const { debut, fin } = limitesMoisQuebec(anneeFinale, Number(mois));
    where.dateFacture = { gte: debut, lte: fin };
  } else if (annee) {
    where.dateFacture = { gte: limitesMoisQuebec(Number(annee), 1).debut, lte: limitesMoisQuebec(Number(annee), 12).fin };
  }

  const [agrege, depenses] = await Promise.all([
    prisma.depense.aggregate({ where, _sum: { montant: true }, _count: true }),
    prisma.depense.findMany({ where, include: { fournisseur: true, lignes: { include: { categorieDepense: true } } }, orderBy: { dateFacture: "desc" }, take: 25 }),
  ]);

  return {
    total: agrege._sum.montant || 0,
    nombre: agrege._count,
    depenses: depenses.map((d) => ({
      description: d.description,
      montant: d.montant,
      fournisseur: d.fournisseur.nom,
      categorie: d.lignes.map((l) => l.categorieDepense.nom).join(", "),
      dateFacture: d.dateFacture,
      statut: d.statut,
    })),
  };
}

// Recherche dans le texte des tâches/problèmes des bons de travail — utile
// pour "sur quels bons a-t-on fait des freins récemment", par exemple.
async function rechercherTachesBons(session, { texte } = {}) {
  if (!(await aAccesSection(session, "operations"))) {
    return { erreur: "Accès refusé à la section Opérations pour cet employé." };
  }
  if (!texte) return { erreur: "Texte à rechercher manquant." };

  const problemes = await prisma.probleme.findMany({
    where: { description: { contains: texte, mode: "insensitive" } },
    include: { bon: { include: { client: true } } },
    orderBy: { bon: { creeLe: "desc" } },
    take: 15,
  });

  return {
    taches: problemes.map((p) => ({
      description: p.description,
      bon: p.bon.numero,
      client: p.bon.client.nom,
      statutBon: p.bon.statut,
      creeLe: p.bon.creeLe,
    })),
  };
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

async function rechercherSoumission(session, { numero, clientNom, statut } = {}) {
  if (!(await aAccesSection(session, "operations"))) {
    return { erreur: "Accès refusé à la section Opérations pour cet employé." };
  }
  if (!numero && !clientNom && !statut) {
    return { erreur: "Précise un numéro de soumission, un nom de client ou un statut." };
  }

  const where = {};
  if (numero) where.numero = { contains: numero, mode: "insensitive" };
  if (statut) where.statut = statut.toUpperCase();
  if (clientNom) {
    where.OR = [
      { client: { nom: { contains: clientNom, mode: "insensitive" } } },
      { clientNom: { contains: clientNom, mode: "insensitive" } },
    ];
  }

  const soumissions = await prisma.soumission.findMany({
    where,
    include: { client: true, taches: true },
    orderBy: { creeLe: "desc" },
    take: 15,
  });

  return {
    soumissions: soumissions.map((s) => ({
      numero: s.numero,
      statut: s.statut,
      client: s.client?.nom || s.clientNom,
      vehicule: s.vehiculeInfo || null,
      taches: s.taches.map((t) => t.description),
      creeLe: s.creeLe,
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
      note: r.note || null,
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
  fournisseurs: { url: "/gerant/comptabilite/comptes-a-payer", permis: (s) => aAccesSection(s, "fournisseurs") },
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
    executer: rechercherFacture,
    declaration: {
      name: "rechercherFacture",
      description: "Recherche des factures par numéro (partiel), nom de client et/ou statut (IMPAYEE, PAYEE, ANNULEE) — sans filtre de retard, contrairement à comptesRecevoir. Utile pour retrouver une facture précise ou toutes les factures (impayées ou non) d'un client.",
      parameters: {
        type: "OBJECT",
        properties: {
          numero: { type: "STRING", description: "Numéro (ou partie du numéro) de la facture" },
          clientNom: { type: "STRING", description: "Nom (ou partie du nom) du client" },
          statut: { type: "STRING", enum: ["IMPAYEE", "PAYEE", "ANNULEE"], description: "Statut de la facture" },
        },
      },
    },
  },
  {
    permis: (s) => aAccesSection(s, "operations"),
    executer: rechercherSoumission,
    declaration: {
      name: "rechercherSoumission",
      description: "Recherche des soumissions par numéro (partiel), nom de client et/ou statut (EN_ATTENTE, ACCEPTEE).",
      parameters: {
        type: "OBJECT",
        properties: {
          numero: { type: "STRING", description: "Numéro (ou partie du numéro) de la soumission" },
          clientNom: { type: "STRING", description: "Nom (ou partie du nom) du client" },
          statut: { type: "STRING", enum: ["EN_ATTENTE", "ACCEPTEE"], description: "Statut de la soumission" },
        },
      },
    },
  },
  {
    permis: (s) => aAccesSection(s, "fournisseurs"),
    executer: comptesAPayer,
    declaration: {
      name: "comptesAPayer",
      description: "Retourne la liste des dépenses/factures fournisseurs impayées (comptes à payer), avec le montant dû par fournisseur. Précise joursMin pour ne voir que celles impayées depuis au moins ce nombre de jours.",
      parameters: {
        type: "OBJECT",
        properties: { joursMin: { type: "NUMBER", description: "Nombre minimum de jours depuis la facture à considérer (défaut 0 = toutes les dépenses impayées)" } },
      },
    },
  },
  {
    permis: (s) => aAccesSection(s, "fournisseurs"),
    executer: rechercherDepenses,
    declaration: {
      name: "rechercherDepenses",
      description: "Recherche l'historique des dépenses par poste de dépense (ex: Électricité, Loyer), par fournisseur et/ou par mois/année, et retourne le total dépensé et le détail. Exemple : \"combien on a payé en électricité en août\" → categorie=\"Électricité\", mois=8.",
      parameters: {
        type: "OBJECT",
        properties: {
          categorie: { type: "STRING", description: "Nom (ou partie du nom) du poste de dépense, ex: Électricité, Loyer, Assurances" },
          fournisseurNom: { type: "STRING", description: "Nom (ou partie du nom) du fournisseur" },
          mois: { type: "NUMBER", description: "Mois (1 à 12) — si précisé sans année, utilise l'année courante" },
          annee: { type: "NUMBER", description: "Année (ex: 2026)" },
        },
      },
    },
  },
  {
    permis: (s) => aAccesSection(s, "operations"),
    executer: rechercherTachesBons,
    declaration: {
      name: "rechercherTachesBons",
      description: "Recherche un texte dans les tâches/problèmes décrits sur les bons de travail (ex: \"freins\", \"vidange\") et retourne les bons correspondants avec leur client et leur statut.",
      parameters: {
        type: "OBJECT",
        properties: { texte: { type: "STRING", description: "Mot ou expression à rechercher dans la description des tâches" } },
        required: ["texte"],
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
