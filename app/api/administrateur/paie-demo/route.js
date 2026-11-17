import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { lireParametre } from "@/lib/parametres";
import { chargerPaieDemo, retirerPaieDemo } from "@/lib/paieDemo";

async function estVraimentSuperAdmin(session) {
  if (!session?.id) return false;
  if (session.role === "DEVELOPPEUR") return true;
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
  return utilisateur?.estSuperAdmin || false;
}

// Paie de démonstration (lib/paieDemo.js) — POST : la charge
// s'il n'y a encore aucun lot de paie ; DELETE : retire les employés de démonstration.
// Réservé à l'administrateur, comme le reste de sa page.
export async function POST() {
  if (!(await estVraimentSuperAdmin(await obtenirSession()))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  if ((await lireParametre("module_paie")) !== "actif") return NextResponse.json({ erreur: "Active d'abord le module Paie." }, { status: 409 });
  const resultat = await chargerPaieDemo();
  return NextResponse.json(resultat, { status: resultat.erreur ? 409 : 200 });
}

export async function DELETE() {
  if (!(await estVraimentSuperAdmin(await obtenirSession()))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const resultat = await retirerPaieDemo();
  return NextResponse.json(resultat, { status: resultat.erreur ? 409 : 200 });
}
