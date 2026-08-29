import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { clientId, clientNom, clientTelephone, vehiculeInfo, taches } = await request.json();

  if (!clientNom || !taches || taches.length === 0) {
    return NextResponse.json({ erreur: "Nom du client et au moins une tâche requis." }, { status: 400 });
  }

  const derniere = await prisma.soumission.findFirst({ orderBy: { numero: "desc" } });
  let prochainNum = 1;
  if (derniere) {
    const partieNum = parseInt(derniere.numero.split("-")[1], 10);
    if (!isNaN(partieNum)) prochainNum = partieNum + 1;
  }
  const numero = `SOU-${String(1000 + prochainNum).slice(1)}`;

  const soumission = await prisma.soumission.create({
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
  });

  return NextResponse.json({ id: soumission.id, numero: soumission.numero });
}
