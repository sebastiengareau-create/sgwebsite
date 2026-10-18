import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { envoyerAvisVehiculePret } from "@/lib/avisClient";

// Le véhicule est prêt : le bon passe « Prêt » (sauf s'il est déjà facturé)
// et, si demandé, le client reçoit un courriel. Rappeler la route sur un bon
// déjà prêt renvoie l'avis. Le statut change même si l'envoi échoue — l'erreur
// est retournée pour être affichée (avisErreur).
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { aviser, courriel } = await request.json().catch(() => ({}));
  const bon = await prisma.bonTravail.findUnique({ where: { id: params.id }, include: { client: true, vehicule: true } });
  if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });

  if (bon.statut !== "TERMINE" && bon.statut !== "PRET") {
    await prisma.bonTravail.update({ where: { id: bon.id }, data: { statut: "PRET" } });
  }
  if (!aviser) return NextResponse.json({ ok: true, avise: null });

  const destinataire = String(courriel || "").trim() || bon.client.courriel;
  if (!destinataire) {
    return NextResponse.json({ ok: true, avise: null, avisErreur: "Le client n'a pas de courriel au dossier — entre-en un pour l'aviser." });
  }
  try {
    await envoyerAvisVehiculePret(bon, destinataire);
  } catch (e) {
    return NextResponse.json({ ok: true, avise: null, avisErreur: "Échec de l'envoi : " + e.message });
  }
  await prisma.bonTravail.update({ where: { id: bon.id }, data: { avisPretLe: new Date(), avisPretA: destinataire } });
  return NextResponse.json({ ok: true, avise: destinataire });
}
