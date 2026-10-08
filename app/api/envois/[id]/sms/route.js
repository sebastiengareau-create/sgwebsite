import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { envoyerSmsEnvoi } from "@/lib/envois";
import { STATUTS_ACTIFS } from "@/lib/statutsEnvoi";

// Renvoie le SMS d'un envoi encore actif (ex. après avoir corrigé le
// cellulaire de l'employé dans sa fiche)
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const envoi = await prisma.envoiBon.findUnique({ where: { id: params.id }, select: { statut: true } });
  if (!envoi) return NextResponse.json({ erreur: "Envoi introuvable." }, { status: 404 });
  if (!STATUTS_ACTIFS.includes(envoi.statut)) return NextResponse.json({ erreur: "Cet envoi n'est plus actif." }, { status: 400 });

  const apres = await envoyerSmsEnvoi(params.id);
  return NextResponse.json({ ok: true, smsStatut: apres.smsStatut, smsErreur: apres.smsErreur });
}
