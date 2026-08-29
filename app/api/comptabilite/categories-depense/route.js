import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { assurerPlanComptable, assurerCategoriesDepense, creerCompteAvecProchainNumero } from "@/lib/comptabilite";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom, compteDepenseNumero, nomNouveauCompte } = await request.json();
  if (!nom || !nom.trim()) return NextResponse.json({ erreur: "Le nom est requis." }, { status: 400 });

  await assurerPlanComptable();
  await assurerCategoriesDepense();

  let numeroCompteFinal = compteDepenseNumero;

  if (nomNouveauCompte && nomNouveauCompte.trim()) {
    // Crée un nouveau compte au plan comptable, avec le prochain numéro
    // séquentiel disponible — pas besoin d'en choisir un existant
    numeroCompteFinal = await creerCompteAvecProchainNumero("DEPENSE", nomNouveauCompte.trim(), 5100);
  } else if (compteDepenseNumero) {
    const compte = await prisma.compte.findUnique({ where: { numero: compteDepenseNumero } });
    if (!compte) return NextResponse.json({ erreur: "Compte de dépense introuvable." }, { status: 400 });
  }

  const code = nom.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").slice(0, 30);
  const existante = await prisma.categorieDepense.findUnique({ where: { code } });
  if (existante) {
    if (existante.actif) {
      return NextResponse.json({ erreur: `"${existante.nom}" existe déjà dans la liste — vérifie en rafraîchissant la page.` }, { status: 409 });
    }
    const reactivee = await prisma.categorieDepense.update({
      where: { id: existante.id },
      data: { nom: nom.trim(), compteDepenseNumero: numeroCompteFinal || existante.compteDepenseNumero, actif: true },
    });
    return NextResponse.json(reactivee);
  }

  const categorie = await prisma.categorieDepense.create({
    data: { code, nom: nom.trim(), compteDepenseNumero: numeroCompteFinal || "5100" },
  });
  return NextResponse.json(categorie);
}
