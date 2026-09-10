import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerComptesTresorerie, obtenirComptesTresorerieAvecSoldes, obtenirResumeTresorerie, obtenirEntreesSortiesMois } from "@/lib/tresorerie";
import EnTete from "../../../components/EnTete";
import CaisseBanqueClient from "./CaisseBanqueClient";

export default async function CaisseBanque() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerComptesTresorerie();
  const comptes = await obtenirComptesTresorerieAvecSoldes({ actifSeulement: true });
  const resume = obtenirResumeTresorerie(comptes);
  const { entreesMois, sortiesMois, serie30Jours } = await obtenirEntreesSortiesMois(comptes);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <CaisseBanqueClient comptes={comptes} resume={resume} entreesMois={entreesMois} sortiesMois={sortiesMois} serie30Jours={serie30Jours} />
    </div>
  );
}
