import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { preparerFichier } from "@/lib/fichiersRendezVous";

const MAX_FICHIERS_PAR_RENDEZ_VOUS = 10;

// Reçoit un fichier joint par le client sur le site de réservation, après
// le webhook qui a créé le rendez-vous. Même clé secrète que le webhook.
//
//   POST /api/rendezvous/fichiers   (multipart/form-data)
//     reference : référence du rendez-vous (celle envoyée au webhook)
//     fichier   : le fichier (PDF, image ou document Word, 15 Mo max)
//   → { ok: true, id }
export async function POST(request) {
  const cleRecue = request.headers.get("x-webhook-secret");
  const cleAttendue = process.env.GARAGE_BOOKING_WEBHOOK_SECRET;
  if (!cleAttendue || cleRecue !== cleAttendue) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  const formulaire = await request.formData().catch(() => null);
  const reference = formulaire?.get("reference");
  const fichier = formulaire?.get("fichier");
  if (typeof reference !== "string" || !reference || !fichier || typeof fichier === "string") {
    return NextResponse.json({ erreur: "Référence ou fichier manquant." }, { status: 400 });
  }

  const rdv = await prisma.rendezVous.findUnique({
    where: { referenceExterne: reference },
    select: { id: true, piecesJointes: true, _count: { select: { fichiers: true } } },
  });
  if (!rdv) return NextResponse.json({ erreur: "Rendez-vous introuvable." }, { status: 404 });
  if (rdv._count.fichiers >= MAX_FICHIERS_PAR_RENDEZ_VOUS) {
    return NextResponse.json({ erreur: "Trop de fichiers pour ce rendez-vous." }, { status: 400 });
  }

  const prepare = await preparerFichier(fichier.name, Buffer.from(await fichier.arrayBuffer()));
  if (prepare.erreur) return NextResponse.json({ erreur: prepare.erreur }, { status: 400 });

  const [enregistre] = await prisma.$transaction([
    prisma.fichierRendezVous.create({
      data: { rendezVousId: rdv.id, nom: prepare.nom, typeMime: prepare.typeMime, taille: prepare.donnees.length, donnees: prepare.donnees },
      select: { id: true },
    }),
    prisma.rendezVous.update({
      where: { id: rdv.id },
      data: {
        pieceJointe: true,
        ...(rdv.piecesJointes.includes(fichier.name) ? {} : { piecesJointes: { push: fichier.name.slice(0, 200) } }),
      },
    }),
  ]);
  return NextResponse.json({ ok: true, id: enregistre.id });
}
