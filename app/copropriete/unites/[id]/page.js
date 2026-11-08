import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import { exigerAccesCopro, simple } from "../../acces";
import UniteClient from "./UniteClient";

export default async function FicheUnite(props) {
  const { id } = await props.params;
  const session = await exigerAccesCopro();
  const [unite, batiments, coproprietaires] = await Promise.all([
    prisma.uniteCopro.findUnique({
      where: { id },
      include: {
        batiment: { select: { id: true, nom: true } },
        proprietes: { include: { coproprietaire: { select: { id: true, nom: true, courriel: true, telephone: true } } }, orderBy: [{ dateFin: { sort: "desc", nulls: "first" } }, { dateDebut: "desc" }] },
        occupants: { orderBy: [{ dateFin: { sort: "desc", nulls: "first" } }, { dateDebut: "desc" }] },
        espaces: { orderBy: [{ type: "asc" }, { numero: "asc" }] },
        charges: { orderBy: { date: "asc" } },
        paiements: { orderBy: { date: "asc" } },
        demandes: { select: { id: true, numero: true, titre: true, statut: true, priorite: true, creeLe: true }, orderBy: { creeLe: "desc" } },
        travaux: { select: { id: true, numero: true, titre: true, statut: true, coutReel: true, coutEstime: true, dateFin: true, creeLe: true, fournisseur: { select: { nom: true } } }, orderBy: { creeLe: "desc" } },
        documents: { select: { id: true, titre: true, categorie: true, date: true, visibilite: true, nom: true, taille: true, creeLe: true }, orderBy: { creeLe: "desc" } },
      },
    }),
    prisma.batimentCopro.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.coproprietaireCopro.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  if (!unite) notFound();
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <UniteClient {...simple({ unite, batiments, coproprietaires })} />
    </div>
  );
}
