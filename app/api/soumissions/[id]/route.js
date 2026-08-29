import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function PUT(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { clientId, clientNom, clientTelephone, vehiculeInfo, taches } = await request.json();
  if (!clientNom || !taches || taches.length === 0) {
    return NextResponse.json({ erreur: "Nom du client et au moins une tâche requis." }, { status: 400 });
  }

  // Remplace complètement les tâches et pièces (plus simple et sûr qu'un
  // diff partiel) — les anciennes sont supprimées en cascade avec la tâche.
  await prisma.tacheSoumission.deleteMany({ where: { soumissionId: params.id } });

  const soumission = await prisma.soumission.update({
    where: { id: params.id },
    data: {
      clientId: clientId || null,
      clientNom,
      clientTelephone: clientTelephone || null,
      vehiculeInfo: vehiculeInfo || null,
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

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { statut } = await request.json();
  if (!["EN_ATTENTE", "ACCEPTEE"].includes(statut)) {
    return NextResponse.json({ erreur: "Statut invalide." }, { status: 400 });
  }

  await prisma.soumission.update({ where: { id: params.id }, data: { statut } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  await prisma.soumission.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
