import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";

// L'image d'une photo du véhicule à l'arrivée, ouverte sur demande depuis le bon
export async function GET(request, props) {
  const params = await props.params;
  if (!(await obtenirSession())) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const photo = await prisma.photoArrivee.findUnique({
    where: { bonId_position: { bonId: params.id, position: params.position } },
    select: { url: true },
  });
  const m = photo?.url.match(/^data:(image\/[a-z+]+);base64,(.*)$/s);
  if (!m) return NextResponse.json({ erreur: "Photo introuvable." }, { status: 404 });

  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=86400" },
  });
}
