const { prisma } = require("./prisma");

async function moduleComptabiliteActif() {
  const p = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  return p?.valeur !== "inactif"; // actif par défaut
}

// Retourne le statut d'une période comptable (mois) pour une date donnée —
// "OUVERTE" si aucune ligne PeriodeComptable n'existe encore pour ce mois.
async function obtenirStatutPeriode(date) {
  const cle = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit" }).format(new Date(date));
  const [anneeStr, moisStr] = cle.split("-");
  const periode = await prisma.periodeComptable.findUnique({ where: { annee_mois: { annee: Number(anneeStr), mois: Number(moisStr) } } });
  return periode?.statut || "OUVERTE";
}

// Lance une erreur si la date donnée tombe dans une période verrouillée
// (nouvellePiece: false — modification/suppression d'une pièce existante,
// bloquée dès VERROUILLEE) ou fermée (toujours bloqué, même pour une
// nouvelle pièce datée dans le mois). Le message commence par
// "PERIODE_LOCK:" pour que les routes puissent l'extraire proprement.
async function verifierPeriodeModifiable(date, { nouvellePiece = false } = {}) {
  const statut = await obtenirStatutPeriode(date);
  if (statut === "FERMEE") {
    throw new Error("PERIODE_LOCK:🔴 Période fermée\nCette transaction appartient à une période fermée.\nCréer une écriture de correction ou demander une réouverture autorisée.");
  }
  if (statut === "VERROUILLEE" && !nouvellePiece) {
    throw new Error("PERIODE_LOCK:🟡 Période verrouillée\nCette écriture existante ne peut plus être modifiée ni supprimée.\nAjoute une écriture de correction dans la période courante si nécessaire.");
  }
}

// Plan comptable standard pour un garage — créé automatiquement au premier
// besoin (pas de script séparé à lancer). Numérotation classique :
// 1xxx=Actif, 2xxx=Passif, 3xxx=Capitaux propres, 4xxx=Revenus, 5xxx=Dépenses
const PLAN_COMPTABLE_STANDARD = [
  { numero: "1000", nom: "Encaisse / Banque", type: "ACTIF" },
  { numero: "1100", nom: "Comptes clients", type: "ACTIF" },
  { numero: "1200", nom: "Inventaire de pièces", type: "ACTIF" },
  { numero: "1400", nom: "Immobilisations (équipement)", type: "ACTIF" },
  { numero: "1410", nom: "Amortissement cumulé", type: "ACTIF" }, // contre-actif — réduit la valeur nette
  { numero: "2000", nom: "TPS à payer", type: "PASSIF" },
  { numero: "2010", nom: "TVQ à payer", type: "PASSIF" },
  { numero: "2020", nom: "RRQ à payer", type: "PASSIF" },
  { numero: "2030", nom: "RQAP à payer", type: "PASSIF" },
  { numero: "2040", nom: "Assurance-emploi à payer", type: "PASSIF" },
  { numero: "2050", nom: "Impôt fédéral à payer (employés)", type: "PASSIF" },
  { numero: "2060", nom: "Impôt Québec à payer (employés)", type: "PASSIF" },
  { numero: "2070", nom: "Vacances à payer", type: "PASSIF" },
  { numero: "2100", nom: "Comptes fournisseurs", type: "PASSIF" },
  { numero: "3000", nom: "Capital / Bénéfices non répartis", type: "CAPITAUX_PROPRES" },
  { numero: "3010", nom: "Soldes d'ouverture", type: "CAPITAUX_PROPRES" },
  { numero: "4000", nom: "Main-d'œuvre mécanique", type: "REVENU" },
  { numero: "4010", nom: "Vente de pièces", type: "REVENU" },
  { numero: "4020", nom: "Vente de pneus", type: "REVENU" },
  { numero: "4030", nom: "Alignement / équilibrage", type: "REVENU" },
  { numero: "4040", nom: "Entreposage de pneus", type: "REVENU" },
  { numero: "4050", nom: "Remorquage", type: "REVENU" },
  { numero: "4060", nom: "Autres revenus", type: "REVENU" },
  // typeCharge par défaut pour le seuil de rentabilité : VARIABLE seulement
  // pour le coûtant des pièces (scale directement avec les ventes) —
  // tout le reste est traité comme FIXE (classification standard à court
  // terme pour une petite entreprise : loyer, salaires, assurances, etc.
  // ne bougent pas selon le volume d'une journée donnée). Modifiable par
  // compte dans Comptabilité → Plan comptable.
  { numero: "5000", nom: "Coût des pièces vendues", type: "DEPENSE", typeCharge: "VARIABLE" },
  { numero: "5100", nom: "Dépenses générales", type: "DEPENSE", typeCharge: "FIXE" },
  { numero: "5200", nom: "Salaires", type: "DEPENSE", typeCharge: "FIXE" },
  { numero: "5210", nom: "Charges sociales de l'employeur", type: "DEPENSE", typeCharge: "FIXE" },
  { numero: "5215", nom: "Vacances", type: "DEPENSE", typeCharge: "FIXE" },
  { numero: "5220", nom: "Électricité", type: "DEPENSE", typeCharge: "FIXE" },
  { numero: "5230", nom: "Loyer", type: "DEPENSE", typeCharge: "FIXE" },
  { numero: "5240", nom: "Assurances", type: "DEPENSE", typeCharge: "FIXE" },
  { numero: "5250", nom: "Téléphone et Internet", type: "DEPENSE", typeCharge: "FIXE" },
  { numero: "5260", nom: "Entretien et réparations", type: "DEPENSE", typeCharge: "FIXE" },
  { numero: "5270", nom: "Fournitures de bureau", type: "DEPENSE", typeCharge: "FIXE" },
  { numero: "5280", nom: "Publicité et marketing", type: "DEPENSE", typeCharge: "FIXE" },
  { numero: "5290", nom: "Frais bancaires et professionnels", type: "DEPENSE", typeCharge: "FIXE" },
  { numero: "5300", nom: "Amortissement", type: "DEPENSE", typeCharge: "FIXE" },
];

