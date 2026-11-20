import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { peutGererElevage, lireRendementCarcasse, lireGmqCible, lieuxConnus, assurerCoupesParDefaut } from "@/lib/elevage";
import EnTete from "../../components/EnTete";
import BeteClient from "./BeteClient";

export default async function FicheBete(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererElevage(session))) redirect("/mecanicien");
  await assurerCoupesParDefaut();

  const [bete, registre, coupes, rendementCarcasse, gmqCible, lieux] = await Promise.all([
    prisma.bete.findUnique({
      where: { id: params.id },
      include: {
        pesees: { orderBy: { date: "asc" } },
        frais: { orderBy: { date: "desc" } },
        soins: { orderBy: [{ date: "desc" }, { creeLe: "desc" }] },
        boucles: { orderBy: { retireeLe: "desc" } },
        deplacements: { orderBy: [{ date: "desc" }, { creeLe: "desc" }] },
        mere: { select: { id: true, numero: true, nom: true } },
        pereBete: { select: { id: true, numero: true, nom: true } },
        veaux: { select: { id: true, numero: true, nom: true, sexe: true, dateNaissance: true, statut: true }, orderBy: { dateNaissance: "desc" } },
        veauxPere: { select: { id: true, numero: true, nom: true, sexe: true, dateNaissance: true, statut: true }, orderBy: { dateNaissance: "desc" } },
        saillies: {
          include: { taureau: { select: { id: true, numero: true, nom: true } }, veau: { select: { id: true, numero: true, nom: true } } },
          orderBy: [{ date: "desc" }, { creeLe: "desc" }],
        },
        abattage: {
          include: {
            lots: {
              include: { coupe: true, ventes: { orderBy: { date: "desc" } } },
              orderBy: { coupe: { ordre: "asc" } },
            },
          },
        },
      },
    }),
    // Tout le registre, en bref : choix de la mère et du père, lignée, consanguinité
    prisma.bete.findMany({ select: { id: true, numero: true, nom: true, sexe: true, statut: true, mereId: true, pereId: true, pere: true }, orderBy: { numero: "asc" } }),
    prisma.coupeViande.findMany({ where: { actif: true }, orderBy: [{ ordre: "asc" }, { nom: "asc" }] }),
    lireRendementCarcasse(),
    lireGmqCible(),
    lieuxConnus(),
  ]);
  if (!bete) notFound();

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <BeteClient bete={JSON.parse(JSON.stringify(bete))} registre={registre} coupes={coupes} rendementCarcasse={rendementCarcasse} gmqCible={gmqCible} lieux={lieux} />
    </div>
  );
}
