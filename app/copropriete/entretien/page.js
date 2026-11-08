import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { exigerAccesCopro, simple } from "../acces";
import EntretienClient from "./EntretienClient";

export default async function EntretienCopro(props) {
  const searchParams = await props.searchParams;
  const session = await exigerAccesCopro();
  const [demandes, travaux, entretiens, unites, batiments, coproprietaires, fournisseurs] = await Promise.all([
    prisma.demandeCopro.findMany({
      select: {
        id: true, numero: true, type: true, titre: true, priorite: true, statut: true, categorie: true, source: true, emplacement: true, creeLe: true,
        unite: { select: { numero: true } }, batiment: { select: { nom: true } }, coproprietaire: { select: { nom: true } }, signalePar: true,
        _count: { select: { fichiers: true, travaux: true } },
      },
      orderBy: { creeLe: "desc" },
    }),
    prisma.travailCopro.findMany({
      select: {
        id: true, numero: true, titre: true, priorite: true, statut: true, categorie: true, emplacement: true, datePrevue: true, dateFin: true, coutEstime: true, coutReel: true, creeLe: true,
        unite: { select: { numero: true } }, batiment: { select: { nom: true } }, fournisseur: { select: { nom: true } }, entretienId: true,
      },
      orderBy: { creeLe: "desc" },
    }),
    prisma.entretienCopro.findMany({
      include: { fournisseur: { select: { id: true, nom: true } }, batiment: { select: { nom: true } }, travaux: { where: { statut: { in: ["A_PLANIFIER", "PLANIFIE", "EN_COURS"] } }, select: { id: true, numero: true } } },
      orderBy: { prochaineDate: "asc" },
    }),
    prisma.uniteCopro.findMany({ select: { id: true, numero: true, batimentId: true } }),
    prisma.batimentCopro.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.coproprietaireCopro.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.fournisseur.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  unites.sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }));
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EntretienClient
        {...simple({ demandes, travaux, entretiens, unites, batiments, coproprietaires, fournisseurs })}
        ongletInitial={searchParams?.onglet} uniteInitiale={searchParams?.unite} nouvelle={searchParams?.nouvelle === "1"}
      />
    </div>
  );
}
