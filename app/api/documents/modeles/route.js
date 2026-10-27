import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { peutGererDestinataire, validerModele } from "@/lib/documentsServeur";

// Nouveau modèle de lettre (section Documents) — { nom, destinataire, contenu }
export async function POST(request) {
  const session = await obtenirSession();
  const { donnees, erreur } = validerModele(await request.json().catch(() => ({})));
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });
  if (!(await peutGererDestinataire(session, donnees.destinataire))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const modele = await prisma.modeleDocument.create({ data: donnees });
  return NextResponse.json({ modele });
}
