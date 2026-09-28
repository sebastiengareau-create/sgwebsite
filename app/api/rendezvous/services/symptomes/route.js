import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { DUREE_MIN, DUREE_MAX } from "@/lib/servicesWeb";
import { chargerSymptomes, enregistrerSymptomes, validerSymptomes } from "@/lib/symptomesWeb";

// Modifie l'option « Dites-nous les symptômes » du site de réservation :
// actif, nom, description, dureeMinutes, voyants (identifiants), symptomes.
export async function PATCH(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { data, erreur } = validerSymptomes(await request.json(), { DUREE_MIN, DUREE_MAX });
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });
  const reglages = { ...(await chargerSymptomes(prisma)), ...data };
  await enregistrerSymptomes(prisma, reglages);
  return NextResponse.json(reglages);
}
