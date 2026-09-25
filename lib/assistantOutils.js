const { prisma } = require("./prisma");
const { aAccesSection, estGerantOuDev } = require("./auth");
const { dateAujourdhuiQuebec, limitesJourQuebec, limitesMoisQuebec, dateQuebecStr } = require("./temps");

// ---------- Recherche souple ----------
// Chaque mot de la recherche doit se retrouver dans au moins un des champs
// (ex. "jean trem" trouve « Jean Tremblay » ; "civic frein" trouve un bon
// Civic avec une tâche de freins). Les mots sont comparés sans égard à la
// casse ; les accents, eux, doivent correspondre.
function mots(texte) {
  return String(texte || "").trim().split(/\s+/).filter(Boolean).slice(0, 6);
}
function filtreMots(texte, champs) {
  const liste = mots(texte);
  if (liste.length === 0) return {};
  return {
    AND: liste.map((mot) => ({
      OR: champs.map((champ) => champ(mot)),
    })),
  };
}
// Construit { champ: { contains: mot, mode: "insensitive" } }, en suivant
// les relations au besoin : contient("client.nom") → { client: { nom: … } }
function contient(chemin) {
  return (mot) => chemin.split(".").reduceRight((acc, cle) => ({ [cle]: acc }), { contains: mot, mode: "insensitive" });
}

