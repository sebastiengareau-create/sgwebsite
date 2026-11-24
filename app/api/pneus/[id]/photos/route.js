import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { refusPneus } from "@/lib/pneus";
import { PHOTOS_MAX_JEU } from "@/lib/pneusCalculs";

// Ajoute une photo à un jeu de pneus (état à l'entrée, dommages) : { dataUrl }
// (image déjà réduite dans le navigateur) → { id, ajouteeLe }
export async function POST(request, props) {
  const { id } = await props.params;
  const session = await obtenirSession();
  const refus = await refusPneus(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const { dataUrl } = await request.json().catch(() => ({}));
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl || "")) return NextResponse.json({ erreur: "Photo manquante." }, { status: 400 });
  if (dataUrl.length > 3_000_000) return NextResponse.json({ erreur: "Photo trop lourde." }, { status: 413 });

  const jeu = await prisma.jeuPneus.findUnique({ where: { id }, select: { id: true, _count: { select: { photos: true } } } });
  if (!jeu) return NextResponse.json({ erreur: "Jeu de pneus introuvable." }, { status: 404 });
  if (jeu._count.photos >= PHOTOS_MAX_JEU) return NextResponse.json({ erreur: `${PHOTOS_MAX_JEU} photos au plus par jeu : retire-en une d'abord.` }, { status: 409 });
  const photo = await prisma.photoPneus.create({ data: { jeuId: jeu.id, url: dataUrl, employeNom: session.nom || null }, select: { id: true, ajouteeLe: true, employeNom: true } });
  return NextResponse.json(photo);
}
