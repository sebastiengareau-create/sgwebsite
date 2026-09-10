import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerComptesTresorerie, obtenirComptesTresoreriePourSelection, obtenirTransfertsRecents } from "@/lib/tresorerie";
import EnTete from "../../../../components/EnTete";
import TransfertsClient from "./TransfertsClient";

export default async function Transferts() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerComptesTresorerie();
  const [comptesTresorerie, transferts] = await Promise.all([
    obtenirComptesTresoreriePourSelection(),
    obtenirTransfertsRecents(),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <TransfertsClient comptesTresorerie={comptesTresorerie} transferts={transferts} />
    </div>
  );
}
