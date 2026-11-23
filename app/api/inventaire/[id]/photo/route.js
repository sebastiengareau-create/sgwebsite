import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { CLIENT } from "@/lib/client";

// Photo de référence d'une pièce d'inventaire (voir lib/photoPiece.js) :
// une au plus par pièce, gardée en base comme les photos des tâches.

// L'image, ouverte depuis la fiche de la pièce
export async function GET(request, props) {
  const params = await props.params;
  if (!(await aAccesSection(await obtenirSession(), "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const photo = await prisma.photoPiece.findUnique({ where: { pieceId: params.id }, select: { url: true } });
  const m = photo?.url.match(/^data:(image\/[a-z+]+);base64,(.*)$/s);
  if (!m) return NextResponse.json({ erreur: "Photo introuvable." }, { status: 404 });

  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=86400" },
  });
}

// Prend la photo, ou remplace celle qui existe
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (!CLIENT.photoPiece) return NextResponse.json({ erreur: "Photo des pièces non activée." }, { status: 403 });

  const { dataUrl } = await request.json().catch(() => ({}));
  if (!/^data:image\/[a-z+]+;base64,/.test(dataUrl || "")) {
    return NextResponse.json({ erreur: "Photo manquante." }, { status: 400 });
  }
  const piece = await prisma.piece.findUnique({ where: { id: params.id }, select: { id: true, photo: { select: { id: true } } } });
  if (!piece) return NextResponse.json({ erreur: "Pièce introuvable." }, { status: 404 });

  const [photo] = await prisma.$transaction([
    prisma.photoPiece.upsert({
      where: { pieceId: piece.id },
      create: { pieceId: piece.id, url: dataUrl, employeId: session.id },
      update: { url: dataUrl, employeId: session.id, ajouteeLe: new Date() },
      select: { ajouteeLe: true },
    }),
    prisma.historiquePiece.create({
      data: { pieceId: piece.id, champ: "Photo", ancienneValeur: piece.photo ? "Ancienne photo" : null, nouvelleValeur: piece.photo ? "Nouvelle photo" : "Ajoutée", modifiePar: session.nom },
    }),
  ]);
  return NextResponse.json(photo);
}

// Retire la photo
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { count } = await prisma.photoPiece.deleteMany({ where: { pieceId: params.id } });
  if (count > 0) {
    await prisma.historiquePiece.create({
      data: { pieceId: params.id, champ: "Photo", ancienneValeur: "Photo", nouvelleValeur: "Retirée", modifiePar: session.nom },
    });
  }
  return NextResponse.json({ ok: true });
}
