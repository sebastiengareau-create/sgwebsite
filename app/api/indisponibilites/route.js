import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { dateHeureQuebecVersUTC, limitesJourQuebec } from "@/lib/temps";

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FORMAT_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Ajoute une période où l'atelier ne prend pas de rendez-vous. Une journée
// entière couvre du début de dateDebut à la fin de dateFin (heure du Québec).
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { dateDebut, heureDebut, dateFin, heureFin, journeeEntiere, motif } = await request.json();
  const dateFinEffective = dateFin || dateDebut;
  if (!FORMAT_DATE.test(dateDebut || "") || !FORMAT_DATE.test(dateFinEffective)) {
    return NextResponse.json({ erreur: "Dates invalides." }, { status: 400 });
  }

  let debut, fin;
  if (journeeEntiere) {
    debut = limitesJourQuebec(dateDebut).debut;
    fin = limitesJourQuebec(dateFinEffective).fin;
  } else {
    if (!FORMAT_HEURE.test(heureDebut || "") || !FORMAT_HEURE.test(heureFin || "")) {
      return NextResponse.json({ erreur: "Heures invalides." }, { status: 400 });
    }
    debut = dateHeureQuebecVersUTC(dateDebut, heureDebut);
    fin = dateHeureQuebecVersUTC(dateFinEffective, heureFin);
  }
  if (fin <= debut) return NextResponse.json({ erreur: "La fin doit être après le début." }, { status: 400 });

  const periode = await prisma.periodeIndisponible.create({
    data: { debut, fin, motif: motif?.trim() || null },
  });
  return NextResponse.json(periode);
}
