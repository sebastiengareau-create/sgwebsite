import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import crypto from "crypto";

export async function POST() {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const nouvelleCle = crypto.randomBytes(20).toString("hex");
  await prisma.parametre.upsert({
    where: { cle: "calendrier_flux_cle" },
    update: { valeur: nouvelleCle },
    create: { cle: "calendrier_flux_cle", valeur: nouvelleCle },
  });

  return NextResponse.json({ cle: nouvelleCle });
}