// Crée les comptes manquants du plan standard (idempotent — ne duplique
// jamais un compte déjà existant, identifié par son numéro, et ne touche
// jamais à un compte existant : un nom renommé par le développeur doit
// rester tel quel, peu importe combien de fois cette fonction est rappelée)
async function assurerPlanComptable() {
  for (const c of PLAN_COMPTABLE_STANDARD) {
    await prisma.compte.upsert({
      where: { numero: c.numero },
      update: {},
      create: c,
    });
  }
}

async function compteParNumero(numero) {
  const compte = await prisma.compte.findUnique({ where: { numero } });
  if (!compte) throw new Error(`Compte ${numero} introuvable — assurerPlanComptable() n'a pas été appelé.`);
  return compte;
}

// Enregistre une écriture comptable complète. `lignes` est un tableau de
// { compteNumero, debit, credit, description }. Les débits doivent
// toujours égaler les crédits (vérifié avant l'enregistrement).
async function enregistrerEcriture({ date, description, source, sourceId, reference, lignes, creePar }) {
  await verifierPeriodeModifiable(date, { nouvellePiece: true });

  const totalDebit = lignes.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lignes.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.02) {
    throw new Error(`Écriture déséquilibrée : débit ${totalDebit} ≠ crédit ${totalCredit}`);
  }

  const comptes = await Promise.all(lignes.map((l) => compteParNumero(l.compteNumero)));

  // Réessaie automatiquement si le numéro d'écriture est pris entretemps
  // (deux paies/factures créées presque simultanément) — ne perd jamais
  // une écriture à cause d'une simple collision de numéro
  for (let essai = 0; essai < 8; essai++) {
    const derniere = await prisma.ecritureComptable.findFirst({ orderBy: { numero: "desc" } });
    let prochainNum = 1;
    if (derniere) {
      const partieNum = parseInt(derniere.numero.split("-")[1], 10);
      if (!isNaN(partieNum)) prochainNum = partieNum + 1;
    }
    const numero = `EC-${String(1000 + prochainNum).slice(1)}`;

    try {
      return await prisma.ecritureComptable.create({
        data: {
          numero,
          date,
          description,
          source: source || null,
          sourceId: sourceId || null,
          reference: reference || null,
          creePar: creePar || null,
          lignes: {
            create: lignes.map((l, i) => ({
              compteId: comptes[i].id,
              debit: l.debit || 0,
              credit: l.credit || 0,
              description: l.description || null,
            })),
          },
        },
        include: { lignes: true },
      });
    } catch (e) {
      if (e.code === "P2002") continue; // numéro pris entretemps — réessaie avec le suivant
      throw e;
    }
  }
  throw new Error("Impossible de générer un numéro d'écriture disponible après plusieurs tentatives.");
}

