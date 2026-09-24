import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerComptesTresorerie, obtenirComptesTresoreriePourSelection } from "@/lib/tresorerie";
import { sensCompte, montantLigne, obtenirSoldeOuverture, obtenirLignesNonVerrouillees } from "@/lib/rapprochement";
import { dateQuebecStr } from "@/lib/temps";
import EnTete from "../../../components/EnTete";
import RapprochementClient from "./RapprochementClient";

export default async function Rapprochement(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerComptesTresorerie();
  const comptesTresorerie = await obtenirComptesTresoreriePourSelection();

  const compteId = searchParams?.compte || comptesTresorerie.find((c) => c.categorie === "BANQUE")?.id || comptesTresorerie[0]?.id;
  const compteChoisi = compteId ? await prisma.compteTresorerie.findUnique({ where: { id: compteId } }) : null;
  const sens = sensCompte(compteChoisi?.categorie);

  const [soldeOuverture, lignesBrutes, historique] = compteChoisi
    ? await Promise.all([
        obtenirSoldeOuverture(compteChoisi.compteId, sens),
        obtenirLignesNonVerrouillees(compteChoisi.compteId),
        prisma.rapprochementBancaire.findMany({
          where: { compteTresorerieId: compteChoisi.id },
          orderBy: [{ dateRapprochement: "desc" }, { creeLe: "desc" }],
          take: 12,
          include: { _count: { select: { lignes: true } } },
        }),
      ])
    : [0, [], []];

  // Montants déjà dans le sens du relevé (voir sensCompte) et date en jour
  // civil du Québec, pour que le client filtre selon la date du relevé.
  const lignes = lignesBrutes.map((l) => ({
    id: l.id,
    rapproche: l.rapproche,
    montant: montantLigne(l, sens),
    dateStr: dateQuebecStr(l.ecriture.date),
    description: l.description || l.ecriture.description,
    numero: l.ecriture.numero,
  }));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <RapprochementClient
        comptesTresorerie={comptesTresorerie}
        compteId={compteId}
        categorie={compteChoisi?.categorie}
        soldeOuverture={soldeOuverture}
        lignes={lignes}
        historique={historique}
      />
    </div>
  );
}
