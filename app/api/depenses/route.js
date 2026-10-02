import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { verifierPeriodeModifiable } from "@/lib/comptabilite";
import { jourCivil, creerDepenseDansTransaction, comptabiliserDepenseRecue } from "@/lib/depenses";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { fournisseurId, description, lignes, tpsPayee, tvqPayee, dateFacture, dateEcheance } = await request.json();
  const lignesValides = (lignes || []).filter((l) => l.categorieDepenseId && Number(l.montant) > 0);
  if (!fournisseurId || !description || lignesValides.length === 0 || !dateFacture) {
    return NextResponse.json({ erreur: "Champs manquants." }, { status: 400 });
  }

  try {
    await verifierPeriodeModifiable(jourCivil(dateFacture), { nouvellePiece: true });
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
  }

  const categories = await prisma.categorieDepense.findMany({
    where: { id: { in: lignesValides.map((l) => l.categorieDepenseId) } },
  });
  const categorieParId = Object.fromEntries(categories.map((c) => [c.id, c]));
  if (lignesValides.some((l) => !categorieParId[l.categorieDepenseId])) {
    return NextResponse.json({ erreur: "Poste de dépense introuvable." }, { status: 404 });
  }

  const depense = await prisma.$transaction((tx) =>
    creerDepenseDansTransaction(tx, { fournisseurId, description, lignes: lignesValides, tpsPayee, tvqPayee, dateFacture, dateEcheance }, session.nom)
  );
  await comptabiliserDepenseRecue(depense, session.nom);

  return NextResponse.json(depense);
}
