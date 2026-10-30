import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { annulerImport } from "@/lib/transactionsBancaires";

// Copie du fichier original, telle que reçue à l'import
export async function GET(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const importBancaire = await prisma.importBancaire.findUnique({ where: { id: params.id }, select: { nomFichier: true, contenu: true } });
  if (!importBancaire) return NextResponse.json({ erreur: "Import introuvable." }, { status: 404 });
  return new NextResponse(importBancaire.contenu, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(importBancaire.nomFichier)}`,
    },
  });
}

// Annule un import : retire ses transactions encore à examiner
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const retirees = await annulerImport(params.id, session.nom);
  return NextResponse.json({ retirees });
}
