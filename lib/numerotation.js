// Numérotation séquentielle automatique (employés, clients, fournisseurs),
// même convention que les autres numéros du logiciel (bons, factures,
// soumissions...) : PREFIXE-0001. Le filtre startsWith ignore les valeurs
// historiques hors-format (ex. numéros d'employé entrés manuellement avant
// l'automatisation), pour ne jamais dérailler sur un numéro non numérique.
import { prisma } from "@/lib/prisma";

async function prochainNumero(delegate, champ, prefixe) {
  const dernier = await delegate.findFirst({
    where: { [champ]: { startsWith: `${prefixe}-` } },
    orderBy: { [champ]: "desc" },
  });
  let prochainNum = 1;
  if (dernier) {
    const partieNum = parseInt(dernier[champ].split("-")[1], 10);
    if (!isNaN(partieNum)) prochainNum = partieNum + 1;
  }
  return `${prefixe}-${String(1000 + prochainNum).slice(1)}`;
}

export function prochainNumeroClient() {
  return prochainNumero(prisma.client, "numero", "CLI");
}

export function prochainNumeroFournisseur() {
  return prochainNumero(prisma.fournisseur, "numero", "FOUR");
}

export function prochainNumeroEmploye() {
  return prochainNumero(prisma.user, "numeroEmploye", "EMP");
}
