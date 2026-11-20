import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { donneesRendement } from "@/lib/immobilier";
import { periodeCourante } from "@/lib/immobilierCalculs";
import { exigerAccesImmo, simple } from "../acces";
import DepensesClient from "./DepensesClient";

export default async function DepensesImmo(props) {
  const session = await exigerAccesImmo();
  const params = await props.searchParams;
  const courante = Number(periodeCourante().slice(0, 4));
  const annee = /^\d{4}$/.test(params?.annee || "") ? Number(params.annee) : courante;
  const [immeubles, depenses, donnees] = await Promise.all([
    prisma.immeubleImmo.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.depenseImmo.findMany({ where: { date: { gte: new Date(Date.UTC(annee, 0, 1)), lt: new Date(Date.UTC(annee + 1, 0, 1)) } }, orderBy: { date: "desc" } }),
    donneesRendement(annee),
  ]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <DepensesClient {...simple({ immeubles, depenses, donnees, annee, courante, immeubleInit: params?.immeuble || "" })} />
    </div>
  );
}
