import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { retirerPaiement } from "@/lib/paiementsFactures";
import { erreurPourReponse } from "@/lib/transactionsBancaires";

// Retire un paiement entré par erreur : son écriture est supprimée et la
// facture redevient impayée avec le solde correspondant
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const paiement = await prisma.paiementFacture.findUnique({ where: { id: params.paiementId } });
  if (!paiement || paiement.factureId !== params.id) return NextResponse.json({ erreur: "Paiement introuvable." }, { status: 404 });
  try {
    return NextResponse.json(await retirerPaiement(paiement.id));
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
