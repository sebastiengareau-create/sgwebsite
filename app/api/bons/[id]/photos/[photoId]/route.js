import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";

// L'image d'une photo de tâche, chargée à part pour ne pas alourdir la page
// du bon. Une photo n'est jamais modifiée : le navigateur la garde en cache.
export async function GET(request, props) {
  const params = await props.params;
  if (!(await obtenirSession())) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const photo = await prisma.photo.findFirst({
    where: { id: params.photoId, probleme: { bonId: params.id } },
    select: { url: true },
  });
  if (!photo) return NextResponse.json({ erreur: "Photo introuvable." }, { status: 404 });
  const m = photo.url.match(/^data:(image\/[a-z+]+);base64,(.*)$/s);
  if (!m) return NextResponse.redirect(new URL(photo.url, request.url));

  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

// Supprime définitivement une photo de tâche (prise par erreur) — mêmes
// droits que pour l'ajouter, tant que le bon n'est pas facturé.
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  // deleteMany : ne supprime que si la photo appartient bien à ce bon
  await prisma.photo.deleteMany({ where: { id: params.photoId, probleme: { bonId: params.id } } });
  return NextResponse.json({ ok: true });
}
