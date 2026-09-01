const { prisma } = require("./prisma");

// Ordre d'exportation — n'a pas d'importance pour lire, mais on garde le
// même ordre logique que l'importation pour que ce soit lisible.
const MODELES = [
  "user", "client", "tacheInterne", "compte",
  "bonTravail", "probleme", "photo", "piece", "pieceUtilisee",
  "entreeTemps", "entreeTempsInterne", "facture",
  "soumission", "tacheSoumission", "pieceEstimee",
  "rendezVous", "ecritureComptable", "ligneEcriture", "parametre",
  "periodeComptable", "fermeturePeriodeHistorique",
];

async function exporterDonnees() {
  const donnees = { version: 1, genereLe: new Date().toISOString() };
  for (const modele of MODELES) {
    donnees[modele] = await prisma[modele].findMany();
  }
  return donnees;
}

// Réimporte tout — VIDE D'ABORD toutes les tables, donc irréversible.
// L'ordre respecte les dépendances (un enfant après son parent) pour ne
// jamais violer une contrainte de clé étrangère.
async function importerDonnees(donnees) {
  if (!donnees || typeof donnees !== "object") throw new Error("Fichier de sauvegarde invalide.");

  await prisma.$transaction(
    async (tx) => {
      // Suppression dans l'ordre INVERSE (l'enfant avant son parent)
      for (const modele of [...MODELES].reverse()) {
        await tx[modele].deleteMany();
      }
      // Recréation dans l'ordre normal (le parent avant son enfant), en
      // gardant les mêmes identifiants qu'à l'origine pour préserver tous
      // les liens entre les tables
      for (const modele of MODELES) {
        const lignes = donnees[modele];
        if (!Array.isArray(lignes) || lignes.length === 0) continue;
        for (const ligne of lignes) {
          const donneesLigne = { ...ligne };
          // Les dates arrivent en texte depuis le JSON — Prisma a besoin de
          // vrais objets Date pour les champs qui en sont
          for (const cle of Object.keys(donneesLigne)) {
            if (typeof donneesLigne[cle] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(donneesLigne[cle])) {
              donneesLigne[cle] = new Date(donneesLigne[cle]);
            }
          }
          await tx[modele].create({ data: donneesLigne });
        }
      }
    },
    { timeout: 60000 } // gros volume possible — jusqu'à 60 secondes
  );
}

module.exports = { exporterDonnees, importerDonnees, MODELES };
