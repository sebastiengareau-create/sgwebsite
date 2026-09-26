import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { verifierPeriodeModifiable } from "@/lib/comptabilite";

const MODES_PAIEMENT = ["CHEQUE", "VIREMENT"];

// Mode de paiement (chèque ou virement) et son numéro — simple information
// de suivi, sans effet comptable, donc modifiable même sur une paie versée
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const corps = await request.json().catch(() => ({}));
  const modePaiement = corps.modePaiement || null;
  if (modePaiement && !MODES_PAIEMENT.includes(modePaiement)) {
    return NextResponse.json({ erreur: "Mode de paiement invalide." }, { status: 400 });
  }
  const referencePaiement = String(corps.referencePaiement ?? "").trim().slice(0, 100) || null;

  const paie = await prisma.paie.findUnique({ where: { id: params.id } });
  if (!paie) return NextResponse.json({ erreur: "Paie introuvable." }, { status: 404 });

  await prisma.paie.update({ where: { id: params.id }, data: { modePaiement, referencePaiement } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const paie = await prisma.paie.findUnique({ where: { id: params.id } });
  if (!paie) return NextResponse.json({ erreur: "Paie introuvable." }, { status: 404 });

  try {
    await verifierPeriodeModifiable(paie.dateVersement || paie.periodeFin, { nouvellePiece: false });
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
  }

  // Retire aussi l'écriture comptable liée (si la comptabilité était active
  // au moment de la paie), pour garder les livres cohérents
  await prisma.ecritureComptable.deleteMany({ where: { source: "PAIE", sourceId: params.id } });
  await prisma.paie.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
