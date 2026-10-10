import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import EnTete from "../../../components/EnTete";
import PieceDetailClient from "./PieceDetailClient";
import { voisinsFiche } from "@/lib/navigationFiches";
import NavigationFiches from "../../../components/NavigationFiches";

export default async function DetailPiece(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) redirect("/mecanicien");

  const [piece, categories, fournisseurs] = await Promise.all([
    prisma.piece.findUnique({
      where: { id: params.id },
      include: {
        fournisseur: true,
        utilisee: { include: { probleme: { include: { bon: { include: { client: true } } } } }, take: 50, orderBy: { id: "desc" } },
        lignesDepense: { where: { qteRecue: { not: null } }, include: { depense: { include: { fournisseur: true } } }, take: 50, orderBy: { id: "desc" } },
        mouvements: { take: 100, orderBy: { creeLe: "desc" } },
        historique: { take: 50, orderBy: { modifieLe: "desc" } },
        fournisseurs: { include: { fournisseur: true }, orderBy: { creeLe: "asc" } },
        lignesCommande: {
          where: { commande: { statut: { in: ["BROUILLON", "ENVOYEE", "RECUE_PARTIELLE"] } } },
          include: { commande: { include: { fournisseur: true } } },
        },
      },
    }),
    prisma.categorieInventaire.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    prisma.fournisseur.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
  ]);
  if (!piece) notFound();
  // Pour la fusion d'un doublon : les autres fiches, en version légère.
  const autresPieces = await prisma.piece.findMany({
    where: { id: { not: piece.id } },
    select: { id: true, nom: true, numero: true, qte: true, actif: true },
    orderBy: { nom: "asc" },
  });

  // Ordre par défaut de la liste : par nom, les désactivées cachées
  // (sauf si on est sur l'une d'elles)
  const ordre = [piece, ...autresPieces].filter((p) => p.actif || !piece.actif).sort((a, b) => a.nom.localeCompare(b.nom)).map((p) => p.id);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <PieceDetailClient piece={piece} categories={categories} fournisseurs={fournisseurs} autresPieces={autresPieces} />
      <NavigationFiches cle="pieces" idCourant={piece.id} base="/secretaire/inventaire" voisinsParDefaut={voisinsFiche(ordre, piece.id)} />
    </div>
  );
}
