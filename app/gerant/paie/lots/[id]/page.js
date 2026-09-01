import { redirect, notFound } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirChecklistLot } from "@/lib/checklistLot";
import EnTete from "../../../../components/EnTete";
import LotDetailClient from "./LotDetailClient";

export default async function LotPaieDetail({ params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) redirect("/gerant");

  const lot = await prisma.lotPaie.findUnique({
    where: { id: params.id },
    include: { paies: { include: { employe: true }, orderBy: { creeLe: "asc" } } },
  });
  if (!lot) notFound();

  const checklist = lot.statut === "BROUILLON" ? await obtenirChecklistLot(lot.paies) : null;

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <LotDetailClient lot={lot} checklist={checklist} />
    </div>
  );
}
