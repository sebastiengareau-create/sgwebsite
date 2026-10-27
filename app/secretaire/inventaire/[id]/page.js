import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import EnTete from "../../../components/EnTete";
import PieceDetailClient from "./PieceDetailClient";
import KitDetailClient from "./KitDetailClient";
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
        composantsKit: { include: { piece: true }, orderBy: { ordre: "asc" } },
        dansKits: { select: { qte: true, kit: { select: { id: true, nom: true } } } },
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
    select: { id: true, nom: true, numero: true, qte: true, coutant: true, actif: true, estKit: true, autresNumeros: true, codeBarre: true },
    orderBy: { nom: "asc" },
  });

  // Ordre par défaut de la liste : par nom, les désactivées cachées
  // (sauf si on est sur l'une d'elles)
  const ordre = [piece, ...autresPieces].filter((p) => p.actif || !piece.actif).sort((a, b) => a.nom.localeCompare(b.nom)).map((p) => p.id);

  if (piece.estKit) {
    const coutHoraire = await prisma.parametre.findUnique({ where: { cle: "cout_horaire_mecanicien" } });
    // Pièces qu'on peut mettre dans le kit : actives, pas des kits — et
    // celles déjà dedans, même désactivées depuis
    const pieces = autresPieces.filter((p) => !p.estKit && (p.actif || piece.composantsKit.some((c) => c.pieceId === p.id)));
    return (
      <div>
        <EnTete nom={session.nom} role={session.role} />
        <KitDetailClient kit={piece} pieces={pieces} categories={categories} coutHoraireDefaut={Number(coutHoraire?.valeur || 95)} />
        <NavigationFiches cle="pieces" idCourant={piece.id} base="/secretaire/inventaire" voisinsParDefaut={voisinsFiche(ordre, piece.id)} />
      </div>
    );
  }

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <PieceDetailClient piece={piece} categories={categories} fournisseurs={fournisseurs} autresPieces={autresPieces.filter((p) => !p.estKit)} />
      <NavigationFiches cle="pieces" idCourant={piece.id} base="/secretaire/inventaire" voisinsParDefaut={voisinsFiche(ordre, piece.id)} />
    </div>
  );
}
