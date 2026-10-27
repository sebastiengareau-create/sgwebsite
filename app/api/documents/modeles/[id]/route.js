import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { peutGererDestinataire, validerModele } from "@/lib/documentsServeur";

// Modifier un modèle — il faut l'accès à son destinataire actuel comme au nouveau
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const existant = await prisma.modeleDocument.findUnique({ where: { id: params.id } });
  if (!existant) return NextResponse.json({ erreur: "Modèle introuvable." }, { status: 404 });

  const { donnees, erreur } = validerModele(await request.json().catch(() => ({})));
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });
  if (!(await peutGererDestinataire(session, existant.destinataire)) || !(await peutGererDestinataire(session, donnees.destinataire))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const modele = await prisma.modeleDocument.update({ where: { id: params.id }, data: donnees });
  return NextResponse.json({ modele });
}

export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const existant = await prisma.modeleDocument.findUnique({ where: { id: params.id } });
  if (!existant) return NextResponse.json({ erreur: "Modèle introuvable." }, { status: 404 });
  if (!(await peutGererDestinataire(session, existant.destinataire))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  await prisma.modeleDocument.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
