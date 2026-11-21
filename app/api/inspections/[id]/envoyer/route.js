import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { courrielConfigure, courrielValide, preparerCourriel, envoyerCourriels } from "@/lib/courrielDocuments";
import { assurerLienInspection, refusInspection } from "@/lib/inspections";
import { resume, peutRepondreInspection } from "@/lib/grillesInspection";
import { libelleVehicule } from "@/lib/vehicules";
import { nomClientBon } from "@/lib/nomClient";

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

// Envoie le rapport d'inspection au client par courriel : un résumé et le
// lien de la page où il voit les photos et approuve les travaux
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session, { comptoir: true });
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  if (!courrielConfigure()) {
    return NextResponse.json({ erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant)." }, { status: 500 });
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: params.id },
    include: {
      points: { select: { etat: true, recommandation: true, ordre: true } },
      bon: { select: { clientNomAffiche: true, client: { select: { nom: true, courriel: true } }, vehicule: true } },
    },
  });
  if (!inspection) return NextResponse.json({ erreur: "Inspection introuvable." }, { status: 404 });
  if (inspection.statut !== "TERMINEE") {
    return NextResponse.json({ erreur: "Termine l'inspection avant d'envoyer le rapport." }, { status: 409 });
  }

  const { courrielManuel } = await request.json().catch(() => ({}));
  const destinataire = (courrielManuel || inspection.bon.client.courriel || "").trim();
  if (!destinataire) {
    return NextResponse.json({ erreur: "Aucun courriel — le client n'en a pas au dossier, ou entre-en un manuellement." }, { status: 400 });
  }
  if (!courrielValide(destinataire)) return NextResponse.json({ erreur: "Adresse courriel invalide." }, { status: 400 });

  const entreprise = await obtenirInfosEntreprise();
  const lien = await assurerLienInspection(inspection.id);
  const r = resume(inspection.points);
  const vehicule = inspection.bon.vehicule ? libelleVehicule(inspection.bon.vehicule) : "";
  const constats = [
    r.URGENT && `• ${pluriel(r.URGENT, "point")} à faire maintenant`,
    r.SURVEILLER && `• ${pluriel(r.SURVEILLER, "point")} à surveiller`,
    r.OK && `• ${pluriel(r.OK, "point")} en bon état`,
  ].filter(Boolean);
  const invitation = peutRepondreInspection(inspection)
    ? "Consultez le rapport, avec les photos, et approuvez en ligne les travaux que vous souhaitez faire faire :"
    : "Consultez le rapport complet, avec les photos :";

  const texte = [
    `Bonjour ${nomClientBon(inspection.bon)},`,
    "",
    `Nous avons inspecté votre ${vehicule || "véhicule"}${r.total - r.NA > 0 ? ` (${pluriel(r.total - r.NA, "point")} vérifié${r.total - r.NA > 1 ? "s" : ""})` : ""}.`,
    ...constats,
    ...(inspection.noteGenerale ? ["", inspection.noteGenerale] : []),
    "",
    invitation,
    lien,
    "",
    `Pour toute question, répondez simplement à ce courriel${entreprise.telephone ? ` ou appelez-nous au ${entreprise.telephone}` : ""}.`,
    "",
    "Merci de votre confiance,",
    entreprise.nomEntreprise,
  ].join("\n");

  const { echecs } = await envoyerCourriels([preparerCourriel({
    a: destinataire,
    entreprise,
    sujet: `Rapport d'inspection${vehicule ? ` — ${vehicule}` : ""} — ${entreprise.nomEntreprise}`,
    texte,
  })]);
  if (echecs.length) return NextResponse.json({ erreur: "Échec de l'envoi : " + echecs[0].erreur }, { status: 500 });

  await prisma.inspection.update({ where: { id: inspection.id }, data: { envoyeeLe: new Date() } });
  return NextResponse.json({ ok: true, destinataire });
}
