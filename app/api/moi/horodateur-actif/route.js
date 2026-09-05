import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";

// Utilisé par le minuteur d'inactivité (voir components/MinuteurInactivite)
// pour ne jamais déconnecter un employé dont le poinçon est encore actif,
// même s'il n'a touché à rien dans le logiciel depuis un moment.
export async function GET() {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ actif: false }, { status: 401 });

  const [entreeActive, entreeInterneActive] = await Promise.all([
    prisma.entreeTemps.findFirst({ where: { employeId: session.id, fin: null } }),
    prisma.entreeTempsInterne.findFirst({ where: { employeId: session.id, fin: null } }),
  ]);
  return NextResponse.json({ actif: !!(entreeActive || entreeInterneActive) });
}
