import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, hashPassword, estGerantOuDev } from "@/lib/auth";

export async function POST(request) {
  const session = await obtenirSession();
  if (!session || !estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const {
    nom, courriel, motDePasse, role, pin,
    telephone, adresse, assignation, numeroEmploye, dateEmbauche,
    typeRemuneration, tauxHoraireEmploye, salaireAnnuel, frequencePaie, tauxVacances,
  } = await request.json();
  if (!nom || !courriel || !motDePasse || !["GERANT", "SECRETAIRE", "MECANICIEN"].includes(role)) {
    return NextResponse.json({ erreur: "Champs manquants ou invalides." }, { status: 400 });
  }
  if (motDePasse.length < 4 || motDePasse.length > 12) {
    return NextResponse.json({ erreur: "Le mot de passe doit avoir entre 4 et 12 caractères." }, { status: 400 });
  }

  const existant = await prisma.user.findUnique({ where: { courriel } });
  if (existant) {
    return NextResponse.json({ erreur: "Ce courriel est déjà utilisé." }, { status: 409 });
  }

  if (numeroEmploye) {
    const numeroExistant = await prisma.user.findFirst({ where: { numeroEmploye } });
    if (numeroExistant) {
      return NextResponse.json({ erreur: "Ce numéro d'employé est déjà utilisé." }, { status: 409 });
    }
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
      assignation: assignation || null,
      numeroEmploye: numeroEmploye || null,
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
