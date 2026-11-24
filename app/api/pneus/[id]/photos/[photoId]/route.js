import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { refusPneus } from "@/lib/pneus";

// Une photo d'un jeu de pneus : l'image (GET), ou la retirer (DELETE)
export async function GET(request, props) {
  const { id, photoId } = await props.params;
  const refus = await refusPneus(await obtenirSession());
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const photo = await prisma.photoPneus.findFirst({ where: { id: photoId, jeuId: id }, select: { url: true } });
  const m = photo?.url.match(/^data:(image\/[a-z+]+);base64,(.*)$/s);
  if (!m) return NextResponse.json({ erreur: "Photo introuvable." }, { status: 404 });
  return new NextResponse(Buffer.from(m[2], "base64"), { headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=86400" } });
}

export async function DELETE(request, props) {
  const { id, photoId } = await props.params;
  const refus = await refusPneus(await obtenirSession());
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const { count } = await prisma.photoPneus.deleteMany({ where: { id: photoId, jeuId: id } });
  if (!count) return NextResponse.json({ erreur: "Photo introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
