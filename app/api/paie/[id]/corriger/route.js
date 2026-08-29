import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { renverserEcriture, verifierNonVerrouille } from "@/lib/comptabilite";

export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const paie = await prisma.paie.findUnique({ where: { id: params.id } });
  if (!paie) return NextResponse.json({ erreur: "Paie introuvable." }, { status: 404 });
  if (paie.statut === "CORRIGEE") return NextResponse.json({ erreur: "Cette paie a déjà été corrigée." }, { status: 400 });

  try {
    await verifierNonVerrouille(paie.dateVersement || paie.periodeFin);
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("VERROUILLE:", "") }, { status: 423 });
  }

  try {
    await renverserEcriture("PAIE", paie.id, `Correction — annule la paie ${paie.id.slice(-6)}`, session.nom);
  } catch (e) {
    console.error("Erreur renversement écriture de paie :", e);
  }

  await prisma.paie.update({ where: { id: paie.id }, data: { statut: "CORRIGEE" } });

  // Retourne les infos utiles pour pré-remplir le calculateur avec les mêmes employé/période
  return NextResponse.json({
    ok: true,
    employeId: paie.employeId,
    periodeDebut: paie.periodeDebut,
    periodeFin: paie.periodeFin,
  });
}
