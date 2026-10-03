import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { normaliserVehicule } from "@/lib/vehicules";
import { CLIENT } from "@/lib/client";
import { normaliserFiche } from "@/lib/vehiculesAVendre";

async function acces(session) {
  return CLIENT.vehiculesAVendre && (await aAccesSection(session, "inventaire"));
}

// Modifie la fiche et/ou le véhicule. Une fois vendu, seule la description
// reste modifiable (le reste est figé par la facture de vente).
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await acces(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const vv = await prisma.vehiculeVente.findUnique({ where: { id: params.id }, include: { factureVente: true } });
  if (!vv) return NextResponse.json({ erreur: "Véhicule introuvable." }, { status: 404 });

  const body = await request.json();
  const fiche = normaliserFiche(body);
  if (fiche.erreur) return NextResponse.json({ erreur: fiche.erreur }, { status: 400 });
  if (vv.factureVente && (body.vehicule || fiche.data.coutantAchat !== undefined)) {
    return NextResponse.json({ erreur: "Ce véhicule est vendu — annule la facture de vente pour modifier son coûtant ou sa description technique." }, { status: 409 });
  }

  let vehicule = null;
  if (body.vehicule) {
    vehicule = normaliserVehicule(body.vehicule);
    if (vehicule.erreur) return NextResponse.json({ erreur: vehicule.erreur }, { status: 400 });
    if (!vehicule.data.marque || !vehicule.data.modele) {
      return NextResponse.json({ erreur: "Indique au moins la marque et le modèle du véhicule." }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (vehicule) await tx.vehicule.update({ where: { id: vv.vehiculeId }, data: vehicule.data });
    if (Object.keys(fiche.data).length > 0) await tx.vehiculeVente.update({ where: { id: vv.id }, data: fiche.data });
  });
  return NextResponse.json({ ok: true });
}

// Retire une fiche entrée par erreur — seulement sans bon ni vente : le
// dossier véhicule interne disparaît avec elle.
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await acces(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const vv = await prisma.vehiculeVente.findUnique({ where: { id: params.id }, include: { factureVente: true, _count: { select: { bons: true } } } });
  if (!vv) return NextResponse.json({ erreur: "Véhicule introuvable." }, { status: 404 });
  if (vv.factureVente) return NextResponse.json({ erreur: "Ce véhicule est vendu — sa fiche reste pour l'historique." }, { status: 409 });
  if (vv._count.bons > 0) {
    return NextResponse.json({ erreur: `Ce véhicule a ${vv._count.bons} bon${vv._count.bons > 1 ? "s" : ""} de travail — supprime-${vv._count.bons > 1 ? "les" : "le"} d'abord, ou garde la fiche pour l'historique.` }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.vehiculeVente.delete({ where: { id: vv.id } });
    // Le dossier véhicule n'a aucun bon (vérifié ci-dessus) : il part aussi
    await tx.vehicule.delete({ where: { id: vv.vehiculeId } });
  });
  return NextResponse.json({ ok: true });
}
