import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { CLIENT } from "@/lib/client";
import { chargerAtelierDemo, retirerAtelierDemo } from "@/lib/atelierDemo";

async function estVraimentSuperAdmin(session) {
  if (!session?.id) return false;
  if (session.role === "DEVELOPPEUR") return true;
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
  return utilisateur?.estSuperAdmin || false;
}

// Atelier de démonstration (lib/atelierDemo.js) — POST : le charge dans un
// atelier sans bon de travail ; DELETE : retire les dossiers de
// démonstration. Réservé à l'administrateur, comme le reste de sa page, et
// aux installations dont le profil l'offre (atelierDemo, lib/client.js).
export async function POST() {
  if (!CLIENT.atelierDemo) return NextResponse.json({ erreur: "Non offert sur cette installation." }, { status: 404 });
  if (!(await estVraimentSuperAdmin(await obtenirSession()))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const resultat = await chargerAtelierDemo();
  return NextResponse.json(resultat, { status: resultat.erreur ? 409 : 200 });
}

export async function DELETE() {
  if (!CLIENT.atelierDemo) return NextResponse.json({ erreur: "Non offert sur cette installation." }, { status: 404 });
  if (!(await estVraimentSuperAdmin(await obtenirSession()))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const resultat = await retirerAtelierDemo();
  return NextResponse.json(resultat, { status: resultat.erreur ? 409 : 200 });
}
