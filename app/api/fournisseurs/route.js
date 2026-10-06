import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prochainNumeroFournisseur } from "@/lib/numerotation";
import { normaliserProvince, normaliserCodePostal } from "@/lib/adresse";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { nom, telephone, courriel, adresse, ville, province, codePostal } = await request.json();
  if (!nom || !nom.trim()) return NextResponse.json({ erreur: "Le nom est requis." }, { status: 400 });

  const fournisseur = await prisma.fournisseur.create({
    data: {
      numero: await prochainNumeroFournisseur(),
      nom: nom.trim(),
      telephone: telephone || null,
      courriel: courriel || null,
      adresse: adresse || null,
      ville: ville || null,
      province: normaliserProvince(province),
      codePostal: normaliserCodePostal(codePostal),
    },
  });
  return NextResponse.json(fournisseur);
}
