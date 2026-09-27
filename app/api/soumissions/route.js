import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prochainNumeroSoumission, creerAvecNumero } from "@/lib/numerotation";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { clientId, clientNom, clientTelephone, vehiculeInfo, taches } = await request.json();

  if (!clientNom || !taches || taches.length === 0) {
    return NextResponse.json({ erreur: "Nom du client et au moins une tâche requis." }, { status: 400 });
  }

  const soumission = await creerAvecNumero(prochainNumeroSoumission, (numero) => prisma.soumission.create({
    data: {
      numero,
      clientId: clientId || null,
      clientNom,
      clientTelephone: clientTelephone || null,
      vehiculeInfo: vehiculeInfo || null,
      statut: "EN_ATTENTE",
      taches: {
        create: taches.map((t) => ({
          description: t.description,
          tempsEstime: Number(t.tempsEstime) || 0,
          pieces: {
            create: (t.pieces || []).map((p) => ({
              nom: p.nom,
              prixEstime: Number(p.prixEstime) || 0,
              qte: Number(p.qte) || 1,
            })),
          },
        })),
      },
    },
  }));

  return NextResponse.json({ id: soumission.id, numero: soumission.numero });
}