// Poste de tâche par défaut ("Main-d'œuvre", facturé aux heures) — les
// autres postes sont directement des comptes REVENU du plan comptable
// (Probleme.categorieRevenu contient alors le numéro du compte, ex: "4030").
// Ces 3 comptes sont gérés automatiquement ailleurs (heures pour 4000,
// répartition des pièces/pneus pour 4010/4020) — jamais sélectionnables
// comme poste manuel sur une tâche.
const COMPTE_MAIN_OEUVRE = "4000";
const COMPTES_REVENU_RESERVES = ["4000", "4010", "4020"];

// Catégories d'inventaire créées par défaut (idempotent, comme le plan
// comptable) — d'autres peuvent être ajoutées depuis l'interface
async function assurerCategoriesInventaire() {
  const defauts = [
    { code: "PIECE", nom: "Pièces", compteRevenuNumero: "4010" },
    { code: "PNEU", nom: "Pneus", compteRevenuNumero: "4020" },
  ];
  for (const c of defauts) {
    await prisma.categorieInventaire.upsert({ where: { code: c.code }, update: {}, create: c });
  }
}

// Appelé quand une facture officielle est émise — enregistre la vente en
// répartissant automatiquement le revenu par catégorie (main-d'œuvre,
// alignement, remorquage, entreposage, pièces, pneus…), l'escompte étant
// réparti proportionnellement entre toutes les lignes de revenu.
async function posterFactureEmise(bon, facture, creePar) {
  if (!(await moduleComptabiliteActif())) return; // module désactivé — aucune écriture créée
  await assurerPlanComptable();
  await assurerCategoriesInventaire();
  const categoriesInventaire = await prisma.categorieInventaire.findMany();
  const compteParCategorieInventaire = Object.fromEntries(categoriesInventaire.map((c) => [c.code, c.compteRevenuNumero]));

  const sousTotalAvantEscompte = facture.totalFacture + (facture.escompteApplique || 0);
  const ratioEscompte = sousTotalAvantEscompte > 0 ? (facture.escompteApplique || 0) / sousTotalAvantEscompte : 0;

  // Revenu par compte — main-d'œuvre sur les heures poinçonnées (compte
  // 4000), les autres postes sur leur ligne de facturation manuelle (prix
  // unitaire × quantité), crédités directement au compte choisi sur la
  // tâche (ex: "4030"), quel que soit le compte — pas de liste fixe à jour.
  const mainOeuvreParCategorie = {};
  for (const pr of bon.problemes) {
    const cat = pr.categorieRevenu || "MAIN_OEUVRE";
    const compteNumero = cat === "MAIN_OEUVRE" ? COMPTE_MAIN_OEUVRE : cat;
    const montant = cat === "MAIN_OEUVRE"
      ? pr.entreesTemps.filter((t) => t.fin).reduce((s, t) => s + (new Date(t.fin) - new Date(t.debut)) / 3600000, 0) * facture.tauxHoraireUtilise
      : (pr.facturePrixUnitaire || 0) * (pr.factureQte || 1);
    mainOeuvreParCategorie[compteNumero] = (mainOeuvreParCategorie[compteNumero] || 0) + montant;
  }

  // Pièces par catégorie (pneu vs pièce régulière)
  const piecesParCategorie = {};
  for (const pr of bon.problemes) {
    for (const l of pr.pieces) {
      const cat = l.piece?.categorie || "PIECE";
      piecesParCategorie[cat] = (piecesParCategorie[cat] || 0) + l.qte * l.prix;
    }
  }

  const lignes = [{ compteNumero: "1100", debit: facture.totalAvecTaxes, description: `Facture ${facture.numero}` }];

  for (const [compteNumero, montant] of Object.entries(mainOeuvreParCategorie)) {
    const apresEscompte = montant * (1 - ratioEscompte);
    if (apresEscompte > 0.005) lignes.push({ compteNumero, credit: apresEscompte, description: `Facture ${facture.numero}` });
  }
  for (const [cat, montant] of Object.entries(piecesParCategorie)) {
    const apresEscompte = montant * (1 - ratioEscompte);
    if (apresEscompte > 0.005) lignes.push({ compteNumero: compteParCategorieInventaire[cat] || "4010", credit: apresEscompte, description: `Facture ${facture.numero}` });
  }
  if (facture.tpsMontant > 0) lignes.push({ compteNumero: "2000", credit: facture.tpsMontant, description: `Facture ${facture.numero}` });
  if (facture.tvqMontant > 0) lignes.push({ compteNumero: "2010", credit: facture.tvqMontant, description: `Facture ${facture.numero}` });

  // Coût des marchandises vendues — sous-paire équilibrée à part (débit
  // dépense / crédit inventaire), n'affecte pas l'équilibre du reste
  let coutTotal = 0;
  for (const pr of bon.problemes) {
    for (const l of pr.pieces) {
      coutTotal += l.qte * (l.piece?.coutant || 0);
    }
  }
  if (coutTotal > 0.005) {
    lignes.push({ compteNumero: "5000", debit: coutTotal, description: `Coût des pièces — facture ${facture.numero}` });
    lignes.push({ compteNumero: "1200", credit: coutTotal, description: `Coût des pièces — facture ${facture.numero}` });
  }

  await enregistrerEcriture({
    date: facture.dateEmission,
    description: `Facture ${facture.numero} émise`,
    source: "FACTURE_EMISE",
    sourceId: facture.id,
    lignes,
    creePar,
  });
}

