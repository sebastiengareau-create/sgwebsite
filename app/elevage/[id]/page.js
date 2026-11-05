import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { peutGererElevage, lireRendementCarcasse, assurerCoupesParDefaut } from "@/lib/elevage";
import EnTete from "../../components/EnTete";
import BeteClient from "./BeteClient";

export default async function FicheBete(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererElevage(session))) redirect("/mecanicien");
  await assurerCoupesParDefaut();

  const [bete, femelles, coupes, rendementCarcasse] = await Promise.all([
    prisma.bete.findUnique({
      where: { id: params.id },
      include: {
        pesees: { orderBy: { date: "asc" } },
        frais: { orderBy: { date: "desc" } },
        mere: { select: { id: true, numero: true, nom: true } },
        veaux: { select: { id: true, numero: true, nom: true, sexe: true, dateNaissance: true, statut: true }, orderBy: { dateNaissance: "desc" } },
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
    prisma.bete.findMany({ where: { sexe: "FEMELLE", id: { not: params.id } }, select: { id: true, numero: true, nom: true }, orderBy: { numero: "asc" } }),
    prisma.coupeViande.findMany({ where: { actif: true }, orderBy: [{ ordre: "asc" }, { nom: "asc" }] }),
    lireRendementCarcasse(),
  ]);
  if (!bete) notFound();

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <BeteClient bete={JSON.parse(JSON.stringify(bete))} femelles={femelles} coupes={coupes} rendementCarcasse={rendementCarcasse} />
    </div>
  );
}
