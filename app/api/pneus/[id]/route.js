import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { refusPneus, pourPrisma } from "@/lib/pneus";
import { normaliserJeu } from "@/lib/pneusCalculs";

// Corrige la fiche d'un jeu (marque, dimension, détail pneu par pneu,
// équipement…). L'emplacement et l'état changent par un geste (…/geste), qui
// laisse une trace.
export async function PATCH(request, props) {
  const { id } = await props.params;
  const session = await obtenirSession();
  const refus = await refusPneus(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const jeu = await prisma.jeuPneus.findUnique({ where: { id }, select: { id: true, clientId: true } });
  if (!jeu) return NextResponse.json({ erreur: "Jeu de pneus introuvable." }, { status: 404 });

  const corps = await request.json().catch(() => ({}));
  const { emplacement, statut, ...champs } = corps;
  const { data, erreur } = normaliserJeu(champs, { partiel: true });
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });
  if ("vehiculeId" in corps) {
    if (corps.vehiculeId) {
      const v = await prisma.vehicule.findFirst({ where: { id: corps.vehiculeId, clientId: jeu.clientId }, select: { id: true } });
      if (!v) return NextResponse.json({ erreur: "Ce véhicule n'est pas au dossier de ce client." }, { status: 400 });
    }
    data.vehiculeId = corps.vehiculeId || null;
  }
  const maj = await prisma.jeuPneus.update({ where: { id }, data: pourPrisma(data) });
  return NextResponse.json(maj);
}

// Supprime un jeu inscrit par erreur, avec son historique
export async function DELETE(request, props) {
  const { id } = await props.params;
  const session = await obtenirSession();
  const refus = await refusPneus(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const { count } = await prisma.jeuPneus.deleteMany({ where: { id } });
  if (!count) return NextResponse.json({ erreur: "Jeu de pneus introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
