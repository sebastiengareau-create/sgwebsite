// ============================================================
// SCRIPT À USAGE UNIQUE — accorde le niveau "super-administrateur" à un
// compte, par son courriel. Aucune interface de l'application ne peut
// faire ça, volontairement — même sur une installation vendue à un
// futur client, personne ne peut se donner ce niveau d'accès autrement
// qu'en exécutant ce script directement contre la base de données.
//
// Utilisation (dans le dossier garage-backend, avec la vraie base
// connectée — donc via le tunnel comme pour une migration) :
//
//   node prisma/rendre-super-admin.js toncourriel@exemple.com
// ============================================================

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const courriel = process.argv[2];
  if (!courriel) {
    console.error("Utilisation : node prisma/rendre-super-admin.js toncourriel@exemple.com");
    process.exit(1);
  }

  const utilisateur = await prisma.user.findUnique({ where: { courriel } });
  if (!utilisateur) {
    console.error(`Aucun compte trouvé avec le courriel : ${courriel}`);
    process.exit(1);
  }

  await prisma.user.update({ where: { courriel }, data: { estSuperAdmin: true } });
  console.log(`✅ ${utilisateur.nom} (${courriel}) est maintenant super-administrateur.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
