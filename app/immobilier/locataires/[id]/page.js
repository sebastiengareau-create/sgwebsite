import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import { soldesDesBaux, lienPortailLocataire } from "@/lib/immobilier";
import { exigerAccesImmo, simple, DOC_SANS_DONNEES } from "../../acces";
import LocataireClient from "./LocataireClient";

export default async function FicheLocataire(props) {
  const { id } = await props.params;
  const session = await exigerAccesImmo();
  const [locataire, soldes] = await Promise.all([
    prisma.locataireImmo.findUnique({
      where: { id },
      include: {
        baux: {
          include: { logement: { select: { id: true, numero: true, type: true, immeuble: { select: { id: true, nom: true } } } }, locataires: { select: { id: true, nom: true } } },
          orderBy: { dateDebut: "desc" },
        },
        reparations: { select: { id: true, numero: true, source: true, titre: true, statut: true, priorite: true, entrepreneur: true, coutEstime: true, coutReel: true, creeLe: true, immeuble: { select: { nom: true } }, logement: { select: { numero: true, type: true } } }, orderBy: { creeLe: "desc" } },
        documents: { select: DOC_SANS_DONNEES, orderBy: [{ date: "desc" }, { creeLe: "desc" }] },
      },
    }),
    soldesDesBaux({ bail: { locataires: { some: { id } } } }),
  ]);
  if (!locataire) notFound();
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <LocataireClient {...simple({ locataire, soldes })} lien={locataire.jetonPortail ? lienPortailLocataire(locataire.jetonPortail) : null} courrielConfigure={Boolean(process.env.RESEND_API_KEY)} />
    </div>
  );
}
