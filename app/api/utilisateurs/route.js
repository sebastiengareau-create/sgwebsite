import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, hashPassword, aAccesSection, estNiveauMaxOuDev, niveauRole, ROLES_VALIDES } from "@/lib/auth";
import { prochainNumeroEmploye } from "@/lib/numerotation";

export async function POST(request) {
  const session = await obtenirSession();
  if (!session || !(await aAccesSection(session, "employes"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const {
    nom, courriel, motDePasse, role, pin,
    telephone, adresse, ville, codePostal, assignation, dateEmbauche,
    typeRemuneration, tauxHoraireEmploye, salaireAnnuel, frequencePaie, tauxVacances,
  } = await request.json();
  if (!nom || !courriel || !motDePasse || !ROLES_VALIDES.includes(role)) {
    return NextResponse.json({ erreur: "Champs manquants ou invalides." }, { status: 400 });
  }
  // Créer un compte reste limité au niveau de sécurité de l'appelant — même
  // un GERANT ne peut pas créer un compte niveau 4 ; seul le niveau 4 (accès
  // total) ou le développeur le peuvent.
  if (!estNiveauMaxOuDev(session) && niveauRole(role) > niveauRole(session.role)) {
    return NextResponse.json({ erreur: "Tu ne peux pas créer un compte avec un niveau de sécurité plus élevé que le tien." }, { status: 403 });
  }
  if (motDePasse.length < 4 || motDePasse.length > 12) {
    return NextResponse.json({ erreur: "Le mot de passe doit avoir entre 4 et 12 caractères." }, { status: 400 });
  }

  const existant = await prisma.user.findUnique({ where: { courriel } });
  if (existant) {
    return NextResponse.json({ erreur: "Ce courriel est déjà utilisé." }, { status: 409 });
  }

  const utilisateur = await prisma.user.create({
    data: {
      nom,
      courriel,
      motDePasse: await hashPassword(motDePasse),
      role,
      pin: pin || null,
      telephone: telephone || null,
      adresse: adresse || null,
      ville: ville || null,
      codePostal: codePostal || null,
      assignation: assignation || null,
      numeroEmploye: await prochainNumeroEmploye(),
      dateEmbauche: dateEmbauche ? new Date(dateEmbauche) : null,
      typeRemuneration: ["HORAIRE", "SALAIRE"].includes(typeRemuneration) ? typeRemuneration : "HORAIRE",
      tauxHoraireEmploye: tauxHoraireEmploye ? Number(tauxHoraireEmploye) : null,
      salaireAnnuel: salaireAnnuel ? Number(salaireAnnuel) : null,
      frequencePaie: ["HEBDOMADAIRE", "BIHEBDOMADAIRE", "BIMENSUEL", "MENSUEL"].includes(frequencePaie) ? frequencePaie : "BIHEBDOMADAIRE",
      tauxVacances: tauxVacances !== undefined && tauxVacances !== "" ? Number(tauxVacances) : 4,
    },
  });

  return NextResponse.json({ id: utilisateur.id });
}
