import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { quantitesEnCommande, quantiteSuggeree } from "@/lib/commandesFournisseurs";
import { CLE as CLE_SITES_PIECES, lireSites } from "@/lib/recherchePieces";
import EnTete from "../../../components/EnTete";
import CommandesClient from "./CommandesClient";

export default async function CommandesFournisseurs(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) redirect("/mecanicien");

  const [commandes, fournisseurs, pieces, enCommande, sitesPieces] = await Promise.all([
    prisma.commandeFournisseur.findMany({
      include: { fournisseur: true, lignes: { select: { qteCommandee: true, qteRecue: true, coutUnitaire: true } } },
      orderBy: { creeLe: "desc" },
      take: 300,
    }),
    prisma.fournisseur.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    prisma.piece.findMany({ where: { actif: true }, include: { fournisseurs: true }, orderBy: { nom: "asc" } }),
    // Les brouillons comptent aussi : une pièce déjà mise dans une commande
    // pas encore envoyée n'est plus à proposer.
    quantitesEnCommande(prisma, undefined, { avecBrouillons: true }),
    prisma.parametre.findUnique({ where: { cle: CLE_SITES_PIECES } }),
  ]);

  // Pièces à réapprovisionner (stock + déjà commandé ≤ seuil minimum),
  // avec le fournisseur proposé : l'habituel, sinon le moins cher connu.
  const suggestions = pieces
    .map((p) => ({ piece: p, qte: quantiteSuggeree(p, enCommande[p.id] || 0) }))
    .filter((s) => s.qte > 0)
    .map(({ piece, qte }) => {
      const moinsCher = [...piece.fournisseurs].filter((f) => f.coutant != null).sort((a, b) => a.coutant - b.coutant)[0];
      return {
        pieceId: piece.id, nom: piece.nom, numero: piece.numero, stock: piece.qte, qteMin: piece.qteMin,
        enCommande: enCommande[piece.id] || 0, qte,
        fournisseurId: piece.fournisseurId || moinsCher?.fournisseurId || null,
      };
    });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <CommandesClient
        commandes={commandes}
        fournisseurs={fournisseurs}
        suggestions={suggestions}
        inventaire={pieces}
        sitesPieces={lireSites(sitesPieces?.valeur)}
        fournisseurInitial={typeof searchParams?.fournisseur === "string" ? searchParams.fournisseur : ""}
      />
    </div>
  );
}
