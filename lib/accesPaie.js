import { prisma } from "./prisma";
import { aAccesSection } from "./auth";

// Section Paie accessible et module Paie actif
export async function accesPaieActif(session) {
  if (!(await aAccesSection(session, "paie"))) return false;
  const module = await prisma.parametre.findUnique({ where: { cle: "module_paie" } });
  return module?.valeur === "actif";
}

// ?annee=AAAA valide, ou null
export function anneeDemandee(request) {
  const annee = Number(new URL(request.url).searchParams.get("annee"));
  return Number.isInteger(annee) && annee >= 2000 && annee <= 2100 ? annee : null;
}
