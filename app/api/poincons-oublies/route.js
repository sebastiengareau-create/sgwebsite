import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { dateHeureLocaleVersUTC } from "@/lib/temps";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";

// Corrige l'heure de fin d'un poinçon oublié signalé dans Productivité par
// employés (lib/productivite.js) — sur un bon (type "bon") ou une tâche
// interne (type "interne"). Ferme aussi un poinçon encore ouvert.
export async function PATCH(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "jobs-temps-reel"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { type, id, fin } = await request.json();
  if (!id || !fin || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fin)) {
    return NextResponse.json({ erreur: "Heure de fin invalide." }, { status: 400 });
  }
  const finUTC = dateHeureLocaleVersUTC(fin);
  if (finUTC > new Date()) {
    return NextResponse.json({ erreur: "L'heure de fin ne peut pas être dans le futur." }, { status: 400 });
  }

  let entree;
  if (type === "bon") {
    entree = await prisma.entreeTemps.findUnique({ where: { id }, include: { probleme: true } });
    if (!entree) return NextResponse.json({ erreur: "Poinçon introuvable." }, { status: 404 });
    if (await bonEstVerrouille(entree.probleme.bonId)) {
      return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
    }
  } else if (type === "interne") {
    entree = await prisma.entreeTempsInterne.findUnique({ where: { id } });
    if (!entree) return NextResponse.json({ erreur: "Poinçon introuvable." }, { status: 404 });
  } else {
    return NextResponse.json({ erreur: "Type de poinçon inconnu." }, { status: 400 });
  }

  if (finUTC <= entree.debut) {
    return NextResponse.json({ erreur: "L'heure de fin doit être après le début du poinçon." }, { status: 400 });
  }

  const modele = type === "bon" ? prisma.entreeTemps : prisma.entreeTempsInterne;
  await modele.update({ where: { id }, data: { fin: finUTC } });
  return NextResponse.json({ ok: true });
}
