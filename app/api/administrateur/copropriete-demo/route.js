import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { coproprieteActive } from "@/lib/copropriete";
import { chargerCoproDemo, retirerCoproDemo } from "@/lib/coproprieteDemo";

async function estVraimentSuperAdmin(session) {
  if (!session?.id) return false;
  if (session.role === "DEVELOPPEUR") return true;
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
  return utilisateur?.estSuperAdmin || false;
}

// Copropriété de démonstration (lib/coproprieteDemo.js) — POST : la charge
// dans une copropriété vide ; DELETE : retire l'immeuble de démonstration.
// Réservé à l'administrateur, comme le reste de sa page.
export async function POST() {
  if (!(await estVraimentSuperAdmin(await obtenirSession()))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  if (!(await coproprieteActive())) return NextResponse.json({ erreur: "Active d'abord le module Copropriété." }, { status: 409 });
  const resultat = await chargerCoproDemo();
  return NextResponse.json(resultat, { status: resultat.erreur ? 409 : 200 });
}

export async function DELETE() {
  if (!(await estVraimentSuperAdmin(await obtenirSession()))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const resultat = await retirerCoproDemo();
  return NextResponse.json(resultat, { status: resultat.erreur ? 409 : 200 });
}
