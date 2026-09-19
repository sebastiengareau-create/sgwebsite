import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json();
  const data = {};
  if (body.nom !== undefined) data.nom = body.nom;
  if (body.numero !== undefined) data.numero = body.numero;
  if (body.qte !== undefined) data.qte = Number(body.qte);
  if (body.qteMin !== undefined) data.qteMin = Number(body.qteMin);
  if (body.qteMax !== undefined) data.qteMax = body.qteMax === "" || body.qteMax === null ? null : Number(body.qteMax);
  if (body.emplacement !== undefined) data.emplacement = body.emplacement || null;
  if (body.fournisseurId !== undefined) data.fournisseurId = body.fournisseurId || null;
  if (body.prix !== undefined) data.prix = Number(body.prix);
  if (body.coutant !== undefined) data.coutant = Number(body.coutant);
  if (body.categorie !== undefined) data.categorie = body.categorie;

  // Champs suivis dans l'onglet Historique de la fiche (valeur avant/après) —
  // la quantité n'en fait pas partie, elle a son propre journal (Mouvements).
  const CHAMPS_SUIVIS = {
    nom: "Nom", numero: "Numéro", prix: "Prix de vente", coutant: "Coût moyen",
    qteMin: "Seuil minimum", qteMax: "Seuil maximum", emplacement: "Emplacement",
    fournisseurId: "Fournisseur habituel", categorie: "Catégorie",
  };

  try {
    const avant = await prisma.piece.findUnique({ where: { id: params.id } });
    if (!avant) return NextResponse.json({ erreur: "Pièce introuvable." }, { status: 404 });

    // Le fournisseur est une clé étrangère — on affiche son nom dans
    // l'historique plutôt que son id, qui ne dirait rien à personne.
    let nomsFournisseurs = {};
    if (data.fournisseurId !== undefined && data.fournisseurId !== avant.fournisseurId) {
      const ids = [avant.fournisseurId, data.fournisseurId].filter(Boolean);
      if (ids.length > 0) {
        const trouves = await prisma.fournisseur.findMany({ where: { id: { in: ids } } });
        nomsFournisseurs = Object.fromEntries(trouves.map((f) => [f.id, f.nom]));
      }
    }

    const evenementsHistorique = Object.entries(CHAMPS_SUIVIS)
      .filter(([champ]) => data[champ] !== undefined && data[champ] !== avant[champ])
      .map(([champ, label]) => ({
        champ: label,
        ancienneValeur: champ === "fournisseurId"
          ? (avant[champ] != null ? nomsFournisseurs[avant[champ]] || avant[champ] : null)
          : (avant[champ] != null ? String(avant[champ]) : null),
        nouvelleValeur: champ === "fournisseurId"
          ? (data[champ] != null ? nomsFournisseurs[data[champ]] || data[champ] : null)
          : (data[champ] != null ? String(data[champ]) : null),
        modifiePar: session.nom,
      }));

    const differenceQte = data.qte !== undefined ? data.qte - avant.qte : 0;

    const piece = await prisma.$transaction(async (tx) => {
      const misAJour = await tx.piece.update({
        where: { id: params.id },
        data: {
          ...data,
          ...(evenementsHistorique.length > 0 && { historique: { create: evenementsHistorique } }),
          ...(differenceQte !== 0 && {
            mouvements: {
              create: { type: "AJUSTEMENT", qte: differenceQte, solde: data.qte, note: "Ajustement manuel du stock", creePar: session.nom },
            },
          }),
        },
      });
      return misAJour;
    });
    return NextResponse.json(piece);
  } catch (e) {
    if (e.code === "P2002") {
      return NextResponse.json({ erreur: "Ce numéro de pièce existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ erreur: "Erreur lors de la mise à jour." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const utilisee = await prisma.pieceUtilisee.count({ where: { pieceId: params.id } });
  if (utilisee > 0) {
    return NextResponse.json(
      { erreur: "Cette pièce a déjà été utilisée sur un ou des bons de travail — elle ne peut pas être supprimée (l'historique de facturation serait perdu). Tu peux mettre son stock à 0 à la place." },
      { status: 409 }
    );
  }

  await prisma.piece.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
