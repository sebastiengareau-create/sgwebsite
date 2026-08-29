import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, hashPassword, estGerantOuDev } from "@/lib/auth";

export async function POST(request) {
  const session = await obtenirSession();
  if (!session || !estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom, courriel, motDePasse, role, pin } = await request.json();
  if (!nom || !courriel || !motDePasse || !["GERANT", "SECRETAIRE", "MECANICIEN"].includes(role)) {
    return NextResponse.json({ erreur: "Champs manquants ou invalides." }, { status: 400 });
  }
  if (motDePasse.length < 6) {
    return NextResponse.json({ erreur: "Le mot de passe doit avoir au moins 6 caractères." }, { status: 400 });
  }

  const existant = await prisma.user.findUnique({ where: { courriel } });
  if (existant) {
    return NextResponse.json({ erreur: "Ce courriel est déjà utilisé." }, { status: 409 });
  }

  const utilisateur = await prisma.user.create({
    data: {
      nom,
      courriel,
      motDePasse: await hashPassword(motDePasse),
      role,
      pin: pin || null,
    },
  });

  return NextResponse.json({ id: utilisateur.id });
}
