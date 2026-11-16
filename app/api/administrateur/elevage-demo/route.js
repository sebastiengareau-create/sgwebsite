import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { elevageActif } from "@/lib/elevage";
import { chargerTroupeauDemo, retirerTroupeauDemo } from "@/lib/elevageDemo";

async function estVraimentSuperAdmin(session) {
  if (!session?.id) return false;
  if (session.role === "DEVELOPPEUR") return true;
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
  return utilisateur?.estSuperAdmin || false;
}

// Troupeau de démonstration (lib/elevageDemo.js) — POST : le charge dans un
// troupeau vide ; DELETE : retire les bêtes de démonstration. Réservé à
// l'administrateur, comme le reste de sa page.
export async function POST() {
  if (!(await estVraimentSuperAdmin(await obtenirSession()))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  if (!(await elevageActif())) return NextResponse.json({ erreur: "Active d'abord le module Élevage." }, { status: 409 });
  const resultat = await chargerTroupeauDemo();
  if (resultat.erreur) return NextResponse.json(resultat, { status: 409 });
  return NextResponse.json(resultat);
}

export async function DELETE() {
  if (!(await estVraimentSuperAdmin(await obtenirSession()))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  return NextResponse.json(await retirerTroupeauDemo());
}
