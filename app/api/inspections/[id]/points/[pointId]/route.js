import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { inspectionModifiable, refusInspection } from "@/lib/inspections";
import { ETATS_POINT } from "@/lib/grillesInspection";

const texte = (v, max) => String(v ?? "").trim().slice(0, max) || null;

// Met à jour un point : { etat?, mesure?, constat?, recommandation?, prixEstime? }
// Inspection en cours : le technicien remplit tout ; le prix est réservé au
// comptoir (accès « Opérations »). Inspection terminée : seuls le travail
// recommandé et son prix changent encore (comptoir), jusqu'à la réponse du
// client.
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const { inspection, erreur, status } = await inspectionModifiable(params.id);
  if (erreur) return NextResponse.json({ erreur }, { status });
  if (inspection.reponseClient) {
    return NextResponse.json({ erreur: "Le client a déjà répondu à ce rapport : il ne se modifie plus." }, { status: 409 });
  }
  const point = await prisma.pointInspection.findFirst({ where: { id: params.pointId, inspectionId: inspection.id }, select: { id: true } });
  if (!point) return NextResponse.json({ erreur: "Point introuvable." }, { status: 404 });

  const corps = await request.json().catch(() => ({}));
  const comptoir = await aAccesSection(session, "operations");
  const enCours = inspection.statut === "EN_COURS";
  const data = {};

  if ("etat" in corps || "mesure" in corps || "constat" in corps) {
    if (!enCours) return NextResponse.json({ erreur: "L'inspection est terminée : rouvre-la pour changer ce point." }, { status: 409 });
    if ("etat" in corps) {
      if (corps.etat !== null && !ETATS_POINT[corps.etat]) return NextResponse.json({ erreur: "État invalide." }, { status: 400 });
      data.etat = corps.etat;
    }
    if ("mesure" in corps) data.mesure = texte(corps.mesure, 40);
    if ("constat" in corps) data.constat = texte(corps.constat, 1000);
  }
  if ("recommandation" in corps) {
    if (!enCours && !comptoir) return NextResponse.json({ erreur: "L'inspection est terminée : rouvre-la pour changer ce point." }, { status: 409 });
    data.recommandation = texte(corps.recommandation, 300);
  }
  if ("prixEstime" in corps) {
    if (!comptoir) return NextResponse.json({ erreur: "Le prix des travaux est entré par le comptoir." }, { status: 403 });
    const brut = corps.prixEstime;
    const prix = brut === "" || brut == null ? null : Number(String(brut).replace(/\s/g, "").replace(",", "."));
    if (prix !== null && (!Number.isFinite(prix) || prix < 0 || prix > 1000000)) {
      return NextResponse.json({ erreur: "Prix invalide." }, { status: 400 });
    }
    data.prixEstime = prix === null ? null : Math.round(prix * 100) / 100;
  }

  const maj = await prisma.pointInspection.update({
    where: { id: point.id },
    data,
    include: { photos: { select: { id: true } } },
  });
  return NextResponse.json(maj);
}

// Retire un point ajouté pendant l'inspection (les points de la grille
// restent : « S. O. » s'ils ne s'appliquent pas)
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const { inspection, erreur, status } = await inspectionModifiable(params.id);
  if (erreur) return NextResponse.json({ erreur }, { status });
  if (inspection.statut !== "EN_COURS") {
    return NextResponse.json({ erreur: "L'inspection est terminée : rouvre-la pour retirer un point." }, { status: 409 });
  }
  const { count } = await prisma.pointInspection.deleteMany({ where: { id: params.pointId, inspectionId: inspection.id, ajoute: true } });
  if (!count) return NextResponse.json({ erreur: "Seul un point ajouté pendant l'inspection se retire." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
