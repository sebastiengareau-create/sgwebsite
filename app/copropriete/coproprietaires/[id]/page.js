import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { lienPortail } from "@/lib/copropriete";
import EnTete from "../../../components/EnTete";
import { exigerAccesCopro, simple } from "../../acces";
import CoproprietaireClient from "./CoproprietaireClient";

export default async function FicheCoproprietaire(props) {
  const { id } = await props.params;
  const session = await exigerAccesCopro();
  const c = await prisma.coproprietaireCopro.findUnique({
    where: { id },
    include: {
      proprietes: {
        include: { unite: { select: { id: true, numero: true, type: true, quotePart: true, charges: { select: { id: true, date: true, montant: true, type: true, description: true } }, paiements: { select: { id: true, date: true, montant: true, mode: true, reference: true } } } } },
        orderBy: [{ dateFin: { sort: "desc", nulls: "first" } }, { dateDebut: "desc" }],
      },
      demandes: { select: { id: true, numero: true, titre: true, statut: true, creeLe: true }, orderBy: { creeLe: "desc" } },
    },
  });
  if (!c) notFound();
  const { jetonPortail, ...reste } = c;
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <CoproprietaireClient coproprietaire={simple(reste)} lien={jetonPortail ? lienPortail(jetonPortail) : null} courrielConfigure={Boolean(process.env.RESEND_API_KEY)} />
    </div>
  );
}
