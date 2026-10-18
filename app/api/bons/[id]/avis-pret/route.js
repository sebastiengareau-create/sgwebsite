import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { envoyerAvisVehiculePret } from "@/lib/avisClient";

// Avise le client par courriel que son véhicule est prêt — au choix, depuis
// un bon facturé. Peut être renvoyé ; le dernier avis est noté sur le bon.
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { courriel } = await request.json().catch(() => ({}));
  const bon = await prisma.bonTravail.findUnique({ where: { id: params.id }, include: { client: true, vehicule: true, facture: true } });
  if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });
  if (!bon.facture) return NextResponse.json({ erreur: "Ce bon n'est pas encore facturé." }, { status: 400 });

  const destinataire = String(courriel || "").trim() || bon.client.courriel;
  if (!destinataire) {
    return NextResponse.json({ erreur: "Aucun courriel — le client n'en a pas au dossier, ou entre-en un manuellement." }, { status: 400 });
  }
  try {
    await envoyerAvisVehiculePret(bon, destinataire);
  } catch (e) {
    return NextResponse.json({ erreur: "Échec de l'envoi : " + e.message }, { status: 500 });
  }
  await prisma.bonTravail.update({ where: { id: bon.id }, data: { avisPretLe: new Date(), avisPretA: destinataire } });
  return NextResponse.json({ ok: true, destinataire });
}
