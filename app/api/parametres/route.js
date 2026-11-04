import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { oublierProchainRappelPoincons } from "@/lib/rappelPoincons";

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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ erreur: "Données invalides." }, { status: 400 });
  try {
    // Tout ou rien, en une seule transaction
    await prisma.$transaction(Object.entries(body).map(([cle, valeur]) => prisma.parametre.upsert({
      where: { cle },
      update: { valeur: String(valeur ?? "") },
      create: { cle, valeur: String(valeur ?? "") },
    })));
  } catch (e) {
    console.error("PATCH /api/parametres", e);
    return NextResponse.json({ erreur: `base de données — ${e.message?.split("\n").filter(Boolean).pop() || "erreur inconnue"}` }, { status: 500 });
  }
  // Les heures d'ouverture ont pu changer : l'heure du rappel des poinçons
  // oubliés se recalcule
  oublierProchainRappelPoincons();
  return NextResponse.json({ ok: true });
}
