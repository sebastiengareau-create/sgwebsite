import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reponseImage } from "@/lib/inspections";

// Photo d'un rapport d'inspection, pour la page publique du client : permise
// seulement avec le lien secret du rapport
export async function GET(request, props) {
  const { jeton, photoId } = await props.params;
  const photo = jeton
    ? await prisma.photoInspection.findFirst({
        where: { id: photoId, point: { inspection: { jetonClient: jeton } } },
        select: { url: true },
      })
    : null;
  if (!photo) return NextResponse.json({ erreur: "Photo introuvable." }, { status: 404 });
  return reponseImage(photo.url, request);
}
