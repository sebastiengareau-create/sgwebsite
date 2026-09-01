import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
export async function DELETE() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const periodeProtegee = await prisma.periodeComptable.findFirst({ where: { statut: { not: "OUVERTE" } } });
  if (periodeProtegee) {
    return NextResponse.json(
      { erreur: "Au moins une période est verrouillée ou fermée — impossible de tout réinitialiser tant qu'elle n'est pas rouverte." },
      { status: 423 }
    );
  }

  // Supprime toutes les écritures (les lignes suivent en cascade) — les
  // comptes du plan comptable restent en place, seulement leur historique
  // est vidé. Pensé pour la période de test.
  const { count } = await prisma.ecritureComptable.deleteMany();
  return NextResponse.json({ ok: true, count });
}
