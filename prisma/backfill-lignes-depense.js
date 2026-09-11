// Bascule ponctuelle : crée une LigneDepense par Depense existante à partir
// de son ancien categorieDepenseId (avant que ce champ soit retiré du
// modèle Depense). Idempotent — saute les dépenses qui ont déjà des lignes.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const depenses = await prisma.depense.findMany({ include: { lignes: true } });
  let creees = 0;
  for (const d of depenses) {
    if (d.lignes.length > 0) continue;
    if (!d.categorieDepenseId) {
      console.warn(`Dépense ${d.id} sans categorieDepenseId — ignorée.`);
      continue;
    }
    const montantAvantTaxes = d.montant - (d.tpsPayee || 0) - (d.tvqPayee || 0);
    await prisma.ligneDepense.create({
      data: { depenseId: d.id, categorieDepenseId: d.categorieDepenseId, montant: montantAvantTaxes },
    });
    creees++;
  }
  console.log(`${creees} ligne(s) de dépense créée(s) sur ${depenses.length} dépense(s).`);
}

main().finally(() => prisma.$disconnect());
