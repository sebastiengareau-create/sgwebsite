import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { dateHeureQuebecVersUTC } from "@/lib/temps";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^\d{2}:\d{2}$/;

// Ajoute à la main un poinçon de tâche interne terminé (début et fin) pour un
// employé, depuis Productivité par employés — seulement sur une tâche
// interne, jamais sur un bon de travail. Gardé comme ajouté à la main (qui et
// quand) pour l'historique des tâches internes.
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "jobs-temps-reel"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { employeId, tacheInterneId, date, debut, fin } = await request.json().catch(() => ({}));
  if (!employeId || !tacheInterneId) {
    return NextResponse.json({ erreur: "Choisis la tâche interne." }, { status: 400 });
  }
  if (!DATE.test(date || "") || !HEURE.test(debut || "") || !HEURE.test(fin || "")) {
    return NextResponse.json({ erreur: "Entre l'heure de début et l'heure de fin." }, { status: 400 });
  }

  const [employe, tache] = await Promise.all([
    prisma.user.findUnique({ where: { id: employeId }, select: { id: true } }),
    prisma.tacheInterne.findUnique({ where: { id: tacheInterneId }, select: { id: true } }),
  ]);
  if (!employe) return NextResponse.json({ erreur: "Employé introuvable." }, { status: 404 });
  if (!tache) return NextResponse.json({ erreur: "Tâche interne introuvable." }, { status: 404 });

  const debutUTC = dateHeureQuebecVersUTC(date, debut);
  const finUTC = dateHeureQuebecVersUTC(date, fin);
  const maintenant = new Date();
  if (finUTC <= debutUTC) {
    return NextResponse.json({ erreur: "La fin doit être après le début." }, { status: 400 });
  }
  if (finUTC > maintenant) {
    return NextResponse.json({ erreur: "L'heure ne peut pas être dans le futur." }, { status: 400 });
  }

  // Pas de chevauchement avec un autre poinçon de l'employé (tâche interne ou
  // bon) : le temps serait compté deux fois. Un poinçon encore en cours
  // s'étend jusqu'à maintenant.
  const chevauche = (liste) => liste.some((e) => e.debut < finUTC && (e.fin || maintenant) > debutUTC);
  const [internes, bons] = await Promise.all([
    prisma.entreeTempsInterne.findMany({
      where: { employeId, debut: { lt: finUTC }, OR: [{ fin: null }, { fin: { gt: debutUTC } }] },
      select: { debut: true, fin: true },
    }),
    prisma.entreeTemps.findMany({
      where: { employeId, debut: { lt: finUTC }, OR: [{ fin: null }, { fin: { gt: debutUTC } }] },
      select: { debut: true, fin: true },
    }),
  ]);
  if (chevauche(internes) || chevauche(bons)) {
    return NextResponse.json({ erreur: "Ces heures chevauchent un autre poinçon de cet employé." }, { status: 409 });
  }

  const entree = await prisma.entreeTempsInterne.create({
    data: {
      employeId,
      tacheInterneId,
      debut: debutUTC,
      fin: finUTC,
      ajoutePar: session.nom || null,
      ajouteLe: maintenant,
    },
  });
  return NextResponse.json(entree);
}
