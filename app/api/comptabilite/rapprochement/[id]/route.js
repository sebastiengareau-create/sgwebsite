import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

// Annule une conciliation enregistrée par erreur — seulement la plus récente
// du compte, puisque chaque conciliation sert de solde d'ouverture à la
// suivante. Ses lignes redeviennent modifiables (toujours cochées) : la
// relation est en ON DELETE SET NULL, ce qui retire leur rapprochementId.
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const rapprochement = await prisma.rapprochementBancaire.findUnique({ where: { id: params.id } });
  if (!rapprochement) return NextResponse.json({ erreur: "Conciliation introuvable." }, { status: 404 });

  const plusRecent = await prisma.rapprochementBancaire.findFirst({
    where: { compteTresorerieId: rapprochement.compteTresorerieId },
    orderBy: [{ dateRapprochement: "desc" }, { creeLe: "desc" }],
  });
  if (plusRecent?.id !== rapprochement.id) {
    return NextResponse.json({ erreur: "Seule la conciliation la plus récente du compte peut être annulée." }, { status: 400 });
  }

  await prisma.rapprochementBancaire.delete({ where: { id: rapprochement.id } });
  return NextResponse.json({ ok: true });
}
