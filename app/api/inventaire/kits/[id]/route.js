import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { validerComposantsKit, coutantKit } from "@/lib/kits";

// Modifie un kit : nom, numéro, prix, catégorie et composants (remplacés en
// entier). Les bons où le kit est déjà ajouté gardent leur contenu figé.
// Désactiver ou supprimer un kit passe par /api/inventaire/[id].
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const avant = await prisma.piece.findUnique({ where: { id: params.id } });
  if (!avant?.estKit) return NextResponse.json({ erreur: "Kit introuvable." }, { status: 404 });

  const { nom, numero, prix, categorie, composants } = await request.json().catch(() => ({}));
  if (!String(nom || "").trim()) return NextResponse.json({ erreur: "Donne un nom au kit." }, { status: 400 });
  if (!String(numero || "").trim()) return NextResponse.json({ erreur: "Le numéro est obligatoire." }, { status: 400 });
  const prixVente = Number(prix);
  if (!Number.isFinite(prixVente) || prixVente < 0) return NextResponse.json({ erreur: "Prix de vente invalide." }, { status: 400 });

  const pieces = await prisma.piece.findMany({ where: { id: { in: (composants || []).map((c) => c.pieceId).filter(Boolean) } } });
  const { lignes, erreur } = validerComposantsKit(composants, pieces, avant.id);
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });
  const coutant = coutantKit(lignes.map((l) => ({ ...l, piece: pieces.find((p) => p.id === l.pieceId) }))).total;

  const data = { nom: nom.trim(), numero: numero.trim(), prix: prixVente, coutant, categorie: categorie || avant.categorie };
  const CHAMPS_SUIVIS = { nom: "Description", numero: "Numéro", prix: "Prix de vente", categorie: "Catégorie" };
  const historique = Object.entries(CHAMPS_SUIVIS)
    .filter(([champ]) => data[champ] !== avant[champ])
    .map(([champ, label]) => ({ champ: label, ancienneValeur: String(avant[champ]), nouvelleValeur: String(data[champ]), modifiePar: session.nom }));
  historique.push({ champ: "Contenu du kit", nouvelleValeur: `${lignes.length} élément${lignes.length > 1 ? "s" : ""}`, modifiePar: session.nom });

  try {
    const kit = await prisma.$transaction(async (tx) => {
      await tx.composantKit.deleteMany({ where: { kitId: avant.id } });
      return tx.piece.update({
        where: { id: avant.id },
        data: { ...data, composantsKit: { create: lignes }, historique: { create: historique } },
      });
    });
    return NextResponse.json(kit);
  } catch (e) {
    if (e.code === "P2002") return NextResponse.json({ erreur: "Ce numéro existe déjà dans l'inventaire." }, { status: 409 });
    throw e;
  }
}
