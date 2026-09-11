import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { posterDepenseRecue, verifierPeriodeModifiable } from "@/lib/comptabilite";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { fournisseurId, description, lignes, tpsPayee, tvqPayee, dateFacture, dateEcheance } = await request.json();
  const lignesValides = (lignes || []).filter((l) => l.categorieDepenseId && Number(l.montant) > 0);
  if (!fournisseurId || !description || lignesValides.length === 0 || !dateFacture) {
    return NextResponse.json({ erreur: "Champs manquants." }, { status: 400 });
  }

  try {
    await verifierPeriodeModifiable(new Date(dateFacture), { nouvellePiece: true });
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
  }

  const categories = await prisma.categorieDepense.findMany({
    where: { id: { in: lignesValides.map((l) => l.categorieDepenseId) } },
  });
  const categorieParId = Object.fromEntries(categories.map((c) => [c.id, c]));
  if (lignesValides.some((l) => !categorieParId[l.categorieDepenseId])) {
    return NextResponse.json({ erreur: "Poste de dépense introuvable." }, { status: 404 });
  }

  const tps = Number(tpsPayee) || 0;
  const tvq = Number(tvqPayee) || 0;
  const montantTotal = lignesValides.reduce((s, l) => s + Number(l.montant), 0) + tps + tvq;

  const depense = await prisma.depense.create({
    data: {
      fournisseurId,
      description,
      montant: montantTotal,
      tpsPayee: tps,
      tvqPayee: tvq,
      dateFacture: new Date(dateFacture),
      dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
      lignes: {
        create: lignesValides.map((l) => ({
          categorieDepenseId: l.categorieDepenseId,
          montant: Number(l.montant),
          description: l.description || null,
        })),
      },
    },
    include: { lignes: { include: { categorieDepense: true } } },
  });

  try {
    await posterDepenseRecue(
      {
        ...depense,
        lignesPourEcriture: depense.lignes.map((l) => ({
          compteDepenseNumero: l.categorieDepense.compteDepenseNumero,
          montant: l.montant,
          description: l.description,
        })),
      },
      session.nom
    );
  } catch (e) {
    console.error("Erreur comptabilisation dépense :", e);
  }

  return NextResponse.json(depense);
}