// Appelé quand une facture passe à "Payée" — enregistre l'encaissement
async function posterFacturePayee(facture, creePar) {
  if (!(await moduleComptabiliteActif())) return; // module désactivé — aucune écriture créée
  await assurerPlanComptable();
  await enregistrerEcriture({
    date: facture.datePaiement || new Date(),
    description: `Facture ${facture.numero} payée`,
    source: "FACTURE_PAYEE",
    sourceId: facture.id,
    lignes: [
      { compteNumero: "1000", debit: facture.totalAvecTaxes, description: `Facture ${facture.numero}` },
      { compteNumero: "1100", credit: facture.totalAvecTaxes, description: `Facture ${facture.numero}` },
    ],
    creePar,
  });
}

// Enregistre les soldes de départ, en une seule écriture équilibrée par une
// contrepartie automatique au compte "Soldes d'ouverture". `soldes` est un
// tableau de { compteNumero, montant, type } — le montant est toujours
// positif, `type` du compte détermine de quel côté (débit/crédit) il va.
async function enregistrerSoldesOuverture(soldes) {
  await assurerPlanComptable();
  const NORMAL_DEBIT = ["ACTIF", "DEPENSE"];

  const lignes = [];
  let totalDebitReel = 0;
  let totalCreditReel = 0;

  for (const s of soldes) {
    if (!s.montant || s.montant === 0) continue;
    const compte = await compteParNumero(s.compteNumero);
    if (NORMAL_DEBIT.includes(compte.type)) {
      lignes.push({ compteNumero: s.compteNumero, debit: s.montant, description: "Solde d'ouverture" });
      totalDebitReel += s.montant;
    } else {
      lignes.push({ compteNumero: s.compteNumero, credit: s.montant, description: "Solde d'ouverture" });
      totalCreditReel += s.montant;
    }
  }

  if (lignes.length === 0) throw new Error("Aucun solde à enregistrer.");

  // Contrepartie automatique pour équilibrer l'écriture
  const difference = totalDebitReel - totalCreditReel;
  if (difference > 0) {
    lignes.push({ compteNumero: "3010", credit: difference, description: "Contrepartie soldes d'ouverture" });
  } else if (difference < 0) {
    lignes.push({ compteNumero: "3010", debit: -difference, description: "Contrepartie soldes d'ouverture" });
  }

  return enregistrerEcriture({
    date: new Date(),
    description: "Soldes d'ouverture",
    source: "OUVERTURE",
    lignes,
  });
}

