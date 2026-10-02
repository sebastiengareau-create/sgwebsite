import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

// Transitions permises par l'interface (les réceptions passent par
// ./reception) : envoyer, revenir en brouillon, annuler, rouvrir, et clore
// une commande reçue en partie dont le reste ne viendra pas.
const TRANSITIONS = {
  BROUILLON: ["ENVOYEE", "ANNULEE"],
  ENVOYEE: ["BROUILLON", "ANNULEE"],
  RECUE_PARTIELLE: ["RECUE"],
  RECUE: [],
  ANNULEE: ["BROUILLON"],
};

export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const commande = await prisma.commandeFournisseur.findUnique({ where: { id: params.id }, include: { lignes: true } });
  if (!commande) return NextResponse.json({ erreur: "Commande introuvable." }, { status: 404 });
  const { note, lignes, statut, fournisseurId } = await request.json();
  const dejaRecue = commande.lignes.some((l) => l.qteRecue > 0);
  const modifiable = ["BROUILLON", "ENVOYEE"].includes(commande.statut) && !dejaRecue;

  if ((lignes !== undefined || fournisseurId !== undefined) && !modifiable) {
    return NextResponse.json({ erreur: "Cette commande a déjà été reçue (en tout ou en partie) — ses lignes ne se modifient plus." }, { status: 409 });
  }
  if (fournisseurId !== undefined && commande.statut !== "BROUILLON") {
    return NextResponse.json({ erreur: "Le fournisseur ne se change que sur un brouillon." }, { status: 409 });
  }
  if (statut !== undefined && statut !== commande.statut) {
    if (!(TRANSITIONS[commande.statut] || []).includes(statut)) {
      return NextResponse.json({ erreur: "Changement de statut impossible." }, { status: 409 });
    }
    if (statut === "ANNULEE" && dejaRecue) {
      return NextResponse.json({ erreur: "Une commande déjà reçue en partie ne s'annule pas — clos-la plutôt." }, { status: 409 });
    }
  }

  const nouveauFournisseur = fournisseurId !== undefined && fournisseurId !== commande.fournisseurId ? fournisseurId : null;
  const lignesCibles = lignes !== undefined
    ? lignes.filter((l) => l.pieceId && Math.floor(Number(l.qteCommandee)) > 0)
    : nouveauFournisseur ? commande.lignes : null;
  if (statut === "ENVOYEE" && (lignesCibles ?? commande.lignes).length === 0) {
    return NextResponse.json({ erreur: "Ajoute au moins une pièce avant d'envoyer la commande." }, { status: 400 });
  }

  // Changer de fournisseur reprend, pour chaque pièce, le numéro et le
  // dernier prix connus chez le nouveau fournisseur.
  const liens = nouveauFournisseur
    ? await prisma.pieceFournisseur.findMany({ where: { fournisseurId: nouveauFournisseur, pieceId: { in: lignesCibles.map((l) => l.pieceId) } } })
    : [];
  const lienParPiece = new Map(liens.map((l) => [l.pieceId, l]));

  const maj = await prisma.$transaction(async (tx) => {
    if (lignesCibles) {
      await tx.ligneCommandeFournisseur.deleteMany({ where: { commandeId: commande.id } });
      await tx.ligneCommandeFournisseur.createMany({
        data: lignesCibles.map((l) => {
          const lien = lienParPiece.get(l.pieceId);
          return {
            commandeId: commande.id,
            pieceId: l.pieceId,
            qteCommandee: Math.floor(Number(l.qteCommandee)),
            coutUnitaire: nouveauFournisseur && lien?.coutant != null ? lien.coutant : Number(l.coutUnitaire) || 0,
            numeroFournisseur: nouveauFournisseur ? (lien?.numeroFournisseur || null) : (l.numeroFournisseur?.trim() || null),
          };
        }),
      });
    }
    return tx.commandeFournisseur.update({
      where: { id: commande.id },
      data: {
        ...(note !== undefined && { note: note || null }),
        ...(nouveauFournisseur && { fournisseurId: nouveauFournisseur }),
        ...(statut !== undefined && statut !== commande.statut && {
          statut,
          ...(statut === "ENVOYEE" && { dateEnvoi: new Date() }),
          ...(statut === "BROUILLON" && { dateEnvoi: null }),
        }),
      },
    });
  });
  return NextResponse.json(maj);
}

export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const commande = await prisma.commandeFournisseur.findUnique({ where: { id: params.id }, include: { lignes: true, _count: { select: { depenses: true } } } });
  if (!commande) return NextResponse.json({ erreur: "Commande introuvable." }, { status: 404 });
  if (commande._count.depenses > 0 || commande.lignes.some((l) => l.qteRecue > 0)) {
    return NextResponse.json({ erreur: "Cette commande a déjà des réceptions — elle ne peut pas être supprimée." }, { status: 409 });
  }
  await prisma.commandeFournisseur.delete({ where: { id: commande.id } });
  return NextResponse.json({ ok: true });
}
