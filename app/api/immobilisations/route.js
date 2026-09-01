import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { posterAcquisitionImmobilisation, verifierPeriodeModifiable } from "@/lib/comptabilite";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom, description, dateAcquisition, coutAcquisition, valeurResiduelle, dureeVieAns } = await request.json();
  if (!nom || !dateAcquisition || !coutAcquisition || !dureeVieAns) {
    return NextResponse.json({ erreur: "Nom, date, coût et durée de vie sont requis." }, { status: 400 });
  }
  if (Number(dureeVieAns) < 1) {
    return NextResponse.json({ erreur: "La durée de vie doit être d'au moins 1 an." }, { status: 400 });
  }

  try {
    await verifierPeriodeModifiable(new Date(dateAcquisition), { nouvellePiece: true });
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
  }

  const immobilisation = await prisma.immobilisation.create({
    data: {
      nom,
      description: description || null,
      dateAcquisition: new Date(dateAcquisition),
      coutAcquisition: Number(coutAcquisition),
      valeurResiduelle: Number(valeurResiduelle) || 0,
      dureeVieAns: Number(dureeVieAns),
    },
  });

  try {
    await posterAcquisitionImmobilisation(immobilisation, session.nom);
  } catch (e) {
    console.error("Erreur comptabilisation immobilisation :", e);
  }

  return NextResponse.json(immobilisation);
}