// Comptabilise une paie versée — dépense de salaire + charges sociales
// employeur, contrepartie au montant net payé (banque) et aux sommes dues
// au gouvernement (retenues à la source, part employé ET employeur)
async function posterPaie(paie, creePar) {
  if (!(await moduleComptabiliteActif())) return; // module désactivé — aucune écriture créée
  await assurerPlanComptable();

  const chargesSociales = paie.rrqEmployeur + paie.rqapEmployeur + paie.aeEmployeur;
  const vacances = paie.vacancesAccumulees || 0;
  const estPaieVacances = paie.typePaie === "VACANCES";

  // Le montant réellement versé à la banque est calculé comme le solde qui
  // équilibre l'écriture, plutôt que paie.salaireNet tel quel — évite les
  // écarts d'un cent quand plusieurs déductions sont arrondies séparément
  const totalDebitAvantBanque = paie.salaireBrut + chargesSociales + vacances;
  const totalCreditAutresQueBanque =
    (paie.rrqEmploye + paie.rrqEmployeur) +
    (paie.rqapEmploye + paie.rqapEmployeur) +
    (paie.aeEmploye + paie.aeEmployeur) +
    paie.impotFederal + paie.impotQuebec + vacances;
  const versementBanque = Math.round((totalDebitAvantBanque - totalCreditAutresQueBanque) * 100) / 100;

  const lignes = estPaieVacances
    // Paie de vacances : puise dans ce qu'on doit déjà à l'employé (pas une
    // nouvelle dépense — la dépense a été comptée au moment de l'accumulation)
    ? [{ compteNumero: "2070", debit: paie.salaireBrut, description: "Versement de vacances accumulées" }]
    // Paie régulière : vraie dépense de salaire
    : [{ compteNumero: "5200", debit: paie.salaireBrut, description: "Salaire brut" }];

  if (chargesSociales > 0) {
    lignes.push({ compteNumero: "5210", debit: chargesSociales, description: "Charges sociales employeur" });
  }
  lignes.push({ compteNumero: "1000", credit: versementBanque, description: "Versement net" });
  if (paie.rrqEmploye + paie.rrqEmployeur > 0) {
    lignes.push({ compteNumero: "2020", credit: paie.rrqEmploye + paie.rrqEmployeur, description: "RRQ à remettre" });
  }
  if (paie.rqapEmploye + paie.rqapEmployeur > 0) {
    lignes.push({ compteNumero: "2030", credit: paie.rqapEmploye + paie.rqapEmployeur, description: "RQAP à remettre" });
  }
  if (paie.aeEmploye + paie.aeEmployeur > 0) {
    lignes.push({ compteNumero: "2040", credit: paie.aeEmploye + paie.aeEmployeur, description: "AE à remettre" });
  }
  if (paie.impotFederal > 0) {
    lignes.push({ compteNumero: "2050", credit: paie.impotFederal, description: "Impôt fédéral à remettre" });
  }
  if (paie.impotQuebec > 0) {
    lignes.push({ compteNumero: "2060", credit: paie.impotQuebec, description: "Impôt Québec à remettre" });
  }
  // Vacances accumulées sur une paie RÉGULIÈRE seulement — une paie de
  // vacances n'accumule pas de nouvelles vacances sur elle-même
  if (vacances > 0 && !estPaieVacances) {
    lignes.push({ compteNumero: "5215", debit: vacances, description: "Vacances accumulées" });
    lignes.push({ compteNumero: "2070", credit: vacances, description: "Vacances accumulées" });
  }

  await enregistrerEcriture({
    date: paie.dateVersement || new Date(),
    description: estPaieVacances ? `Paie de vacances versée` : `Paie versée`,
    source: "PAIE",
    sourceId: paie.id,
    lignes,
    creePar,
  });
}

// Crée un compte avec le prochain numéro disponible dans une plage donnée
// (ex. "REVENU" → 4xxx, "DEPENSE" → 5xxx). Réessaie automatiquement si le
// numéro est pris entretemps (deux créations presque simultanées), pour
// ne jamais planter sur une simple collision de numéro.
async function creerCompteAvecProchainNumero(type, nom, depart) {
  for (let essai = 0; essai < 8; essai++) {
    const comptes = await prisma.compte.findMany({ where: { type } });
    const max = comptes.reduce((m, c) => Math.max(m, parseInt(c.numero, 10) || 0), depart);
    const numero = String(max + 10);
    try {
      await prisma.compte.create({ data: { numero, nom, type } });
      return numero;
    } catch (e) {
      if (e.code === "P2002") continue; // numéro pris entretemps — réessaie avec le suivant
      throw e;
    }
  }
  throw new Error("Impossible de générer un numéro de compte disponible.");
}

// Trouve le prochain numéro de compte de revenu disponible (4xxx),
// en incrémentant de 10 à partir du plus élevé existant
async function prochainNumeroRevenu() {
  const comptes = await prisma.compte.findMany({ where: { type: "REVENU" } });
  const max = comptes.reduce((m, c) => Math.max(m, parseInt(c.numero, 10) || 0), 4010);
  return String(max + 10);
}

