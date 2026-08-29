import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";

export async function GET() {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const parametres = await prisma.parametre.findMany();
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  return NextResponse.json(dict);
}

export async function PATCH(request) {
  const session = await obtenirSession();
  if (!session || !estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json();
  for (const [cle, valeur] of Object.entries(body)) {
    await prisma.parametre.upsert({
      where: { cle },
      update: { valeur: String(valeur) },
      create: { cle, valeur: String(valeur) },
    });
  }
  return NextResponse.json({ ok: true });
}
