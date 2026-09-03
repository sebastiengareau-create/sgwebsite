const { prisma } = require("./prisma");

// Ordre d'exportation — n'a pas d'importance pour lire, mais on garde le
// même ordre logique que l'importation pour que ce soit lisible.
const MODELES = [
  "user", "client", "tacheInterne", "compte", "categorieInventaire",
  "bonTravail", "probleme", "photo", "piece", "pieceUtilisee",
  "entreeTemps", "entreeTempsInterne", "facture",
  "soumission", "tacheSoumission", "pieceEstimee",
  "rendezVous", "ecritureComptable", "ligneEcriture", "parametre",
  "periodeComptable", "fermeturePeriodeHistorique", "lotPaie", "paie",
  "rapprochementBancaire", "fournisseur", "categorieDepense", "depense",
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
          await tx[modele].upsert({ where: { id: donneesLigne.id }, update: donneesLigne, create: donneesLigne });
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

module.exports = { exporterDonnees, importerDonnees, MODELES };
