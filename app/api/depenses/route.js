import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { posterDepenseRecue } from "@/lib/comptabilite";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { fournisseurId, categorieDepenseId, description, montant, tpsPayee, tvqPayee, dateFacture, dateEcheance } = await request.json();
  if (!fournisseurId || !categorieDepenseId || !description || !montant || !dateFacture) {
    return NextResponse.json({ erreur: "Champs manquants." }, { status: 400 });
  }

  const categorie = await prisma.categorieDepense.findUnique({ where: { id: categorieDepenseId } });
  if (!categorie) return NextResponse.json({ erreur: "Poste de dépense introuvable." }, { status: 404 });

  const depense = await prisma.depense.create({
    data: {
      fournisseurId,
      categorieDepenseId,
      description,
      montant: Number(montant),
      tpsPayee: Number(tpsPayee) || 0,
      tvqPayee: Number(tvqPayee) || 0,
      dateFacture: new Date(dateFacture),
      dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
    },
  });

  try {
    await posterDepenseRecue({ ...depense, compteDepenseNumero: categorie.compteDepenseNumero }, session.nom);
  } catch (e) {
    console.error("Erreur comptabilisation dépense :", e);
  }

  return NextResponse.json(depense);
}
