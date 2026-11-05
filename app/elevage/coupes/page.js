import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { peutGererElevage, assurerCoupesParDefaut, lireRendementCarcasse } from "@/lib/elevage";
import EnTete from "../../components/EnTete";
import CoupesClient from "./CoupesClient";

export default async function Coupes() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererElevage(session))) redirect("/mecanicien");
  await assurerCoupesParDefaut();

  const [coupes, rendementCarcasse] = await Promise.all([
    prisma.coupeViande.findMany({ include: { _count: { select: { lots: true } } }, orderBy: [{ ordre: "asc" }, { nom: "asc" }] }),
    lireRendementCarcasse(),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <CoupesClient coupes={coupes} rendementCarcasse={rendementCarcasse} />
    </div>
  );
}
