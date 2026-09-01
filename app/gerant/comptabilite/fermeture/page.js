import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { limitesMoisQuebec, dateAujourdhuiQuebec } from "@/lib/temps";
import EnTete from "../../../components/EnTete";
import FermetureClient from "./FermetureClient";

export default async function FermeturePeriode({ searchParams }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  const annee = Number(searchParams?.annee) || Number(dateAujourdhuiQuebec().split("-")[0]);

  const periodesExistantes = await prisma.periodeComptable.findMany({ where: { annee } });
  const parMois = Object.fromEntries(periodesExistantes.map((p) => [p.mois, p]));
  const periodes = Array.from({ length: 12 }, (_, i) => {
    const mois = i + 1;
    const existante = parMois[mois];
    if (existante) return existante;
    const { debut, fin } = limitesMoisQuebec(annee, mois);
    return { annee, mois, dateDebut: debut, dateFin: fin, statut: "OUVERTE", statutParNom: null, statutLe: null };
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <FermetureClient periodes={periodes} annee={annee} />
    </div>
  );
}
