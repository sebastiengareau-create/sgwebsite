import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prochainNumero, creerAvecNumero } from "@/lib/numerotation";
import { validerComposantsKit, coutantKit } from "@/lib/kits";

// Nouveau kit (lib/kits.js) : une fiche d'inventaire sans stock, avec ses
// composants. Sans numéro, il en reçoit un (KIT-001).
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom, numero, prix, categorie, composants } = await request.json().catch(() => ({}));
  if (!String(nom || "").trim()) return NextResponse.json({ erreur: "Donne un nom au kit." }, { status: 400 });
  const prixVente = Number(prix);
  if (!Number.isFinite(prixVente) || prixVente < 0) return NextResponse.json({ erreur: "Prix de vente invalide." }, { status: 400 });

  const pieces = await prisma.piece.findMany({ where: { id: { in: (composants || []).map((c) => c.pieceId).filter(Boolean) } } });
  const { lignes, erreur } = validerComposantsKit(composants, pieces);
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });

  const numeroSaisi = String(numero || "").trim();
  if (numeroSaisi && (await prisma.piece.findUnique({ where: { numero: numeroSaisi } }))) {
    return NextResponse.json({ erreur: "Ce numéro existe déjà dans l'inventaire." }, { status: 409 });
  }
  const coutant = coutantKit(lignes.map((l) => ({ ...l, piece: pieces.find((p) => p.id === l.pieceId) }))).total;

  const kit = await creerAvecNumero(
    async () => numeroSaisi || prochainNumero(prisma.piece, "numero", "KIT"),
    (num) => prisma.piece.create({
      data: {
        nom: nom.trim(), numero: num, prix: prixVente, coutant, categorie: categorie || "PIECE", estKit: true,
        composantsKit: { create: lignes },
        historique: { create: { champ: "Kit", nouvelleValeur: "Créé", modifiePar: session.nom } },
      },
    })
  );
  return NextResponse.json(kit);
}
