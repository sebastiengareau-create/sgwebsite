import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";

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
