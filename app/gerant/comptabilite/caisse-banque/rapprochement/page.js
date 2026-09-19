import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerComptesTresorerie, obtenirComptesTresoreriePourSelection } from "@/lib/tresorerie";
import EnTete from "../../../../components/EnTete";
import RapprochementClient from "./RapprochementClient";

export default async function Rapprochement({ searchParams }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerComptesTresorerie();
  const comptesTresorerie = await obtenirComptesTresoreriePourSelection();

  const compteId = searchParams?.compte || comptesTresorerie.find((c) => c.categorie === "BANQUE")?.id || comptesTresorerie[0]?.id;
  const compteChoisi = compteId ? await prisma.compteTresorerie.findUnique({ where: { id: compteId }, include: { compte: true } }) : null;

  const lignes = compteChoisi
    ? await prisma.ligneEcriture.findMany({
        where: { compteId: compteChoisi.compte.id },
        include: { ecriture: true },
        orderBy: { ecriture: { date: "asc" } },
      })
    : [];

  const historique = compteChoisi
    ? await prisma.rapprochementBancaire.findMany({ where: { compteTresorerieId: compteChoisi.id }, orderBy: { dateRapprochement: "desc" }, take: 12 })
    : [];

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <RapprochementClient comptesTresorerie={comptesTresorerie} compteId={compteId} lignes={lignes} historique={historique} />
    </div>
  );
}