// Trouve le prochain numéro de compte de dépense disponible (5xxx),
// en incrémentant de 10 à partir du plus élevé existant
async function prochainNumeroDepense() {
  const comptes = await prisma.compte.findMany({ where: { type: "DEPENSE" } });
  const max = comptes.reduce((m, c) => Math.max(m, parseInt(c.numero, 10) || 0), 5100);
  return String(max + 10);
}

// Catégories de dépenses créées par défaut — d'autres ajoutables depuis l'interface
async function assurerCategoriesDepense() {
  const defauts = [
    { code: "GENERAL", nom: "Dépenses générales", compteDepenseNumero: "5100" },
    { code: "ELECTRICITE", nom: "Électricité", compteDepenseNumero: "5220" },
    { code: "LOYER", nom: "Loyer", compteDepenseNumero: "5230" },
    { code: "ASSURANCES", nom: "Assurances", compteDepenseNumero: "5240" },
    { code: "TELEPHONE_INTERNET", nom: "Téléphone et Internet", compteDepenseNumero: "5250" },
    { code: "ENTRETIEN_REPARATIONS", nom: "Entretien et réparations", compteDepenseNumero: "5260" },
    { code: "FOURNITURES_BUREAU", nom: "Fournitures de bureau", compteDepenseNumero: "5270" },
    { code: "PUBLICITE_MARKETING", nom: "Publicité et marketing", compteDepenseNumero: "5280" },
    { code: "FRAIS_BANCAIRES", nom: "Frais bancaires et professionnels", compteDepenseNumero: "5290" },
  ];
  for (const c of defauts) {
    await prisma.categorieDepense.upsert({ where: { code: c.code }, update: {}, create: c });
  }
}

// Appelé quand une dépense/facture fournisseur est reçue — enregistre le
// montant dû, peu importe si elle est payée tout de suite ou plus tard
async function posterDepenseRecue(depense, creePar) {
  if (!(await moduleComptabiliteActif())) return;
  await assurerPlanComptable();

  const tps = depense.tpsPayee || 0;
  const tvq = depense.tvqPayee || 0;
  const montantAvantTaxes = depense.montant - tps - tvq;

  const lignes = [
    { compteNumero: depense.compteDepenseNumero, debit: montantAvantTaxes, description: depense.description },
  ];
  // La taxe payée sur un achat est récupérable — elle réduit directement ce
  // qu'on doit remettre au gouvernement (débite le même compte que celui où
  // la taxe perçue sur les ventes est créditée)
  if (tps > 0) lignes.push({ compteNumero: "2000", debit: tps, description: `TPS payée — ${depense.description}` });
  if (tvq > 0) lignes.push({ compteNumero: "2010", debit: tvq, description: `TVQ payée — ${depense.description}` });
  lignes.push({ compteNumero: "2100", credit: depense.montant, description: depense.description });

  await enregistrerEcriture({
    date: depense.dateFacture,
    description: `Dépense — ${depense.description}`,
    source: "DEPENSE_RECUE",
    sourceId: depense.id,
    lignes,
    creePar,
  });
}

// Appelé quand une dépense est marquée payée — sort l'argent de la banque
async function posterDepensePayee(depense, creePar) {
  if (!(await moduleComptabiliteActif())) return;
  await assurerPlanComptable();
  const description = `Paiement — ${depense.description}${depense.referenceVersement ? ` (réf. ${depense.referenceVersement})` : ""}`;
  await enregistrerEcriture({
    date: depense.datePaiement || new Date(),
    description,
    source: "DEPENSE_PAYEE",
    sourceId: depense.id,
    lignes: [
      { compteNumero: "2100", debit: depense.montant, description },
      { compteNumero: "1000", credit: depense.montant, description },
    ],
    creePar,
  });
}

// Comptabilise l'achat d'une immobilisation — payé comptant par défaut
// (sort directement de la banque). Pour un achat à crédit, enregistre plutôt
// une dépense normale et ajoute l'immobilisation séparément si nécessaire.
async function posterAcquisitionImmobilisation(immobilisation, creePar) {
  if (!(await moduleComptabiliteActif())) return;
  await assurerPlanComptable();
  await enregistrerEcriture({
    date: immobilisation.dateAcquisition,
    description: `Achat immobilisation — ${immobilisation.nom}`,
    source: "IMMOBILISATION_ACQUISE",
    sourceId: immobilisation.id,
    lignes: [
      { compteNumero: "1400", debit: immobilisation.coutAcquisition, description: immobilisation.nom },
      { compteNumero: "1000", credit: immobilisation.coutAcquisition, description: immobilisation.nom },
    ],
    creePar,
  });
}

