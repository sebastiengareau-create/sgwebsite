import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { quantitesEnCommande } from "@/lib/commandesFournisseurs";
import { suggestionReappro, ventesRecentes } from "@/lib/reapprovisionnement";
import EnTete from "../../../components/EnTete";
import CommandesClient from "./CommandesClient";

export default async function CommandesFournisseurs(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) redirect("/mecanicien");

  const [commandes, fournisseurs, pieces, enCommande, { venduParPiece, jours }] = await Promise.all([
    prisma.commandeFournisseur.findMany({
      include: { fournisseur: true, lignes: { select: { qteCommandee: true, qteRecue: true, coutUnitaire: true } } },
      orderBy: { creeLe: "desc" },
      take: 300,
    }),
    prisma.fournisseur.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    prisma.piece.findMany({ where: { actif: true, estKit: false }, include: { fournisseurs: true }, orderBy: { nom: "asc" } }),
    // Les brouillons comptent aussi : une pièce déjà mise dans une commande
    // pas encore envoyée n'est plus à proposer.
    quantitesEnCommande(prisma, undefined, { avecBrouillons: true }),
    // Ventes des derniers mois (moins les retours) : le rythme de chaque pièce
    ventesRecentes(prisma),
  ]);

  // Pièces à réapprovisionner : au seuil minimum ou sous lui, ou bientôt
  // épuisées au rythme où elles se vendent (lib/reapprovisionnement.js) —
  // avec le fournisseur proposé : l'habituel, sinon le moins cher connu.
  // Les plus pressantes en premier.
  const suggestions = pieces
    .map((p) => ({ piece: p, s: suggestionReappro(p, { enCommande: enCommande[p.id] || 0, vendu: venduParPiece[p.id] || 0, jours }) }))
    .filter(({ s }) => s)
    .map(({ piece, s }) => {
      const moinsCher = [...piece.fournisseurs].filter((f) => f.coutant != null).sort((a, b) => a.coutant - b.coutant)[0];
      return {
        pieceId: piece.id, nom: piece.nom, numero: piece.numero, stock: piece.qte, qteMin: piece.qteMin,
        enCommande: enCommande[piece.id] || 0, ...s,
        fournisseurId: piece.fournisseurId || moinsCher?.fournisseurId || null,
      };
    })
    .sort((a, b) => (a.joursRestants ?? 9999) - (b.joursRestants ?? 9999) || a.nom.localeCompare(b.nom));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <CommandesClient
        commandes={commandes}
        fournisseurs={fournisseurs}
        suggestions={suggestions}
        joursVentes={jours}
        fournisseurInitial={typeof searchParams?.fournisseur === "string" ? searchParams.fournisseur : ""}
      />
    </div>
  );
}
