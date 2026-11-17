import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { lireParametre } from "@/lib/parametres";
import { chargerQuartsDemo, retirerQuartsDemo } from "@/lib/quartsDemo";

async function estVraimentSuperAdmin(session) {
  if (!session?.id) return false;
  if (session.role === "DEVELOPPEUR") return true;
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
  return utilisateur?.estSuperAdmin || false;
}

// Pointage de démonstration (lib/quartsDemo.js) — POST : le charge
// s'il n'y a encore aucune période de feuille de temps ; DELETE : retire les employés de démonstration.
// Réservé à l'administrateur, comme le reste de sa page.
export async function POST() {
  if (!(await estVraimentSuperAdmin(await obtenirSession()))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  if ((await lireParametre("module_quarts")) !== "actif") return NextResponse.json({ erreur: "Active d'abord le module Pointage de quart et feuilles de temps." }, { status: 409 });
  const resultat = await chargerQuartsDemo();
  return NextResponse.json(resultat, { status: resultat.erreur ? 409 : 200 });
}

export async function DELETE() {
  if (!(await estVraimentSuperAdmin(await obtenirSession()))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const resultat = await retirerQuartsDemo();
  return NextResponse.json(resultat, { status: resultat.erreur ? 409 : 200 });
}
