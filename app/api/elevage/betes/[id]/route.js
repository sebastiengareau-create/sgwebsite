import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage, normaliserBete, normaliserSortie, verifierMere, verifierPere, verifierBoucle } from "@/lib/elevage";
import { refusPeriodeElevage, livresElevage } from "@/lib/elevageCompta";

// Élevage relié à la comptabilité (lib/elevageCompta.js) : dates de la bête
// qui vont aux livres — achat (comptes à payer) et vente sur pied
const dateAchat = (b) => (b.origine === "ACHETEE" && b.coutAcquisition > 0 ? b.dateAcquisition || b.creeLe || new Date() : null);
const dateVente = (b) => (b.statut === "VENDUE" && b.prixVente > 0 ? b.dateSortie : null);

// Modifie la fiche ; avec { sortie }, change le statut : vendue sur pied,
// morte, ou retour au troupeau (l'abattage a sa propre route)
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const bete = await prisma.bete.findUnique({ where: { id: params.id }, include: { abattage: { select: { id: true } } } });
  if (!bete) return NextResponse.json({ erreur: "Bête introuvable." }, { status: 404 });

  const body = await request.json();
  if (body.sortie) {
    if (bete.abattage) return NextResponse.json({ erreur: "Cette bête est abattue — annule l'abattage pour changer son statut." }, { status: 409 });
    const sortie = normaliserSortie(body.sortie);
    if (sortie.erreur) return NextResponse.json({ erreur: sortie.erreur }, { status: 400 });
    const refus = await refusPeriodeElevage({ anciennes: [dateVente(bete)], nouvelles: [dateVente(sortie.data)] });
    if (refus) return refus;
    await prisma.bete.update({ where: { id: bete.id }, data: sortie.data });
    return NextResponse.json({ ok: true, ...(await livresElevage(session)) });
  }

  const fiche = normaliserBete(body, { identifiantActuel: bete.identifiant });
  if (fiche.erreur) return NextResponse.json({ erreur: fiche.erreur }, { status: 400 });
  if (fiche.data.identifiant && fiche.data.identifiant !== bete.identifiant) {
    const boucle = await verifierBoucle(fiche.data.identifiant, bete.id);
    if (boucle.erreur) return NextResponse.json({ erreur: boucle.erreur }, { status: 400 });
  }
  if (fiche.data.mereId !== undefined) {
    const mere = await verifierMere(fiche.data.mereId, bete.id);
    if (mere.erreur) return NextResponse.json({ erreur: mere.erreur }, { status: 400 });
  }
  if (fiche.data.pereId !== undefined) {
    const pere = await verifierPere(fiche.data.pereId, bete.id);
    if (pere.erreur) return NextResponse.json({ erreur: pere.erreur }, { status: 400 });
  }
  const achatAvant = dateAchat(bete);
  const apres = { ...bete, ...fiche.data };
  const achatApres = dateAchat(apres);
  const achatChange = String(achatAvant) !== String(achatApres) || bete.coutAcquisition !== apres.coutAcquisition || bete.provenance !== apres.provenance;
  if (achatChange) {
    const refus = await refusPeriodeElevage({ anciennes: [achatAvant], nouvelles: [achatApres] });
    if (refus) return refus;
  }
  await prisma.bete.update({ where: { id: bete.id }, data: fiche.data });
  return NextResponse.json({ ok: true, ...(achatChange ? await livresElevage(session) : {}) });
}

// Retire une fiche entrée par erreur — pas une bête abattue (sa viande est
// reliée à elle) : annuler l'abattage d'abord
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const bete = await prisma.bete.findUnique({ where: { id: params.id }, include: { abattage: { select: { id: true } }, frais: { select: { date: true } } } });
  if (!bete) return NextResponse.json({ erreur: "Bête introuvable." }, { status: 404 });
  if (bete.abattage) return NextResponse.json({ erreur: "Cette bête est abattue — sa fiche reste pour la traçabilité de sa viande." }, { status: 409 });
  // Son achat, sa vente sur pied et ses frais quittent les livres avec elle
  const refus = await refusPeriodeElevage({ anciennes: [dateAchat(bete), dateVente(bete), ...bete.frais.map((f) => f.date)] });
  if (refus) return refus;
  await prisma.bete.delete({ where: { id: bete.id } });
  return NextResponse.json({ ok: true, ...(await livresElevage(session)) });
}
