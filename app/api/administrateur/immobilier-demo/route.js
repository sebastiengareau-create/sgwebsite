import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { immobilierActif } from "@/lib/immobilier";
import { chargerImmoDemo, retirerImmoDemo } from "@/lib/immobilierDemo";

async function estVraimentSuperAdmin(session) {
  if (!session?.id) return false;
  if (session.role === "DEVELOPPEUR") return true;
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
  return utilisateur?.estSuperAdmin || false;
}

// Immobilier de démonstration (lib/immobilierDemo.js) — POST : le charge
// dans un parc vide ; DELETE : retire les immeubles de démonstration.
// Réservé à l'administrateur, comme le reste de sa page.
export async function POST() {
  if (!(await estVraimentSuperAdmin(await obtenirSession()))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  if (!(await immobilierActif())) return NextResponse.json({ erreur: "Active d'abord le module Immobilier." }, { status: 409 });
  const resultat = await chargerImmoDemo();
  return NextResponse.json(resultat, { status: resultat.erreur ? 409 : 200 });
}

export async function DELETE() {
  if (!(await estVraimentSuperAdmin(await obtenirSession()))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const resultat = await retirerImmoDemo();
  return NextResponse.json(resultat, { status: resultat.erreur ? 409 : 200 });
}
