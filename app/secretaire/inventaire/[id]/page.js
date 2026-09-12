import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import EnTete from "../../../components/EnTete";
import PieceDetailClient from "./PieceDetailClient";

export default async function DetailPiece({ params }) {
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
      },
    }),
    prisma.categorieInventaire.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    prisma.fournisseur.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
  ]);
  if (!piece) notFound();

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <PieceDetailClient piece={piece} categories={categories} fournisseurs={fournisseurs} />
    </div>
  );
}
