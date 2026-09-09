// ============================================================
// SCRIPT À USAGE UNIQUE — attribue un numéro séquentiel (EMP-0001,
// CLI-0001, FOUR-0001…) aux employés, clients et fournisseurs déjà en
// base qui n'en ont pas encore, dans l'ordre de création (le plus ancien
// devient 0001). À exécuter une seule fois par base de données, après
// avoir poussé le nouveau schéma (`numero`/`numeroEmploye` sur Client,
// Fournisseur, User) — nécessaire pour le template ainsi que pour chaque
// base client existante lors de son prochain `git merge main`.
//
// Utilisation (dans le dossier garage-backend, avec la vraie base
// connectée — donc via le tunnel comme pour une migration) :
//
//   node prisma/backfill-numeros.js
// ============================================================

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function formater(prefixe, n) {
  return `${prefixe}-${String(1000 + n).slice(1)}`;
}

async function backfill(delegate, champ, prefixe, nomAffiche) {
  const dejaNumerotes = await delegate.findMany({
    where: { [champ]: { not: null } },
    select: { [champ]: true },
  });
  let max = 0;
  for (const r of dejaNumerotes) {
    const partieNum = parseInt(String(r[champ]).split("-")[1], 10);
    if (!isNaN(partieNum)) max = Math.max(max, partieNum);
  }

  const aNumeroter = await delegate.findMany({
    where: { [champ]: null },
    orderBy: { creeLe: "asc" },
  });

  if (aNumeroter.length === 0) {
    console.log(`${nomAffiche} : rien à faire (tout est déjà numéroté).`);
    return;
  }

  for (const ligne of aNumeroter) {
    max += 1;
    await delegate.update({ where: { id: ligne.id }, data: { [champ]: formater(prefixe, max) } });
  }
  console.log(`${nomAffiche} : ${aNumeroter.length} numéro(s) attribué(s) (jusqu'à ${formater(prefixe, max)}).`);
}

async function main() {
  await backfill(prisma.client, "numero", "CLI", "Clients");
  await backfill(prisma.fournisseur, "numero", "FOUR", "Fournisseurs");
  await backfill(prisma.user, "numeroEmploye", "EMP", "Employés");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
