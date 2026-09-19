import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { assurerComptesTresorerie, obtenirComptesTresorerieAvecSoldes } from "@/lib/tresorerie";
import { creerCompteAvecProchainNumero } from "@/lib/comptabilite";

const CATEGORIES_VALIDES = ["CAISSE", "BANQUE", "CARTE_CREDIT"];

export async function GET() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  await assurerComptesTresorerie();
  const comptes = await obtenirComptesTresorerieAvecSoldes({ actifSeulement: false });
  return NextResponse.json(comptes);
}

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom, categorie, compteNumero } = await request.json();
  if (!nom?.trim()) return NextResponse.json({ erreur: "Nom requis." }, { status: 400 });
  if (!CATEGORIES_VALIDES.includes(categorie)) {
    return NextResponse.json({ erreur: "Catégorie invalide." }, { status: 400 });
  }

  let compte;
  if (compteNumero) {
    compte = await prisma.compte.findUnique({ where: { numero: compteNumero } });
    if (!compte) return NextResponse.json({ erreur: "Compte introuvable." }, { status: 400 });
    const dejaRelie = await prisma.compteTresorerie.findUnique({ where: { compteId: compte.id } });
    if (dejaRelie) {
      return NextResponse.json({ erreur: "Ce compte est déjà relié à un autre compte de trésorerie." }, { status: 400 });
    }
  } else {
    const typeGl = categorie === "CARTE_CREDIT" ? "PASSIF" : "ACTIF";
    const depart = categorie === "CARTE_CREDIT" ? 2100 : 1000;
    const numero = await creerCompteAvecProchainNumero(typeGl, nom, depart);
    compte = await prisma.compte.findUnique({ where: { numero } });
  }

  const dernier = await prisma.compteTresorerie.findFirst({ orderBy: { ordre: "desc" } });
  const ordre = (dernier?.ordre || 0) + 1;

  const compteTresorerie = await prisma.compteTresorerie.create({
    data: { nom: nom.trim(), categorie, compteId: compte.id, ordre },
  });
  return NextResponse.json(compteTresorerie);
}
