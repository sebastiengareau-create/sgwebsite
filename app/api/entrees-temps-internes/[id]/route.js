import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { dateHeureLocaleVersUTC } from "@/lib/temps";

const FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

// Ajuste le début et la fin d'un poinçon de tâche interne (Productivité par
// employés). Les heures d'origine sont gardées au premier ajustement, avec
// qui et quand, pour l'historique des tâches internes. fin vide : le poinçon
// reste en cours.
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "jobs-temps-reel"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const entree = await prisma.entreeTempsInterne.findUnique({ where: { id: params.id } });
  if (!entree) return NextResponse.json({ erreur: "Poinçon introuvable." }, { status: 404 });

  const { debut, fin } = await request.json();
  if (!FORMAT.test(debut || "") || (fin && !FORMAT.test(fin))) {
    return NextResponse.json({ erreur: "Heure invalide." }, { status: 400 });
  }
  if (!fin && entree.fin) {
    return NextResponse.json({ erreur: "Entre l'heure de fin." }, { status: 400 });
  }
  const debutUTC = dateHeureLocaleVersUTC(debut);
  const finUTC = fin ? dateHeureLocaleVersUTC(fin) : null;
  const maintenant = new Date();
  if (debutUTC > maintenant || (finUTC && finUTC > maintenant)) {
    return NextResponse.json({ erreur: "L'heure ne peut pas être dans le futur." }, { status: 400 });
  }
  if (finUTC && finUTC <= debutUTC) {
    return NextResponse.json({ erreur: "La fin doit être après le début." }, { status: 400 });
  }

  const dejaAjuste = !!entree.modifieLe;
  const misAJour = await prisma.entreeTempsInterne.update({
    where: { id: entree.id },
    data: {
      debut: debutUTC,
      fin: finUTC,
      ...(dejaAjuste ? {} : { debutOriginal: entree.debut, finOriginal: entree.fin }),
      modifiePar: session.nom || null,
      modifieLe: maintenant,
    },
  });
  return NextResponse.json(misAJour);
}
