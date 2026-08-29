import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";

export async function POST(request) {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom } = await request.json();
  if (!nom || !nom.trim()) return NextResponse.json({ erreur: "Le nom est requis." }, { status: 400 });

  const tache = await prisma.tacheInterne.create({ data: { nom: nom.trim() } });
  return NextResponse.json(tache);
}