// Calcule et comptabilise l'amortissement linéaire de TOUTES les
// immobilisations actives pour un mois donné ("YYYY-MM"). Refuse de le
// refaire deux fois pour le même mois.
async function posterAmortissementMensuel(mois, creePar) {
  if (!(await moduleComptabiliteActif())) throw new Error("Le module Comptabilité est désactivé.");
  await assurerPlanComptable();

  const deja = await prisma.amortissementMensuel.findUnique({ where: { mois } });
  if (deja) throw new Error(`L'amortissement de ${mois} a déjà été comptabilisé (${deja.montant.toFixed(2)} $).`);

  const immobilisations = await prisma.immobilisation.findMany({ where: { actif: true } });
  let total = 0;
  for (const im of immobilisations) {
    const baseAmortissable = Math.max(0, im.coutAcquisition - im.valeurResiduelle);
    total += baseAmortissable / im.dureeVieAns / 12;
  }
  total = Math.round(total * 100) / 100;

  if (total <= 0) {
    await prisma.amortissementMensuel.create({ data: { mois, montant: 0 } });
    return 0;
  }

  const [an, m] = mois.split("-");
  const dateEcriture = new Date(Number(an), Number(m), 0); // dernier jour du mois

  await enregistrerEcriture({
    date: dateEcriture,
    description: `Amortissement — ${mois}`,
    source: "AMORTISSEMENT",
    sourceId: mois,
    lignes: [
      { compteNumero: "5300", debit: total, description: `Amortissement ${mois}` },
      { compteNumero: "1410", credit: total, description: `Amortissement ${mois}` },
    ],
    creePar,
  });

  await prisma.amortissementMensuel.create({ data: { mois, montant: total } });
  return total;
}

// Renverse une écriture existante (débit ↔ crédit inversés) — utilisé pour
// corriger une paie sans jamais supprimer l'original, gardant une trace
// complète de ce qui a été annulé et pourquoi
async function renverserEcriture(sourceType, sourceId, description, creePar) {
  const originale = await prisma.ecritureComptable.findFirst({
    where: { source: sourceType, sourceId },
    include: { lignes: { include: { compte: true } } },
  });
  if (!originale) return; // rien à renverser (comptabilité désactivée à l'époque, par exemple)

  await enregistrerEcriture({
    date: new Date(),
    description,
    source: `${sourceType}_CORRECTION`,
    sourceId,
    lignes: originale.lignes.map((l) => ({
      compteNumero: l.compte.numero,
      debit: l.credit,
      credit: l.debit,
      description: l.description,
    })),
    creePar,
  });
}

// Enregistre le paiement d'une remise gouvernementale (DAS, TPS/TVQ) — règle
// une dette déjà comptabilisée, débite directement les comptes de passif
// concernés plutôt que de créer une nouvelle dépense
async function posterRemiseGouvernementale(paiements, description, creePar) {
  if (!(await moduleComptabiliteActif())) throw new Error("Le module Comptabilité est désactivé.");
  await assurerPlanComptable();

  const total = paiements.reduce((s, p) => s + p.montant, 0);
  if (total <= 0) throw new Error("Aucun montant à payer.");

  const lignes = paiements
    .filter((p) => p.montant > 0)
    .map((p) => ({ compteNumero: p.compteNumero, debit: p.montant, description: p.description }));
  lignes.push({ compteNumero: "1000", credit: total, description });

  await enregistrerEcriture({
    date: new Date(),
    description,
    source: "REMISE_GOUVERNEMENTALE",
    sourceId: null,
    lignes,
    creePar,
  });
  return total;
}

module.exports = { assurerPlanComptable, assurerCategoriesInventaire, assurerCategoriesDepense, prochainNumeroDepense, prochainNumeroRevenu, creerCompteAvecProchainNumero, obtenirStatutPeriode, verifierPeriodeModifiable, enregistrerEcriture, renverserEcriture, posterFactureEmise, posterFacturePayee, posterPaie, posterDepenseRecue, posterDepensePayee, posterAcquisitionImmobilisation, posterAmortissementMensuel, posterRemiseGouvernementale, enregistrerSoldesOuverture, PLAN_COMPTABLE_STANDARD, COMPTE_MAIN_OEUVRE, COMPTES_REVENU_RESERVES };
