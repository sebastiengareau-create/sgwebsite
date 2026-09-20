import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
export async function DELETE() {
  const session = await obtenirSession();
  // Réservé au développeur — pensé pour vider une période de test, jamais
  // un usage de gérant en production réelle.
  if (session?.role !== "DEVELOPPEUR") {
    return NextResponse.json({ erreur: "Seul le développeur peut tout réinitialiser." }, { status: 403 });
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
