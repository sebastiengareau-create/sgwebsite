// ============================================================
// DONNÉES DE TEST — pour exercer l'ensemble du système avec des
// données réalistes, cohérentes entre les modules (comptabilité,
// paie, inventaire, rentabilité…).
//
// NE TOUCHE JAMAIS à la table User — les 5 employés réels existants
// sont réutilisés tels quels. Tout ce qui est créé ici est nommé avec
// le préfixe "TEST" (clients, fournisseurs, pièces) pour être
// facilement identifiable.
//
// Conçu pour être lancé sur une base tout juste réinitialisée (voir
// Administrateur → Réinitialisation → "Effacer les données") — utilise
// le même outil pour tout nettoyer une fois les tests terminés.
//
// Usage : node prisma/seed-test.js
// ============================================================

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const {
  assurerPlanComptable, assurerCategoriesInventaire, assurerCategoriesDepense,
  posterFactureEmise, posterFacturePayee, posterDepenseRecue, posterDepensePayee, posterPaie,
} = require("../lib/comptabilite");
const { calculerPaiePourEmploye } = require("../lib/paie");

const CREE_PAR = "Script de données test";

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}

// "YYYY-MM-DD" ancré à midi UTC — sinon minuit UTC recule d'un jour une fois
// affiché en heure du Québec (voir app/api/paie/lots/route.js).
function jourCivil(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`);
}

// Ajoute une pièce utilisée ET déduit le stock — même effet que la vraie
// route POST /api/bons/[id]/pieces, pour que les quantités en inventaire
// restent cohérentes avec ce qui a été "consommé" par les bons de test.
async function ajouterPieceUtilisee(problemeId, piece, qte) {
  await prisma.pieceUtilisee.create({ data: { problemeId, pieceId: piece.id, qte, prix: piece.prix } });
  await prisma.piece.update({ where: { id: piece.id }, data: { qte: { decrement: qte } } });
}

// Prochain numéro séquentiel pour un modèle donné, même convention que
// les routes API réelles (ex: "2026-0001", "FAC-0001", "PAIE-0001").
async function prochainNumero(modele, prefixe) {
  const dernier = await prisma[modele].findFirst({ orderBy: { numero: "desc" } });
  let n = 1;
  if (dernier) {
    const partie = parseInt(dernier.numero.split("-").pop(), 10);
    if (!isNaN(partie)) n = partie + 1;
  }
  return `${prefixe}${String(1000 + n).slice(1)}`;
}

async function main() {
  console.log("=== Données de test — garage-backend ===\n");

  console.log("1. Plan comptable et catégories standards…");
  await assurerPlanComptable();
  await assurerCategoriesInventaire();
  await assurerCategoriesDepense();

  const employes = await prisma.user.findMany({ where: { actif: true } });
  const mecaniciens = employes.filter((e) => e.role === "MECANICIEN");
  const [martin, paulOuAutre, christina] = [
    mecaniciens.find((e) => e.nom.includes("Martin")) || mecaniciens[0],
    employes.find((e) => e.role === "SECRETAIRE") || employes[0],
    mecaniciens.find((e) => e.nom.includes("Christina")) || mecaniciens[1] || mecaniciens[0],
  ];
  const jocelyn = mecaniciens.find((e) => e.nom.includes("Jocelyn")) || mecaniciens[mecaniciens.length - 1];
  console.log(`   Employés réutilisés : ${employes.map((e) => e.nom).join(", ")}`);

  // ---------- FOURNISSEURS + DÉPENSES ----------
  console.log("\n2. Fournisseurs et dépenses…");
  const [fournPieces, fournElec, fournProprio] = await Promise.all([
    prisma.fournisseur.create({ data: { nom: "TEST Fournisseur - Pièces Auto Plus", telephone: "418-555-0100", courriel: "commandes@piecesautoplus.test" } }),
    prisma.fournisseur.create({ data: { nom: "TEST Fournisseur - Hydro Distribution", telephone: "1-800-555-0111" } }),
    prisma.fournisseur.create({ data: { nom: "TEST Fournisseur - Immeubles Locaplus", telephone: "418-555-0122" } }),
  ]);
  const categoriesDepense = await prisma.categorieDepense.findMany();
  const catParCode = Object.fromEntries(categoriesDepense.map((c) => [c.code, c]));

  const depensesAPoster = [
    { fournisseurId: fournProprio.id, categorie: catParCode.LOYER, description: "Loyer atelier - septembre", montant: 1800, dateFacture: "2026-09-01", statut: "PAYEE", datePaiement: "2026-09-01" },
    { fournisseurId: fournElec.id, categorie: catParCode.ELECTRICITE, description: "Facture électricité - août", montant: 322.50, dateFacture: "2026-08-28", dateEcheance: "2026-09-12", statut: "IMPAYEE" },
    { fournisseurId: fournProprio.id, categorie: catParCode.ASSURANCES, description: "Assurance responsabilité - Q3", montant: 450, dateFacture: "2026-08-15", dateEcheance: "2026-08-30", statut: "IMPAYEE" },
    { fournisseurId: fournPieces.id, categorie: catParCode.FRAIS_BANCAIRES, description: "Frais de transaction terminal", montant: 38.15, dateFacture: "2026-09-03", statut: "PAYEE", datePaiement: "2026-09-04" },
    { fournisseurId: fournPieces.id, categorie: catParCode.FOURNITURES_BUREAU, description: "Papeterie et fournitures", montant: 84.90, dateFacture: "2026-09-05", dateEcheance: "2026-09-20", statut: "IMPAYEE" },
  ];
  for (const d of depensesAPoster) {
    const depense = await prisma.depense.create({
      data: {
        fournisseurId: d.fournisseurId,
        description: d.description,
        montant: d.montant,
        dateFacture: new Date(d.dateFacture),
        dateEcheance: d.dateEcheance ? new Date(d.dateEcheance) : null,
        statut: d.statut,
        datePaiement: d.datePaiement ? new Date(d.datePaiement) : null,
        lignes: { create: [{ categorieDepenseId: d.categorie.id, montant: d.montant }] },
      },
    });
    await posterDepenseRecue({ ...depense, lignesPourEcriture: [{ compteDepenseNumero: d.categorie.compteDepenseNumero, montant: d.montant }] }, CREE_PAR);
    if (d.statut === "PAYEE") await posterDepensePayee(depense, CREE_PAR);
  }
  console.log(`   ${depensesAPoster.length} dépenses créées et postées.`);

  // ---------- INVENTAIRE ----------
  console.log("\n3. Inventaire…");
  const piecesData = [
    { nom: "TEST Filtre à huile", numero: "TFO-1001", qte: 20, qteMin: 5, coutant: 6.50, prix: 12.99 },
    { nom: "TEST Plaquettes de frein avant", numero: "TPF-1002", qte: 2, qteMin: 4, coutant: 28.00, prix: 64.50 },
    { nom: "TEST Huile moteur 5W30 (litre)", numero: "THM-1003", qte: 50, qteMin: 12, coutant: 4.10, prix: 8.25 },
    { nom: "TEST Batterie 12V", numero: "TBA-1004", qte: 1, qteMin: 3, coutant: 78.00, prix: 145.00 },
    { nom: "TEST Pneu été 205/55R16", numero: "TPN-1005", qte: 8, qteMin: 4, coutant: 85.00, prix: 159.99, categorie: "PNEU" },
    { nom: "TEST Amortisseur avant", numero: "TAM-1006", qte: 4, qteMin: 2, coutant: 45.00, prix: 89.99 },
    { nom: "TEST Courroie serpentine", numero: "TCS-1007", qte: 6, qteMin: 3, coutant: 18.00, prix: 39.99 },
    { nom: "TEST Bougie d'allumage", numero: "TBG-1008", qte: 24, qteMin: 8, coutant: 3.20, prix: 7.99 },
    { nom: "TEST Essuie-glace", numero: "TEG-1009", qte: 15, qteMin: 5, coutant: 5.00, prix: 14.99 },
    { nom: "TEST Liquide de frein", numero: "TLF-1010", qte: 10, qteMin: 4, coutant: 6.00, prix: 12.99 },
  ];
  const pieces = {};
  for (const p of piecesData) {
    pieces[p.numero] = await prisma.piece.create({ data: { nom: p.nom, numero: p.numero, qte: p.qte, qteMin: p.qteMin, coutant: p.coutant, prix: p.prix, categorie: p.categorie || "PIECE" } });
  }
  console.log(`   ${piecesData.length} pièces créées (2 sous le seuil de stock pour tester l'alerte).`);

  // ---------- CLIENTS ----------
  console.log("\n4. Clients…");
  const clientsData = [
    { nom: "TEST Client - Jean Tremblay", telephone: "418-555-0201", courriel: "jean.tremblay@example.test", ville: "Québec", codePostal: "G1A 1A1" },
    { nom: "TEST Client - Sylvie Bouchard", telephone: "418-555-0202", courriel: "sylvie.bouchard@example.test", ville: "Lévis" },
    { nom: "TEST Client - Marc Gagnon", telephone: "418-555-0203", courriel: "marc.gagnon@example.test", garantieProlongee: "GP-88213" },
    { nom: "TEST Client - Nathalie Roy", telephone: "418-555-0204", courriel: "nathalie.roy@example.test" },
    { nom: "TEST Client - Groupe Transport ABC", telephone: "418-555-0205", courriel: "compta@transportabc.test", adresse: "800 boul. Industriel" },
    { nom: "TEST Client - Éric Simard", telephone: "418-555-0206" },
  ];
  const clients = {};
  for (const c of clientsData) {
    clients[c.nom] = await prisma.client.create({ data: c });
  }
  console.log(`   ${clientsData.length} clients créés.`);

  // ---------- RENDEZ-VOUS ----------
  console.log("\n5. Rendez-vous…");
  await prisma.rendezVous.createMany({
    data: [
      { clientId: clients["TEST Client - Jean Tremblay"].id, clientNom: "TEST Client - Jean Tremblay", clientTelephone: "418-555-0201", vehiculeInfo: "Honda Civic 2021", date: new Date("2026-09-10T13:00:00Z"), motif: "Changement d'huile", statut: "CONFIRME" },
      { clientId: clients["TEST Client - Sylvie Bouchard"].id, clientNom: "TEST Client - Sylvie Bouchard", clientTelephone: "418-555-0202", vehiculeInfo: "Toyota Corolla 2019", date: new Date("2026-09-11T15:00:00Z"), motif: "Freins avant", statut: "CONFIRME" },
      { clientNom: "TEST Client - Walk-in", date: new Date("2026-09-05T16:00:00Z"), motif: "Estimation générale", statut: "COMPLETE" },
      { clientNom: "TEST Rendez-vous - Réunion fournisseur", date: new Date("2026-09-15T18:00:00Z"), motif: "Rencontre fournisseur pièces", note: "Rendez-vous d'affaire, sans lien avec un véhicule", statut: "CONFIRME" },
    ],
  });
  console.log("   4 rendez-vous créés.");

  // ---------- SOUMISSIONS ----------
  console.log("\n6. Soumissions…");
  const numSou1 = await prochainNumero("soumission", "SOU-");
  await prisma.soumission.create({
    data: {
      numero: numSou1, clientNom: "TEST Client - Prospect Lavoie", clientTelephone: "418-555-0301",
      vehiculeInfo: "Ford F-150 2018", statut: "EN_ATTENTE",
      taches: {
        create: [
          { description: "Remplacement embrayage", tempsEstime: 4, pieces: { create: [{ nom: "Kit embrayage complet", prixEstime: 320, qte: 1 }] } },
          { description: "Vidange d'huile incluse", tempsEstime: 0.5 },
        ],
      },
    },
  });
  const numSou2 = await prochainNumero("soumission", "SOU-");
  await prisma.soumission.create({
    data: {
      numero: numSou2, clientId: clients["TEST Client - Éric Simard"].id, clientNom: "TEST Client - Éric Simard",
      vehiculeInfo: "Subaru Outback 2020", statut: "ACCEPTEE",
      taches: { create: [{ description: "Alignement 4 roues", tempsEstime: 1, pieces: { create: [] } }] },
    },
  });
  console.log("   2 soumissions créées.");

  // ---------- BONS DE TRAVAIL + FACTURES ----------
  console.log("\n7. Bons de travail…");

  // a) EN_ATTENTE — aucun travail commencé
  const numBonA = await prochainNumero("bonTravail", "2026-");
  await prisma.bonTravail.create({
    data: {
      numero: numBonA, statut: "EN_ATTENTE", clientId: clients["TEST Client - Jean Tremblay"].id,
      problemes: { create: [{ description: "Vérification des freins avant bruit suspect" }] },
    },
  });

  // b) EN_COURS — poinçon ACTIF (fin: null) pour tester "Horodateurs actifs"
  const numBonB = await prochainNumero("bonTravail", "2026-");
  const bonB = await prisma.bonTravail.create({
    data: {
      numero: numBonB, statut: "EN_COURS", clientId: clients["TEST Client - Sylvie Bouchard"].id,
      problemes: { create: [{ description: "Remplacement plaquettes de frein avant" }] },
    },
    include: { problemes: true },
  });
  await prisma.entreeTemps.create({
    data: { employeId: martin.id, problemeId: bonB.problemes[0].id, debut: new Date(Date.now() - 45 * 60000) }, // débuté il y a 45 min
  });
  await ajouterPieceUtilisee(bonB.problemes[0].id, pieces["TPF-1002"], 1);

  // c) EN_COURS — travail terminé mais PAS ENCORE facturé (résumé estimé)
  const numBonC = await prochainNumero("bonTravail", "2026-");
  const bonC = await prisma.bonTravail.create({
    data: {
      numero: numBonC, statut: "EN_COURS", clientId: clients["TEST Client - Éric Simard"].id,
      problemes: { create: [{ description: "Changement d'huile et inspection générale" }] },
    },
    include: { problemes: true },
  });
  await prisma.entreeTemps.create({
    data: { employeId: jocelyn.id, problemeId: bonC.problemes[0].id, debut: new Date("2026-09-08T12:00:00Z"), fin: new Date("2026-09-08T13:00:00Z") },
  });
  await ajouterPieceUtilisee(bonC.problemes[0].id, pieces["THM-1003"], 5);
  await ajouterPieceUtilisee(bonC.problemes[0].id, pieces["TFO-1001"], 1);

  // d) TERMINÉ + FACTURÉ + PAYÉ — pièces + main-d'œuvre normale
  const numBonD = await prochainNumero("bonTravail", "2026-");
  const bonD = await prisma.bonTravail.create({
    data: {
      numero: numBonD, statut: "EN_COURS", clientId: clients["TEST Client - Marc Gagnon"].id,
      problemes: {
        create: [
          { description: "Diagnostic bruit moteur" },
          { description: "Remplacement courroie serpentine" },
        ],
      },
    },
    include: { problemes: true },
  });
  await prisma.entreeTemps.create({ data: { employeId: martin.id, problemeId: bonD.problemes[0].id, debut: new Date("2026-08-26T12:00:00Z"), fin: new Date("2026-08-26T14:00:00Z") } });
  await prisma.entreeTemps.create({ data: { employeId: martin.id, problemeId: bonD.problemes[1].id, debut: new Date("2026-08-26T14:30:00Z"), fin: new Date("2026-08-26T16:00:00Z") } });
  await ajouterPieceUtilisee(bonD.problemes[1].id, pieces["TCS-1007"], 1);
  await facturerEtOptionnellementPayer(bonD.id, { payer: true, dateEmission: "2026-08-26" });

  // e) TERMINÉ + FACTURÉ, IMPAYÉ et EN RETARD (>30 jours) — teste l'alerte facture en retard
  const numBonE = await prochainNumero("bonTravail", "2026-");
  const bonE = await prisma.bonTravail.create({
    data: {
      numero: numBonE, statut: "EN_COURS", clientId: clients["TEST Client - Nathalie Roy"].id,
      problemes: { create: [{ description: "Remplacement batterie et bornes" }] },
    },
    include: { problemes: true },
  });
  await prisma.entreeTemps.create({ data: { employeId: christina.id, problemeId: bonE.problemes[0].id, debut: new Date("2026-07-28T12:00:00Z"), fin: new Date("2026-07-28T13:00:00Z") } });
  await ajouterPieceUtilisee(bonE.problemes[0].id, pieces["TBA-1004"], 1);
  await facturerEtOptionnellementPayer(bonE.id, { payer: false, dateEmission: "2026-07-28" });

  // f) TERMINÉ + FACTURÉ — avec un poste "Remorquage" (revenu manuel hors main-d'œuvre)
  const numBonF = await prochainNumero("bonTravail", "2026-");
  const bonF = await prisma.bonTravail.create({
    data: {
      numero: numBonF, statut: "EN_COURS", clientId: clients["TEST Client - Groupe Transport ABC"].id,
      problemes: {
        create: [
          // categorieRevenu = le NUMÉRO du compte de revenu choisi (ex: "4050"
          // pour Remorquage) — pas un mot-clé fixe, voir postesRevenu dans
          // BonDetailClient.js.
          { description: "Remorquage véhicule en panne", categorieRevenu: "4050", factureDescription: "Remorquage aller-retour", facturePrixUnitaire: 125, factureQte: 1 },
          { description: "Diagnostic et réparation sur place" },
        ],
      },
    },
    include: { problemes: true },
  });
  await prisma.entreeTemps.create({ data: { employeId: jocelyn.id, problemeId: bonF.problemes[0].id, debut: new Date("2026-09-02T12:00:00Z"), fin: new Date("2026-09-02T12:45:00Z") } });
  await prisma.entreeTemps.create({ data: { employeId: jocelyn.id, problemeId: bonF.problemes[1].id, debut: new Date("2026-09-02T13:00:00Z"), fin: new Date("2026-09-02T15:00:00Z") } });
  await ajouterPieceUtilisee(bonF.problemes[1].id, pieces["TLF-1010"], 2);
  await facturerEtOptionnellementPayer(bonF.id, { payer: false, dateEmission: "2026-09-02" });

  console.log("   6 bons de travail créés (attente, en cours, facturés payés/impayés, remorquage).");

  // ---------- HEURES SUPPLÉMENTAIRES (pour une paie réaliste) ----------
  // Quelques présences additionnelles sur les bons déjà créés, dans les deux
  // semaines de paie, pour que le calcul de paie ait des heures à sommer même
  // sur les jours sans tâche dédiée.
  console.log("\n8. Heures additionnelles pour la paie…");
  await prisma.entreeTemps.create({ data: { employeId: martin.id, problemeId: bonD.problemes[0].id, debut: new Date("2026-08-27T12:00:00Z"), fin: new Date("2026-08-27T16:00:00Z") } });
  await prisma.entreeTemps.create({ data: { employeId: martin.id, problemeId: bonB.problemes[0].id, debut: new Date("2026-09-03T12:00:00Z"), fin: new Date("2026-09-03T16:00:00Z") } });
  await prisma.entreeTemps.create({ data: { employeId: jocelyn.id, problemeId: bonF.problemes[1].id, debut: new Date("2026-08-25T12:00:00Z"), fin: new Date("2026-08-25T15:30:00Z") } });
  await prisma.entreeTemps.create({ data: { employeId: jocelyn.id, problemeId: bonC.problemes[0].id, debut: new Date("2026-09-04T12:00:00Z"), fin: new Date("2026-09-04T15:00:00Z") } });

  const tacheInterne = await prisma.tacheInterne.create({ data: { nom: "TEST Ménage et entretien atelier" } });
  await prisma.entreeTempsInterne.create({ data: { employeId: paulOuAutre.id, tacheInterneId: tacheInterne.id, debut: new Date("2026-08-26T12:00:00Z"), fin: new Date("2026-08-26T16:00:00Z") } });

  // ---------- PAIE ----------
  console.log("\n9. Lots de paie…");
  // Lot COMPTABILISÉ — semaine du 25 au 31 août
  await creerLotPaie({
    periodeDebut: "2026-08-25", periodeFin: "2026-08-31", dateVersement: "2026-09-02",
    employeIds: [martin.id, jocelyn.id, christina.id, paulOuAutre.id],
    comptabiliser: true,
  });
  // Lot BROUILLON — semaine du 1er au 7 septembre (à traiter)
  await creerLotPaie({
    periodeDebut: "2026-09-01", periodeFin: "2026-09-07", dateVersement: "2026-09-09",
    employeIds: [martin.id, jocelyn.id, christina.id],
    comptabiliser: false,
  });

  console.log("\n=== Terminé ✅ ===");
  console.log("Toutes les données sont préfixées \"TEST\" — utilise Administrateur → Réinitialisation");
  console.log("→ \"Effacer les données\" pour tout retirer proprement une fois les tests finis.");

  // ---------------- fonctions locales ----------------

  async function facturerEtOptionnellementPayer(bonId, { payer, dateEmission }) {
    const bon = await prisma.bonTravail.findUnique({
      where: { id: bonId },
      include: { client: true, problemes: { include: { pieces: { include: { piece: true } }, entreesTemps: true } } },
    });
    const parametres = await prisma.parametre.findMany();
    const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
    const tauxHoraireClient = Number(dict.taux_horaire_client || 195);
    const tpsTaux = Number(dict.tps_taux || 5);
    const tvqTaux = Number(dict.tvq_taux || 9.975);

    const problemesMainOeuvre = bon.problemes.filter((pr) => (pr.categorieRevenu || "MAIN_OEUVRE") === "MAIN_OEUVRE");
    const entreesTempsMainOeuvre = problemesMainOeuvre.flatMap((pr) => pr.entreesTemps);
    const totalPieces = bon.problemes.reduce((s, pr) => s + pr.pieces.reduce((s2, l) => s2 + l.qte * l.prix, 0), 0);
    const heuresFacturees = entreesTempsMainOeuvre.filter((t) => t.fin).reduce((s, t) => s + dureeHeures(t.debut, t.fin), 0);
    const totalMainOeuvre = heuresFacturees * tauxHoraireClient;
    const totalAutresRevenus = bon.problemes
      .filter((pr) => (pr.categorieRevenu || "MAIN_OEUVRE") !== "MAIN_OEUVRE")
      .reduce((s, pr) => s + (pr.facturePrixUnitaire || 0) * (pr.factureQte || 1), 0);
    const totalFacture = totalPieces + totalMainOeuvre + totalAutresRevenus;
    const tpsMontant = totalFacture * (tpsTaux / 100);
    const tvqMontant = totalFacture * (tvqTaux / 100);
    const totalAvecTaxes = totalFacture + tpsMontant + tvqMontant;

    const numero = await prochainNumero("facture", "FAC-");
    const dateEmissionDate = new Date(`${dateEmission}T16:00:00Z`);

    const facture = await prisma.$transaction(async (tx) => {
      const f = await tx.facture.create({
        data: {
          bonId: bon.id, numero, totalPieces, totalMainOeuvre, totalAutresRevenus,
          totalFacture, tauxHoraireUtilise: tauxHoraireClient, heuresFacturees,
          tpsMontant, tvqMontant, totalAvecTaxes, dateEmission: dateEmissionDate,
          statut: payer ? "PAYEE" : "IMPAYEE",
          datePaiement: payer ? dateEmissionDate : null,
        },
      });
      await tx.bonTravail.update({ where: { id: bon.id }, data: { statut: "TERMINE" } });
      return f;
    });

    await posterFactureEmise(bon, facture, CREE_PAR);
    if (payer) await posterFacturePayee(facture, CREE_PAR);
  }

  async function creerLotPaie({ periodeDebut, periodeFin, dateVersement, employeIds, comptabiliser }) {
    const resultats = [];
    for (const employeId of employeIds) {
      const r = await calculerPaiePourEmploye(employeId, { periodeDebut, periodeFin, typePaie: "REGULIERE" });
      if (r.erreur) { console.log(`   ⚠ ${r.erreur} (employé ${employeId}) — ignoré`); continue; }
      resultats.push({ employeId, ...r });
    }
    if (resultats.length === 0) { console.log("   ⚠ Aucune paie calculable pour ce lot — ignoré."); return; }

    const numero = await prochainNumero("lotPaie", "PAIE-");
    const lot = await prisma.lotPaie.create({
      data: {
        numero, periodeDebut: jourCivil(periodeDebut), periodeFin: jourCivil(periodeFin),
        dateVersementPrevue: jourCivil(dateVersement), typePaie: "REGULIERE", creePar: CREE_PAR,
        paies: {
          create: resultats.map((r) => ({
            employeId: r.employeId, periodeDebut: jourCivil(periodeDebut), periodeFin: jourCivil(periodeFin),
            dateVersement: jourCivil(dateVersement),
            heuresTravaillees: r.heuresTravaillees, heuresHorodateur: r.heuresHorodateur, boni: r.boni,
            salaireBrut: r.salaireBrutPeriode, rrqEmploye: r.rrqEmploye, rqapEmploye: r.rqapEmploye,
            aeEmploye: r.aeEmploye, impotFederal: r.impotFederal, impotQuebec: r.impotQuebec,
            totalDeductions: r.totalDeductions, salaireNet: r.salaireNet, rrqEmployeur: r.rrqEmployeur,
            rqapEmployeur: r.rqapEmployeur, aeEmployeur: r.aeEmployeur, vacancesAccumulees: r.vacancesAccumulees,
            typePaie: "REGULIERE", statut: comptabiliser ? "VERSEE" : "BROUILLON",
          })),
        },
      },
      include: { paies: { include: { employe: true } } },
    });

    if (comptabiliser) {
      for (const paie of lot.paies) {
        try { await posterPaie(paie, CREE_PAR); } catch (e) { console.log(`   ⚠ Comptabilisation paie ${paie.employe.nom} : ${e.message}`); }
      }
      await prisma.lotPaie.update({ where: { id: lot.id }, data: { statut: "COMPTABILISEE", comptabiliseLe: jourCivil(dateVersement) } });
    }
    console.log(`   Lot ${numero} (${comptabiliser ? "comptabilisé" : "brouillon"}) — ${lot.paies.length} employé(s).`);
  }
}

main()
  .catch((e) => { console.error("\n❌ Erreur :", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
