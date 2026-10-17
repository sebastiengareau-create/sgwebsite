import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";
import { estPositionArrivee } from "@/lib/photosArrivee";
import { CLIENT } from "@/lib/client";

// Photo du véhicule à l'arrivée (voir lib/photosArrivee.js) : une par
// position, remplacée si elle existe déjà.
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });
  if (!CLIENT.photosArrivee) return NextResponse.json({ erreur: "Photos à l'arrivée non activées." }, { status: 403 });
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  const { position, dataUrl } = await request.json();
  if (!estPositionArrivee(position) || !/^data:image\/[a-z+]+;base64,/.test(dataUrl || "")) {
    return NextResponse.json({ erreur: "Données manquantes." }, { status: 400 });
  }
  if (!(await prisma.bonTravail.findUnique({ where: { id: params.id }, select: { id: true } }))) {
    return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });
  }

  // Comme Photo : l'image compressée est gardée en base (voir photos/route.js)
  const photo = await prisma.photoArrivee.upsert({
    where: { bonId_position: { bonId: params.id, position } },
    create: { bonId: params.id, position, url: dataUrl, employeId: session.id },
    update: { url: dataUrl, employeId: session.id, ajouteeLe: new Date() },
    select: { id: true, position: true, ajouteeLe: true },
  });
  return NextResponse.json(photo);
}
