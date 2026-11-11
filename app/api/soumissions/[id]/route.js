import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { lireVehiculeSoumission, adresseClientSoumission, tachesSoumissionPourPrisma } from "@/lib/soumissions";
import { REPONSE_VIDE } from "@/lib/approbationSoumission";

export async function PUT(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { clientId, clientNom, clientTelephone, vehiculeId, vehicule, taches, ...corps } = await request.json();
  if (!clientNom || !taches || taches.length === 0) {
    return NextResponse.json({ erreur: "Nom du client et au moins une tâche requis." }, { status: 400 });
  }

  const vehiculeSoumission = await lireVehiculeSoumission({ clientId, vehiculeId, vehicule });
  if (vehiculeSoumission.erreur) return NextResponse.json({ erreur: vehiculeSoumission.erreur }, { status: 400 });
  const tachesPrisma = await tachesSoumissionPourPrisma(taches);

  // Remplace complètement les tâches et pièces (plus simple et sûr qu'un
  // diff partiel) — les anciennes sont supprimées en cascade avec la tâche.
  await prisma.tacheSoumission.deleteMany({ where: { soumissionId: params.id } });

  const soumission = await prisma.soumission.update({
    where: { id: params.id },
    data: {
      clientId: clientId || null,
      clientNom,
      clientTelephone: clientTelephone || null,
      ...adresseClientSoumission(clientId, corps),
      ...vehiculeSoumission.data,
      // Pièces de l'inventaire : liées seulement — le stock n'est touché
      // qu'au transfert en bon ou en facture
      taches: { create: tachesPrisma },
      // Le client avait répondu à une autre version : sa réponse ne vaut plus
      ...REPONSE_VIDE,
    },
  });

  return NextResponse.json({ id: soumission.id, numero: soumission.numero });
}

export async function PATCH(request, props) {
  const params = await props.params;
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

export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const depots = await prisma.depotClient.count({ where: { soumissionId: params.id } });
  if (depots > 0) {
    return NextResponse.json({ erreur: "Cette soumission a un dépôt — retire d'abord le dépôt (ou rembourse-le) avant de la supprimer." }, { status: 409 });
  }
  await prisma.soumission.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
