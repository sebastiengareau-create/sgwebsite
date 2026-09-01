import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { calculerPaiePourEmploye } from "@/lib/paie";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { employeId, periodeDebut, periodeFin, heuresManuelles, typePaie, montantVacances } = await request.json();
  if (!employeId || !periodeDebut || !periodeFin) {
    return NextResponse.json({ erreur: "Employé et période requis." }, { status: 400 });
  }

  const resultat = await calculerPaiePourEmploye(employeId, { periodeDebut, periodeFin, typePaie, heuresManuelles, montantVacances });
  if (resultat.erreur) {
    return NextResponse.json({ erreur: resultat.erreur }, { status: resultat.erreur === "Employé introuvable." ? 404 : 400 });
  }

  return NextResponse.json(resultat);
}
