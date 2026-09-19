import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { posterDepenseRecue, verifierPeriodeModifiable } from "@/lib/comptabilite";

// Ancre une date-seule ("YYYY-MM-DD") à midi UTC — sinon minuit UTC recule
// d'un jour une fois affiché en heure du Québec (voir même correctif sur
// les dates de paie, app/api/paie/lots/route.js).
function jourCivil(dateStr) {
  return new Date(`${dateStr.slice(0, 10)}T12:00:00Z`);
}

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
    await verifierPeriodeModifiable(jourCivil(dateFacture), { nouvellePiece: true });
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

  // Réceptions de stock : une ligne peut être liée à une pièce d'inventaire
  // avec une quantité reçue — le stock est ajusté tout de suite (pas besoin
  // d'attendre que la facture soit marquée payée), avec un coût moyen
  // pondéré recalculé à partir du montant de la ligne (avant taxes).
  const receptions = lignesValides
    .map((l, i) => ({ index: i, pieceId: l.pieceId, qteRecue: Number(l.qteRecue) || 0, montant: Number(l.montant) }))
    .filter((r) => r.pieceId && r.qteRecue > 0);

  const fournisseur = receptions.length > 0 ? await prisma.fournisseur.findUnique({ where: { id: fournisseurId } }) : null;

  const depense = await prisma.$transaction(async (tx) => {
    const creee = await tx.depense.create({
      data: {
        fournisseurId,
        description,
        montant: montantTotal,
        tpsPayee: tps,
        tvqPayee: tvq,
        dateFacture: jourCivil(dateFacture),
        dateEcheance: dateEcheance ? jourCivil(dateEcheance) : null,
        lignes: {
          create: lignesValides.map((l) => ({
            categorieDepenseId: l.categorieDepenseId,
            montant: Number(l.montant),
            description: l.description || null,
            pieceId: l.pieceId && Number(l.qteRecue) > 0 ? l.pieceId : null,
            qteRecue: l.pieceId && Number(l.qteRecue) > 0 ? Number(l.qteRecue) : null,
          })),
        },
      },
      include: { lignes: { include: { categorieDepense: true } } },
    });

    for (const reception of receptions) {
      const piece = await tx.piece.findUnique({ where: { id: reception.pieceId } });
      if (!piece) continue;
      const coutUnitaire = reception.montant / reception.qteRecue;
      const nouvelleQte = piece.qte + reception.qteRecue;
      const nouveauCoutant = nouvelleQte > 0
        ? (piece.qte * piece.coutant + reception.qteRecue * coutUnitaire) / nouvelleQte
        : piece.coutant;
      const ligneCorrespondante = creee.lignes.find((l) => l.pieceId === reception.pieceId && l.qteRecue === reception.qteRecue);
      await tx.piece.update({
        where: { id: reception.pieceId },
        data: {
          qte: nouvelleQte,
          coutant: nouveauCoutant,
          mouvements: {
            create: {
              type: "RECEPTION", qte: reception.qteRecue, solde: nouvelleQte,
              note: `Réception — ${fournisseur?.nom || "Facture"} (${description})`, ligneDepenseId: ligneCorrespondante?.id || null, creePar: session.nom,
            },
          },
        },
      });
    }

    return creee;
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
