import { obtenirSession, aAccesSection, estDeveloppeur } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EnTete from "../../components/EnTete";
import FournisseursClient from "./FournisseursClient";

export default async function GestionFournisseurs() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) redirect("/gerant");

  const [fournisseursBruts, impayees] = await Promise.all([
    prisma.fournisseur.findMany({
      include: { _count: { select: { depenses: true } } },
      orderBy: { nom: "asc" },
    }),
    // Factures fournisseurs impayées — même source que la procédure de
    // fermeture (lib/checklistFermeture.js), pour l'affichage seulement
    prisma.depense.groupBy({ by: ["fournisseurId"], where: { statut: "IMPAYEE" }, _sum: { montant: true } }),
  ]);
  const aPayerPar = Object.fromEntries(impayees.map((d) => [d.fournisseurId, d._sum.montant || 0]));
  const fournisseurs = fournisseursBruts.map((f) => ({ ...f, aPayer: aPayerPar[f.id] || 0 }));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <FournisseursClient fournisseurs={fournisseurs} peutImporter={estDeveloppeur(session)} />
    </div>
  );
}
