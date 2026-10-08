import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { envoyerAvisEnvoi, peutGererJobsDeplacement } from "@/lib/envois";
import { STATUTS_ACTIFS } from "@/lib/statutsEnvoi";

// Envoie un bon à un ou plusieurs employés : un envoi chacun, et un avis
// (notification, SMS ou courriel — voir lib/envois.js). Un employé qui a
// déjà ce bon en cours n'est pas renvoyé en double (seulement ré-avisé).
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await peutGererJobsDeplacement(session))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { bonId, employeIds, message } = await request.json().catch(() => ({}));
  const ids = [...new Set(Array.isArray(employeIds) ? employeIds.filter((id) => typeof id === "string") : [])];
  if (!bonId) return NextResponse.json({ erreur: "Choisis un bon." }, { status: 400 });
  if (ids.length === 0) return NextResponse.json({ erreur: "Choisis au moins un employé." }, { status: 400 });
  const note = String(message || "").trim().slice(0, 300) || null;

  const bon = await prisma.bonTravail.findUnique({ where: { id: bonId }, select: { id: true, statut: true } });
  if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });
  if (bon.statut === "TERMINE") return NextResponse.json({ erreur: "Ce bon est déjà facturé." }, { status: 400 });

  const employes = await prisma.user.findMany({ where: { id: { in: ids }, actif: true }, select: { id: true, nom: true } });
  if (employes.length !== ids.length) return NextResponse.json({ erreur: "Employé introuvable ou désactivé." }, { status: 400 });

  const resultats = [];
  for (const employe of employes) {
    const existant = await prisma.envoiBon.findFirst({ where: { bonId, employeId: employe.id, statut: { in: STATUTS_ACTIFS } } });
    const envoi = existant
      ? await prisma.envoiBon.update({ where: { id: existant.id }, data: { message: note ?? existant.message } })
      : await prisma.envoiBon.create({ data: { bonId, employeId: employe.id, message: note, smsStatut: "NON_CONFIGURE", envoyePar: session.nom } });
    const apres = await envoyerAvisEnvoi(envoi.id);
    resultats.push({ employe: employe.nom, dejaEnvoye: !!existant, avisPar: apres.avisPar, smsStatut: apres.smsStatut, smsErreur: apres.smsErreur });
  }

  return NextResponse.json({ ok: true, resultats });
}
