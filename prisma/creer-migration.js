// Crée une migration à partir des changements faits dans schema.prisma.
//
//   npm run migration -- nom_du_changement
//
// Compare la base pointée par DATABASE_URL (lecture seule, rien n'y est
// modifié) au schéma, et écrit le SQL de l'écart dans
// prisma/migrations/<horodatage>_<nom>/migration.sql. La migration est
// appliquée plus tard, au démarrage de l'app sur Railway (prisma migrate
// deploy). Relis toujours le SQL généré avant de le pousser.
//
// Important : la base comparée doit déjà avoir toutes les migrations
// existantes — déploie une migration avant d'en créer une suivante, sinon
// la nouvelle contiendra aussi les changements de la précédente.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const nom = (process.argv[2] || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
if (!nom) {
  console.error("Usage : npm run migration -- nom_du_changement");
  process.exit(1);
}

if (fs.existsSync(".env")) process.loadEnvFile(".env");
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL introuvable (.env).");
  process.exit(1);
}

// Appel direct du CLI Prisma par Node, sans shell : l'URL (qui contient le
// mot de passe de la base) n'est jamais recollée dans une ligne de commande.
const sql = execFileSync(
  process.execPath,
  [require.resolve("prisma/build/index.js"), "migrate", "diff", "--from-url", process.env.DATABASE_URL, "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
  { encoding: "utf8", env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" } }
);

if (/This is an empty migration/.test(sql)) {
  console.log("Aucun changement entre la base et schema.prisma — rien à créer.");
  process.exit(0);
}

const horodatage = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const dossier = path.join("prisma", "migrations", `${horodatage}_${nom}`);
fs.mkdirSync(dossier, { recursive: true });
fs.writeFileSync(path.join(dossier, "migration.sql"), sql);
console.log(`Migration créée : ${dossier}/migration.sql\n\n${sql}`);
