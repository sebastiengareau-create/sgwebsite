import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

// Fusionne un doublon (cette pièce) dans une autre fiche (cibleId) : la même
// pièce entrée deux fois, souvent sous les numéros de deux fournisseurs.
// Le stock s'additionne au coût moyen pondéré (la valeur totale ne change
// pas, donc le grand livre non plus), tout l'historique suit, et le doublon
// est supprimé.
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { cibleId } = await request.json();
  if (!cibleId || cibleId === params.id) return NextResponse.json({ erreur: "Choisis une autre pièce." }, { status: 400 });

  const [source, cible] = await Promise.all([
    prisma.piece.findUnique({ where: { id: params.id }, include: { fournisseurs: true } }),
    prisma.piece.findUnique({ where: { id: cibleId }, include: { fournisseurs: true } }),
  ]);
  if (!source || !cible) return NextResponse.json({ erreur: "Pièce introuvable." }, { status: 404 });

  const qte = cible.qte + source.qte;
  const coutant = qte > 0 ? (cible.qte * cible.coutant + source.qte * source.coutant) / qte : cible.coutant;

  await prisma.$transaction(async (tx) => {
    // Liens fournisseurs : ceux que la cible n'a pas sont déplacés ; pour un
    // fournisseur commun, la cible garde son lien, complété au besoin.
    for (const lien of source.fournisseurs) {
      const commun = cible.fournisseurs.find((l) => l.fournisseurId === lien.fournisseurId);
      if (!commun) {
        await tx.pieceFournisseur.update({ where: { id: lien.id }, data: { pieceId: cible.id } });
        continue;
      }
      const plusRecent = lien.dernierAchat && (!commun.dernierAchat || lien.dernierAchat > commun.dernierAchat);
      await tx.pieceFournisseur.delete({ where: { id: lien.id } });
      await tx.pieceFournisseur.update({
        where: { id: commun.id },
        data: {
          ...(!commun.numeroFournisseur && lien.numeroFournisseur && { numeroFournisseur: lien.numeroFournisseur }),
          ...((plusRecent || commun.coutant == null) && lien.coutant != null && { coutant: lien.coutant, dernierAchat: lien.dernierAchat }),
        },
      });
    }

    await tx.pieceUtilisee.updateMany({ where: { pieceId: source.id }, data: { pieceId: cible.id } });
    await tx.ligneDepense.updateMany({ where: { pieceId: source.id }, data: { pieceId: cible.id } });
    await tx.ligneCommandeFournisseur.updateMany({ where: { pieceId: source.id }, data: { pieceId: cible.id } });
    await tx.mouvementInventaire.updateMany({ where: { pieceId: source.id }, data: { pieceId: cible.id } });
    await tx.historiquePiece.updateMany({ where: { pieceId: source.id }, data: { pieceId: cible.id } });

    // Le code-barres du doublon est libéré avant d'être repris par la cible
    // (contrainte d'unicité).
    if (source.codeBarre) await tx.piece.update({ where: { id: source.id }, data: { codeBarre: null } });
    await tx.piece.delete({ where: { id: source.id } });

    await tx.piece.update({
      where: { id: cible.id },
      data: {
        qte,
        coutant,
        ...(!cible.codeBarre && source.codeBarre && { codeBarre: source.codeBarre }),
        // Le numéro du doublon et ses autres numéros continuent de mener à
        // la pièce fusionnée.
        autresNumeros: [...cible.autresNumeros, source.numero, ...source.autresNumeros]
          .filter((n, i, t) => n.toLowerCase() !== cible.numero.toLowerCase() && t.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i),
        ...(!cible.fournisseurId && source.fournisseurId && { fournisseurId: source.fournisseurId }),
        ...(!cible.emplacement && source.emplacement && { emplacement: source.emplacement }),
        historique: {
          create: { champ: "Fusion", ancienneValeur: `${source.numero} — ${source.nom}`, nouvelleValeur: `fusionnée ici (+${source.qte} en stock)`, modifiePar: session.nom },
        },
        ...(source.qte !== 0 && {
          mouvements: {
            create: { type: "AJUSTEMENT", qte: source.qte, solde: qte, note: `Fusion du doublon ${source.numero}`, creePar: session.nom },
          },
        }),
      },
    });
  });

  return NextResponse.json({ ok: true, id: cible.id });
}
