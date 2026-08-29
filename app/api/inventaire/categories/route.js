import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { assurerPlanComptable, assurerCategoriesInventaire, creerCompteAvecProchainNumero } from "@/lib/comptabilite";

export async function POST(request) {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom, compteRevenuNumero, nomNouveauCompte } = await request.json();
  if (!nom || !nom.trim()) return NextResponse.json({ erreur: "Le nom est requis." }, { status: 400 });

  await assurerPlanComptable();
  await assurerCategoriesInventaire();

  let numeroCompteFinal = compteRevenuNumero;

  if (nomNouveauCompte && nomNouveauCompte.trim()) {
    // Crée un nouveau compte de revenu, avec le prochain numéro séquentiel
    // disponible — pas besoin d'en choisir un existant
    numeroCompteFinal = await creerCompteAvecProchainNumero("REVENU", nomNouveauCompte.trim(), 4010);
  } else if (compteRevenuNumero) {
    const compte = await prisma.compte.findUnique({ where: { numero: compteRevenuNumero } });
    if (!compte) return NextResponse.json({ erreur: "Compte de revenu introuvable." }, { status: 400 });
  }

  // Génère un code interne unique à partir du nom
  const code = nom.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").slice(0, 30);
  const existante = await prisma.categorieInventaire.findUnique({ where: { code } });
  if (existante) {
    if (existante.actif) {
      return NextResponse.json({ erreur: `"${existante.nom}" existe déjà dans la liste — vérifie en rafraîchissant la page.` }, { status: 409 });
    }
    // Était désactivée (probablement un essai précédent) — on la réactive
    // plutôt que de bloquer, pour ne jamais laisser un "fantôme" invisible
    const reactivee = await prisma.categorieInventaire.update({
      where: { id: existante.id },
      data: { nom: nom.trim(), compteRevenuNumero: numeroCompteFinal || existante.compteRevenuNumero, actif: true },
    });
    return NextResponse.json(reactivee);
  }

  const categorie = await prisma.categorieInventaire.create({
    data: { code, nom: nom.trim(), compteRevenuNumero: numeroCompteFinal || "4010" },
  });
  return NextResponse.json(categorie);
}
