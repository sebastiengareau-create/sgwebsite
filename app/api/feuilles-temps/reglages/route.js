import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesFeuillesTemps, CLES_REGLAGES } from "@/lib/quarts";
import { ARRONDIS_OFFERTS } from "@/lib/quartsCalculs";

// Règles de calcul des feuilles de temps : arrondi, arrivée avant
// l'ouverture, dîner payé. Elles s'appliquent au calcul seulement : les
// heures pointées ne changent jamais. Une feuille déjà verrouillée est
// recalculée avec la règle du jour si on la rouvre à l'écran — ces règles
// se choisissent donc au départ, pas en cours de route.
export async function PUT(request) {
  const session = await obtenirSession();
  if (!(await accesFeuillesTemps(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const { arrondiMinutes, calerOuverture, dinerPaye } = await request.json();
  if (!ARRONDIS_OFFERTS.includes(Number(arrondiMinutes))) return NextResponse.json({ erreur: "Arrondi invalide." }, { status: 400 });
  const valeurs = {
    [CLES_REGLAGES.arrondiMinutes]: String(Number(arrondiMinutes)),
    [CLES_REGLAGES.calerOuverture]: calerOuverture ? "oui" : "non",
    [CLES_REGLAGES.dinerPaye]: dinerPaye ? "oui" : "non",
  };
  await prisma.$transaction(Object.entries(valeurs).map(([cle, valeur]) =>
    prisma.parametre.upsert({ where: { cle }, update: { valeur }, create: { cle, valeur } })));
  return NextResponse.json({ ok: true });
}
