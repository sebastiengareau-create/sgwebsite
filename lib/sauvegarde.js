const { prisma } = require("./prisma");
const { Prisma } = require("@prisma/client");

// Champs @unique (autres que id) par modèle, dérivés directement du schéma —
// utilisé pour désamorcer un conflit AVANT de tenter une création (Postgres
// abandonne toute la transaction dès la première erreur de contrainte, donc
// il faut éviter l'erreur plutôt que la rattraper après coup).
function champsUniquesParModele() {
  const map = {};
  for (const modele of Prisma.dmmf.datamodel.models) {
    const nom = modele.name.charAt(0).toLowerCase() + modele.name.slice(1);
    map[nom] = modele.fields.filter((c) => c.isUnique && c.name !== "id").map((c) => c.name);
  }
  return map;
}
const CHAMPS_UNIQUES = champsUniquesParModele();

// Ordre d'exportation — n'a pas d'importance pour lire, mais on garde le
// même ordre logique que l'importation pour que ce soit lisible.
const MODELES = [
  "user", "client", "tacheInterne", "compte", "categorieInventaire",
  "bonTravail", "probleme", "photo", "piece", "pieceUtilisee",
  "entreeTemps", "entreeTempsInterne", "facture",
  "soumission", "tacheSoumission", "pieceEstimee",
  "rendezVous", "ecritureComptable", "ligneEcriture", "parametre",
  "periodeComptable", "fermeturePeriodeHistorique", "lotPaie", "paie",
  "rapprochementBancaire", "fournisseur", "categorieDepense", "depense", "ligneDepense",
  "immobilisation", "amortissementMensuel",
];

async function exporterDonnees() {
  const donnees = { version: 1, genereLe: new Date().toISOString() };
  for (const modele of MODELES) {
    donnees[modele] = await prisma[modele].findMany();
  }
  return donnees;
}

// Les dates arrivent en texte depuis le JSON — Prisma a besoin de vrais
// objets Date pour les champs qui en sont
function normaliserDates(ligne) {
  const copie = { ...ligne };
  for (const cle of Object.keys(copie)) {
    if (typeof copie[cle] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(copie[cle])) {
      copie[cle] = new Date(copie[cle]);
    }
  }
  return copie;
}

// Certaines tables (plan comptable, catégories…) sont re-semées
// automatiquement par le logiciel dès qu'une page les utilise (ex.
// assurerPlanComptable) — si ça arrive entre un effacement et une
// restauration, la table n'est plus vraiment vide : elle contient déjà des
// lignes standards, mais avec de NOUVEAUX identifiants générés à ce
// moment-là. Réécrire par-dessus par id (upsert) essaierait alors de CRÉER
// une ligne dont un autre champ unique (ex. le numéro de compte "1000") est
// déjà pris par cette ligne fantôme. Postgres abandonne toute la
// transaction dès la première erreur de contrainte (impossible de
// "rattraper" après coup et continuer) — donc on désamorce le conflit
// AVANT de créer, en retirant toute ligne fantôme qui bloquerait.
async function upsertAvecResolutionConflit(tx, modele, donneesLigne) {
  const existeDeja = await tx[modele].findUnique({ where: { id: donneesLigne.id } });
  if (!existeDeja) {
    for (const champ of CHAMPS_UNIQUES[modele] || []) {
      const valeur = donneesLigne[champ];
      if (valeur === undefined || valeur === null) continue;
      await tx[modele].deleteMany({ where: { [champ]: valeur, NOT: { id: donneesLigne.id } } });
    }
  }
  await tx[modele].upsert({ where: { id: donneesLigne.id }, update: donneesLigne, create: donneesLigne });
}

// Réimporte une sauvegarde — irréversible pour les modèles qu'elle contient.
// Un modèle ABSENT du fichier (ex. une sauvegarde faite avant qu'un nouveau
// modèle existe dans le logiciel) n'est jamais touché, pour ne jamais
// effacer des données réelles qu'une vieille sauvegarde n'a simplement pas
// capturées.
//
// Fonctionne en deux passes plutôt que "tout vider puis tout recréer" :
// 1) Chaque ligne de la sauvegarde est réécrite par-dessus l'existant
//    (upsert par id), parent avant enfant — jamais de suppression d'une
//    ligne qui va être recréée juste après, donc jamais de violation de
//    contrainte même si une donnée hors sauvegarde (ex. une paie) pointe
//    encore vers elle (ex. un employé) au moment de la restauration.
// 2) Les lignes qui existaient avant la restauration mais qui ne sont plus
//    dans la sauvegarde sont retirées, enfant avant parent.
async function importerDonnees(donnees) {
  if (!donnees || typeof donnees !== "object") throw new Error("Fichier de sauvegarde invalide.");

  const modelesPresents = MODELES.filter((m) => Array.isArray(donnees[m]));

  await prisma.$transaction(
    async (tx) => {
      for (const modele of modelesPresents) {
        for (const ligne of donnees[modele]) {
          const donneesLigne = normaliserDates(ligne);
          await upsertAvecResolutionConflit(tx, modele, donneesLigne);
        }
      }
      for (const modele of [...modelesPresents].reverse()) {
        const idsSauvegarde = donnees[modele].map((l) => l.id);
        await tx[modele].deleteMany({ where: { id: { notIn: idsSauvegarde } } });
      }
    },
    { timeout: 60000 } // gros volume possible — jusqu'à 60 secondes
  );
}

// Efface des données pour repartir à 0 — jamais utilisé dans le cadre d'une
// restauration (voir importerDonnees), plutôt pour réinitialiser une
// installation (ex. avant de revendre le template à un nouveau client).
// `inclureConfiguration: false` garde "user" (comptes employés) et
// "parametre" (nom d'entreprise, taux, taxes, horaire…) intacts — tout le
// reste (bons, factures, clients, paie, journal, fournisseurs…) est vidé.
async function effacerToutesLesDonnees({ inclureConfiguration }) {
  const modelesACibler = inclureConfiguration ? MODELES : MODELES.filter((m) => m !== "user" && m !== "parametre");

  await prisma.$transaction(
    async (tx) => {
      for (const modele of [...modelesACibler].reverse()) {
        await tx[modele].deleteMany();
      }
    },
    { timeout: 60000 }
  );
}

module.exports = { exporterDonnees, importerDonnees, effacerToutesLesDonnees, MODELES };
