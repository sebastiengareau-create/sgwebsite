import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { envoyerAvisEnvoi, peutGererJobsDeplacement } from "@/lib/envois";
import { STATUTS_ACTIFS } from "@/lib/statutsEnvoi";

// Avise de nouveau l'employé d'un envoi encore actif (ex. après qu'il a
// activé les notifications)
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await peutGererJobsDeplacement(session))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const envoi = await prisma.envoiBon.findUnique({ where: { id: params.id }, select: { statut: true } });
  if (!envoi) return NextResponse.json({ erreur: "Envoi introuvable." }, { status: 404 });
  if (!STATUTS_ACTIFS.includes(envoi.statut)) return NextResponse.json({ erreur: "Cet envoi n'est plus actif." }, { status: 400 });

  const apres = await envoyerAvisEnvoi(params.id);
  return NextResponse.json({ ok: true, avisPar: apres.avisPar });
}
