import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { supprimerPhoto } from "@/lib/etatsLieux";

// L'image d'une photo, chargée à part ; elle ne change jamais (cache du navigateur)
export async function GET(request, props) {
  if (!(await sessionImmo())) return refus();
  const { id, photoId } = await props.params;
  const photo = await prisma.photoEtatLieuxImmo.findFirst({ where: { id: photoId, etatId: id }, select: { url: true } });
  const m = /^data:(image\/[a-z+]+);base64,(.*)$/s.exec(photo?.url || "");
  if (!m) return erreur("Photo introuvable.", 404);
  return new NextResponse(Buffer.from(m[2], "base64"), { headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" } });
}

// Retire une photo prise par erreur, tant que l'état des lieux est en cours
export async function DELETE(request, props) {
  if (!(await sessionImmo())) return refus();
  const { id, photoId } = await props.params;
  const r = await supprimerPhoto(id, photoId);
  if (r.erreur) return erreur(r.erreur, r.status || 400);
  return NextResponse.json({ ok: true });
}
