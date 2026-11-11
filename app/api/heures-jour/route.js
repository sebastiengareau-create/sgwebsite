import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { productiviteActif } from "@/lib/productivite";

// Heures réellement travaillées par un employé une journée (Productivité par
// employés → « Coût du jour »). heures vide ou null : retire la correction,
// on revient aux heures prévues de l'horaire.
export async function PUT(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "jobs-temps-reel")) || !(await productiviteActif())) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { employeId, date, heures } = await request.json();
  if (!employeId || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    return NextResponse.json({ erreur: "Employé ou date invalide." }, { status: 400 });
  }

  if (heures === null || heures === undefined || heures === "") {
    await prisma.heuresJourEmploye.deleteMany({ where: { employeId, date } });
    return NextResponse.json({ ok: true, heures: null });
  }

  const valeur = Number(String(heures).replace(",", "."));
  if (!Number.isFinite(valeur) || valeur < 0 || valeur > 24) {
    return NextResponse.json({ erreur: "Entre un nombre d'heures entre 0 et 24." }, { status: 400 });
  }
  const employe = await prisma.user.findUnique({ where: { id: employeId }, select: { id: true } });
  if (!employe) return NextResponse.json({ erreur: "Employé introuvable." }, { status: 404 });

  await prisma.heuresJourEmploye.upsert({
    where: { employeId_date: { employeId, date } },
    update: { heures: valeur, modifiePar: session.nom || null },
    create: { employeId, date, heures: valeur, modifiePar: session.nom || null },
  });
  return NextResponse.json({ ok: true, heures: valeur });
}
