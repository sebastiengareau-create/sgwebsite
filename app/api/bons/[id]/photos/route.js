import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";

export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const { problemeId, dataUrl } = await request.json();
  if (!problemeId || !dataUrl) {
    return NextResponse.json({ erreur: "Données manquantes." }, { status: 400 });
  }

  // Note prototype → production : ici la photo (dataUrl base64) est stockée
  // directement en base pour la démo locale. En production, on l'enverrait
  // plutôt vers un stockage cloud (ex. S3) et on ne garderait que le lien.
  const photo = await prisma.photo.create({
    data: { url: dataUrl, problemeId, employeId: session.id },
  });
  return NextResponse.json({ id: photo.id, url: photo.url });
}