// ---------- Dates en langage courant ----------
// L'IA reçoit la date du jour et convertit normalement elle-même, mais on
// accepte aussi « 29 septembre », « 29/09 », « demain »… au cas où.
const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
function lireDate(texte) {
  if (!texte) return null;
  const t = String(texte).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const aujourdHui = dateAujourdhuiQuebec();
  const [anActuel] = aujourdHui.split("-").map(Number);
  const decaler = (jours) => {
    const [a, m, j] = aujourdHui.split("-").map(Number);
    return new Date(Date.UTC(a, m - 1, j + jours, 12)).toISOString().slice(0, 10);
  };
  const construire = (an, mois, jour) => {
    const d = new Date(Date.UTC(an, mois - 1, jour, 12));
    return d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour ? d.toISOString().slice(0, 10) : null;
  };
  if (t === "aujourd'hui" || t === "aujourdhui") return aujourdHui;
  if (t === "demain") return decaler(1);
  if (t === "hier") return decaler(-1);
  if (t === "apres-demain") return decaler(2);
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return construire(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (m) return construire(m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : anActuel, +m[2], +m[1]);
  m = t.match(/(\d{1,2})(?:er)?\s+([a-z]+)\.?(?:\s+(\d{4}))?/);
  if (m) {
    const mois = MOIS.findIndex((nom) => nom.startsWith(m[2].slice(0, 3)));
    if (mois >= 0) return construire(m[3] ? +m[3] : anActuel, mois + 1, +m[1]);
  }
  return null;
}

// ---------- Liens vers les fiches ----------
// Chaque résultat porte un « lien » (chemin interne du logiciel) que
// l'assistant reprend dans sa réponse — le panneau le rend cliquable.
const lienClient = (c) => `/secretaire/clients/${c.id}`;
const lienBon = (b) => `/bons/${b.id}`;
const lienSoumission = (s) => `/secretaire/operations/soumissions/${s.id}/modifier`;
const lienPiece = (p) => `/secretaire/inventaire/${p.id}`;
const lienFournisseur = (f) => `/gerant/fournisseurs/${f.id}`;
const lienEmploye = (e) => `/gerant/employes/${e.id}`;
const lienCalendrier = (date) => `/secretaire/calendrier?date=${dateQuebecStr(date)}`;

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
    where: filtreMots(nom, ["nom", "telephone", "courriel", "numero", "ville", "adresse", "garantieProlongee"].map(contient)),
    include: { _count: { select: { bons: true } } },
    orderBy: { nom: "asc" },
    take: 15,
  });

  return {
    clients: clients.map((c) => ({
      nom: c.nom,
      numero: c.numero || null,
      lien: lienClient(c),
      nombreDeBons: c._count.bons,
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
      comptesEnRetard.push({ client: f.bon.client.nom, facture: f.numero, joursDeRetard, montant: f.totalAvecTaxes, lien: lienBon(f.bon), lienClient: lienClient(f.bon.client) });
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
  if (clientNom) Object.assign(where, filtreMots(clientNom, [contient("bon.client.nom")]));

  const factures = await prisma.facture.findMany({
    where,
    include: { bon: { include: { client: true } } },
    orderBy: { dateEmission: "desc" },
    take: 20,
  });

  return {
    factures: factures.map((f) => ({
      numero: f.numero,
      statut: f.statut,
      client: f.bon.client.nom,
      bon: f.bon.numero,
      lien: lienBon(f.bon),
      lienImpression: `${lienBon(f.bon)}/imprimer`,
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
      comptesAPayerListe.push({ fournisseur: d.fournisseur.nom, description: d.description, joursDepuisFacture, montant: d.montant, lien: lienFournisseur(d.fournisseur) });
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
  if (fournisseurNom) Object.assign(where, filtreMots(fournisseurNom, [contient("fournisseur.nom")]));
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
      lien: lienFournisseur(d.fournisseur),
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
    where: filtreMots(texte, ["description", "notes", "factureDescription"].map(contient)),
    include: { bon: { include: { client: true } } },
    orderBy: { bon: { creeLe: "desc" } },
    take: 20,
  });

  return {
    taches: problemes.map((p) => ({
      description: p.description,
      notes: p.notes || null,
      bon: p.bon.numero,
      lien: lienBon(p.bon),
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
      lien: e.probleme.bon ? lienBon(e.probleme.bon) : null,
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

async function chercherBonTravail(session, { numero, clientNom, statut, texte } = {}) {
  if (!(await aAccesSection(session, "operations"))) {
    return { erreur: "Accès refusé à la section Opérations pour cet employé." };
  }
  if (!numero && !clientNom && !statut && !texte) return { erreur: "Précise un numéro de bon, un nom de client, un statut ou un texte." };

  const conditions = [];
  if (numero) conditions.push({ numero: { contains: numero, mode: "insensitive" } });
  if (statut) conditions.push({ statut: statut.toUpperCase() });
  if (clientNom) conditions.push(filtreMots(clientNom, [contient("client.nom"), contient("client.telephone")]));
  if (texte) {
    conditions.push(filtreMots(texte, [
      (mot) => ({ problemes: { some: { description: { contains: mot, mode: "insensitive" } } } }),
      (mot) => ({ problemes: { some: { notes: { contains: mot, mode: "insensitive" } } } }),
    ]));
  }

  const bons = await prisma.bonTravail.findMany({
    where: { AND: conditions },
    include: { client: true, problemes: true, facture: true },
    orderBy: { creeLe: "desc" },
    take: 15,
  });

  return {
    bons: bons.map((b) => ({
      numero: b.numero,
      lien: lienBon(b),
      statut: b.statut,
      client: b.client.nom,
      lienClient: lienClient(b.client),
      problemes: b.problemes.map((p) => (p.notes ? `${p.description} — ${p.notes}` : p.description)),
      facture: b.facture ? { numero: b.facture.numero, statut: b.facture.statut, totalAvecTaxes: b.facture.totalAvecTaxes } : null,
      datePrevue: b.datePrevue,
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
  if (clientNom) Object.assign(where, filtreMots(clientNom, [contient("client.nom"), contient("clientNom"), contient("vehiculeInfo")]));

  const soumissions = await prisma.soumission.findMany({
    where,
    include: { client: true, taches: true },
    orderBy: { creeLe: "desc" },
    take: 15,
  });

  return {
    soumissions: soumissions.map((s) => ({
      numero: s.numero,
      lien: lienSoumission(s),
      statut: s.statut,
      client: s.client?.nom || s.clientNom,
      vehicule: s.vehiculeInfo || null,
      taches: s.taches.map((t) => t.description),
      creeLe: s.creeLe,
    })),
  };
}

async function inventairePiece(session, { nom, fournisseurNom, sousLeSeuil } = {}) {
  if (!(await aAccesSection(session, "inventaire"))) {
    return { erreur: "Accès refusé à la section Inventaire pour cet employé." };
  }
  if (!nom && !fournisseurNom && !sousLeSeuil) return { erreur: "Précise un nom de pièce, un fournisseur ou sousLeSeuil." };

  const conditions = [];
  if (nom) conditions.push(filtreMots(nom, ["nom", "numero", "emplacement", "fournisseur.nom"].map(contient)));
  if (fournisseurNom) conditions.push(filtreMots(fournisseurNom, [contient("fournisseur.nom")]));

  let pieces = await prisma.piece.findMany({
    where: { AND: conditions },
    include: { fournisseur: true },
    orderBy: { nom: "asc" },
    take: sousLeSeuil ? 500 : 40,
  });
  // qte ≤ qteMin compare deux colonnes : filtré ici plutôt qu'en requête
  if (sousLeSeuil) pieces = pieces.filter((p) => p.qte <= p.qteMin).slice(0, 40);

  return {
    nombre: pieces.length,
    pieces: pieces.map((p) => ({
      nom: p.nom,
      numero: p.numero,
      lien: lienPiece(p),
      fournisseur: p.fournisseur?.nom || null,
      emplacement: p.emplacement || null,
      qteEnStock: p.qte,
      seuilMinimum: p.qteMin,
      sousLeSeuil: p.qte <= p.qteMin,
      prix: p.prix,
    })),
  };
}

async function rendezVousDuJour(session, { date, dateFin, clientNom } = {}) {
  if (!(await aAccesSection(session, "calendrier"))) {
    return { erreur: "Accès refusé à la section Calendrier pour cet employé." };
  }
  const dateLue = lireDate(date);
  const finLue = lireDate(dateFin);
  if (date && !dateLue) return { erreur: `Date non comprise : « ${date} ». Utilise le format AAAA-MM-JJ.` };
  const dateStr = dateLue || dateAujourdhuiQuebec();
  const finStr = finLue && finLue >= dateStr ? finLue : dateStr;
  const { debut } = limitesJourQuebec(dateStr);
  const { fin } = limitesJourQuebec(finStr);

  // Avec un nom de client sans date précise : ses rendez-vous à venir
  const where = clientNom && !date
    ? { date: { gte: limitesJourQuebec(dateAujourdhuiQuebec()).debut }, ...filtreMots(clientNom, [contient("clientNom"), contient("clientTelephone")]) }
    : { date: { gte: debut, lte: fin }, ...(clientNom ? filtreMots(clientNom, [contient("clientNom")]) : {}) };

  const rendezVous = await prisma.rendezVous.findMany({
    where: { ...where, statut: { not: "ANNULE" } },
    orderBy: { date: "asc" },
    take: 40,
  });

  return {
    date: dateStr,
    dateFin: finStr,
    nom: `Calendrier du ${dateStr}`,
    lien: `/secretaire/calendrier?date=${dateStr}`,
    rendezVous: rendezVous.map((r) => ({
      lien: lienCalendrier(r.date),
      lienBon: r.bonId ? `/bons/${r.bonId}` : null,
      provenance: r.source,
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
    where: filtreMots(nom, ["nom", "courriel", "telephone", "numeroEmploye", "assignation"].map(contient)),
    take: 10,
  });

  return {
    employes: employes.map((e) => ({
      nom: e.nom,
      lien: lienEmploye(e),
      role: e.role,
      courriel: e.courriel,
      telephone: e.telephone || null,
      adresse: e.adresse || null,
      actif: e.actif,
    })),
  };
}

async function rechercherFournisseur(session, { nom } = {}) {
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return { erreur: "Accès refusé à la section Fournisseurs pour cet employé." };
  }
  if (!nom) return { erreur: "Nom de fournisseur manquant." };

  const fournisseurs = await prisma.fournisseur.findMany({
    where: filtreMots(nom, ["nom", "numero", "telephone", "courriel", "ville"].map(contient)),
    include: { depenses: { where: { statut: "IMPAYEE" }, select: { montant: true } } },
    orderBy: { nom: "asc" },
    take: 10,
  });

  return {
    fournisseurs: fournisseurs.map((f) => ({
      nom: f.nom,
      numero: f.numero || null,
      lien: lienFournisseur(f),
      telephone: f.telephone || null,
      courriel: f.courriel || null,
      adresse: [f.adresse, f.ville, f.codePostal].filter(Boolean).join(", ") || null,
      actif: f.actif,
      totalImpaye: f.depenses.reduce((s, d) => s + d.montant, 0),
    })),
  };
}

// Recherche partout à la fois — pour une question vague (« trouve Tremblay »,
// « 418-555 », « 2026-014 ») ou quand une recherche ciblée n'a rien donné.
// Ne fouille que les sections permises à cet employé.
async function rechercheGlobale(session, { texte } = {}) {
  if (!texte || !String(texte).trim()) return { erreur: "Texte à rechercher manquant." };
  const q = String(texte).trim();
  const [clients, operations, inventaire, fournisseurs, calendrier] = await Promise.all([
    aAccesSection(session, "clients"),
    aAccesSection(session, "operations"),
    aAccesSection(session, "inventaire"),
    aAccesSection(session, "fournisseurs"),
    aAccesSection(session, "calendrier"),
  ]);

  const [resClients, resBons, resFactures, resSoumissions, resPieces, resFournisseurs, resRendezVous, resEmployes] = await Promise.all([
    clients ? rechercherClient(session, { nom: q }) : null,
    operations
      ? prisma.bonTravail.findMany({
          where: filtreMots(q, [
            contient("numero"), contient("client.nom"),
            (mot) => ({ problemes: { some: { OR: [{ description: { contains: mot, mode: "insensitive" } }, { notes: { contains: mot, mode: "insensitive" } }] } } }),
          ]),
          include: { client: true },
          orderBy: { creeLe: "desc" },
          take: 8,
        })
      : null,
    operations ? prisma.facture.findMany({ where: { numero: { contains: q, mode: "insensitive" } }, include: { bon: { include: { client: true } } }, take: 5 }) : null,
    operations ? prisma.soumission.findMany({ where: filtreMots(q, [contient("numero"), contient("clientNom"), contient("vehiculeInfo")]), take: 5, orderBy: { creeLe: "desc" } }) : null,
    inventaire ? inventairePiece(session, { nom: q }) : null,
    fournisseurs ? rechercherFournisseur(session, { nom: q }) : null,
    calendrier
      ? prisma.rendezVous.findMany({ where: { statut: { not: "ANNULE" }, ...filtreMots(q, [contient("clientNom"), contient("motif"), contient("vehiculeInfo")]) }, orderBy: { date: "desc" }, take: 5 })
      : null,
    estGerantOuDev(session) ? rechercherEmploye(session, { nom: q }) : null,
  ]);

  const resultat = { recherche: q };
  if (resClients?.clients?.length) resultat.clients = resClients.clients.slice(0, 8);
  if (resBons?.length) resultat.bons = resBons.map((b) => ({ numero: b.numero, lien: lienBon(b), statut: b.statut, client: b.client.nom, creeLe: b.creeLe }));
  if (resFactures?.length) resultat.factures = resFactures.map((f) => ({ numero: f.numero, statut: f.statut, client: f.bon.client.nom, totalAvecTaxes: f.totalAvecTaxes, lien: lienBon(f.bon) }));
  if (resSoumissions?.length) resultat.soumissions = resSoumissions.map((s) => ({ numero: s.numero, statut: s.statut, client: s.clientNom, lien: lienSoumission(s) }));
  if (resPieces?.pieces?.length) resultat.pieces = resPieces.pieces.slice(0, 8);
  if (resFournisseurs?.fournisseurs?.length) resultat.fournisseurs = resFournisseurs.fournisseurs;
  if (resRendezVous?.length) resultat.rendezVous = resRendezVous.map((r) => ({ client: r.clientNom, date: r.date, motif: r.motif, lien: lienCalendrier(r.date) }));
  if (resEmployes?.employes?.length) resultat.employes = resEmployes.employes;
  if (Object.keys(resultat).length === 1) resultat.aucunResultat = true;
  return resultat;
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
    permis: async () => true, // ne fouille que les sections permises, voir rechercheGlobale
    executer: rechercheGlobale,
    declaration: {
      name: "rechercheGlobale",
      description: "Recherche un texte PARTOUT à la fois (clients, bons et leurs tâches, factures, soumissions, pièces, fournisseurs, rendez-vous, employés). À utiliser quand la question est vague, quand on ne sait pas de quel type il s'agit (un nom, un numéro, un téléphone), ou quand une recherche ciblée n'a rien donné.",
      parameters: {
        type: "OBJECT",
        properties: { texte: { type: "STRING", description: "Nom, numéro, téléphone ou mot-clé à chercher" } },
        required: ["texte"],
      },
    },
  },
  {
    permis: (s) => aAccesSection(s, "fournisseurs"),
    executer: rechercherFournisseur,
    declaration: {
      name: "rechercherFournisseur",
      description: "Recherche des fournisseurs par nom, numéro, téléphone, courriel ou ville et retourne leurs coordonnées et le total impayé.",
      parameters: {
        type: "OBJECT",
        properties: { nom: { type: "STRING", description: "Nom (ou partie du nom), téléphone ou ville du fournisseur" } },
        required: ["nom"],
      },
    },
  },
  {
    permis: (s) => aAccesSection(s, "clients"),
    executer: rechercherClient,
    declaration: {
      name: "rechercherClient",
      description: "Recherche des clients par nom, téléphone, courriel, numéro de client ou ville (recherche partielle, mot par mot) et retourne leurs coordonnées.",
      parameters: {
        type: "OBJECT",
        properties: { nom: { type: "STRING", description: "Nom, téléphone, courriel, numéro ou ville du client (ou une partie)" } },
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
      description: "Recherche des bons de travail par numéro (partiel), nom ou téléphone du client, statut et/ou texte dans les tâches et leurs notes. Retourne statut, client, tâches (avec notes), facture liée et date prévue.",
      parameters: {
        type: "OBJECT",
        properties: {
          numero: { type: "STRING", description: "Numéro (ou partie du numéro) du bon de travail" },
          clientNom: { type: "STRING", description: "Nom (ou partie du nom) ou téléphone du client" },
          statut: { type: "STRING", enum: ["EN_ATTENTE", "EN_COURS", "TERMINE"], description: "Statut du bon (TERMINE = facturé)" },
          texte: { type: "STRING", description: "Mot(s) à chercher dans les tâches et leurs notes (ex: freins, alternateur)" },
        },
      },
    },
  },
  {
    permis: (s) => aAccesSection(s, "inventaire"),
    executer: inventairePiece,
    declaration: {
      name: "inventairePiece",
      description: "Recherche des pièces d'inventaire par nom/numéro, par fournisseur habituel (ex: « les pièces de NAPA » → fournisseurNom=\"NAPA\") et/ou seulement celles sous le seuil minimum. Retourne quantité en stock, seuil, prix, emplacement et fournisseur.",
      parameters: {
        type: "OBJECT",
        properties: {
          nom: { type: "STRING", description: "Nom ou numéro (ou une partie) de la pièce" },
          fournisseurNom: { type: "STRING", description: "Nom (ou partie du nom) du fournisseur habituel des pièces" },
          sousLeSeuil: { type: "BOOLEAN", description: "true pour seulement les pièces à commander (stock au seuil minimum ou sous)" },
        },
      },
    },
  },
  {
    permis: (s) => aAccesSection(s, "calendrier"),
    executer: rendezVousDuJour,
    declaration: {
      name: "rendezVousDuJour",
      description: "Retourne les rendez-vous du calendrier pour une journée ou une période (aujourd'hui par défaut), avec leur provenance (WEB, LOCAL, BON). Avec seulement un nom de client, retourne ses rendez-vous à venir.",
      parameters: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING", description: "Date (ou début de période) au format AAAA-MM-JJ, ex: « le 29 septembre » → 2026-09-29 — vide pour aujourd'hui" },
          dateFin: { type: "STRING", description: "Fin de période au format AAAA-MM-JJ (ex: pour « cette semaine »)" },
          clientNom: { type: "STRING", description: "Nom (ou partie du nom) du client" },
        },
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
