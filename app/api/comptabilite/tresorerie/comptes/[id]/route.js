import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

const CATEGORIES_VALIDES = ["CAISSE", "BANQUE", "CARTE_CREDIT"];

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom, categorie, soldeReleve, actif } = await request.json();
  const data = {};
  if (nom !== undefined) {
    if (!nom.trim()) return NextResponse.json({ erreur: "Nom requis." }, { status: 400 });
    data.nom = nom.trim();
  }
  if (categorie !== undefined) {
    if (!CATEGORIES_VALIDES.includes(categorie)) return NextResponse.json({ erreur: "Catégorie invalide." }, { status: 400 });
    data.categorie = categorie;
  }
  if (soldeReleve !== undefined) {
    data.soldeReleve = Number(soldeReleve);
    data.soldeReleveLe = new Date();
  }
  if (actif !== undefined) data.actif = actif;

  const compteTresorerie = await prisma.compteTresorerie.update({ where: { id: params.id }, data });
  return NextResponse.json(compteTresorerie);
}
