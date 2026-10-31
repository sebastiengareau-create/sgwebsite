import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { COMPTES_REVENU_RESERVES } from "@/lib/comptabilite";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE, remettreBonEnAttenteSiSansTemps, remettreLigneEnStock } from "@/lib/bons";

export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const body = await request.json();
  const { description, categorieRevenu, factureDescription, facturePrixUnitaire, factureQte, notes } = body;

  // Les notes des travaux peuvent aussi être écrites par un mécanicien
  // (section Horodateur) — tout le reste demande l'accès Opérations.
  const seulementNotes = Object.keys(body).every((cle) => cle === "notes");
  const autorise = (await aAccesSection(session, "operations")) || (seulementNotes && (await aAccesSection(session, "horodateur")));
  if (!autorise) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  const data = {};
  if (notes !== undefined) data.notes = notes && notes.trim() ? notes.trim() : null;
  if (description !== undefined) {
    if (!description || !description.trim()) {
      return NextResponse.json({ erreur: "La description ne peut pas être vide." }, { status: 400 });
    }
    data.description = description.trim();
  }
  if (categorieRevenu !== undefined) {
    if (categorieRevenu !== "MAIN_OEUVRE") {
      if (COMPTES_REVENU_RESERVES.includes(categorieRevenu)) {
        return NextResponse.json({ erreur: "Poste de revenu invalide." }, { status: 400 });
      }
      const compte = await prisma.compte.findUnique({ where: { numero: categorieRevenu } });
      if (!compte || compte.type !== "REVENU" || !compte.actif) {
        return NextResponse.json({ erreur: "Poste de revenu invalide." }, { status: 400 });
      }
    }
    data.categorieRevenu = categorieRevenu;
  }
  if (factureDescription !== undefined) data.factureDescription = factureDescription || null;
  if (facturePrixUnitaire !== undefined) data.facturePrixUnitaire = Number(facturePrixUnitaire) || 0;
  if (factureQte !== undefined) {
    // 0 est une vraie quantité (rien à facturer) ; seul un nombre invalide vaut 1
    const n = Number(factureQte);
    data.factureQte = Number.isFinite(n) && n >= 0 ? n : 1;
  }

  const existe = await prisma.probleme.findFirst({ where: { id: params.problemeId, bonId: params.id }, select: { id: true } });
  if (!existe) return NextResponse.json({ erreur: "Tâche introuvable sur ce bon." }, { status: 404 });

  const probleme = await prisma.probleme.update({ where: { id: params.problemeId }, data });
  return NextResponse.json(probleme);
}

export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  const probleme = await prisma.probleme.findUnique({ where: { id: params.problemeId }, include: { pieces: true, bon: { include: { client: true } } } });
  if (!probleme || probleme.bonId !== params.id) {
    return NextResponse.json({ erreur: "Tâche introuvable." }, { status: 404 });
  }
  // Les pièces de la tâche n'ont pas été utilisées : elles reviennent en stock
  await prisma.$transaction(async (tx) => {
    for (const ligne of probleme.pieces) {
      await remettreLigneEnStock(tx, ligne, { note: `Tâche retirée — Bon #${probleme.bon.numero} — ${probleme.bon.client.nom}`, creePar: session.nom });
    }
    await tx.probleme.delete({ where: { id: probleme.id } });
  });
  await remettreBonEnAttenteSiSansTemps(params.id);
  return NextResponse.json({ ok: true });
}
