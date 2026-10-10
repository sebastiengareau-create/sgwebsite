import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { quantitesEnCommande } from "@/lib/commandesFournisseurs";
import EnTete from "../../../../components/EnTete";
import CommandeDetailClient from "./CommandeDetailClient";
import { voisinsFiche } from "@/lib/navigationFiches";
import NavigationFiches from "../../../../components/NavigationFiches";

export default async function DetailCommande(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) redirect("/mecanicien");

  const commande = await prisma.commandeFournisseur.findUnique({
    where: { id: params.id },
    include: {
      fournisseur: true,
      lignes: { include: { piece: true }, orderBy: { id: "asc" } },
      depenses: { orderBy: { creeLe: "asc" } },
    },
  });
  if (!commande) notFound();

  const [pieces, fournisseurs, parametres, enCommande, peutVoirDepenses] = await Promise.all([
    prisma.piece.findMany({
      where: { actif: true },
      include: { fournisseurs: { include: { fournisseur: { select: { nom: true } } } } },
      orderBy: { nom: "asc" },
    }),
    prisma.fournisseur.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    prisma.parametre.findMany({ where: { cle: { in: ["tps_taux", "tvq_taux"] } } }),
    quantitesEnCommande(prisma, undefined, { avecBrouillons: true }),
    aAccesSection(session, "fournisseurs"),
  ]);
  // Ordre par défaut de la liste : même groupe de statuts, plus récentes d'abord
  const groupes = [["BROUILLON", "ENVOYEE", "RECUE_PARTIELLE"], ["RECUE"], ["ANNULEE"]];
  const groupe = groupes.find((g) => g.includes(commande.statut));
  const ordre = await prisma.commandeFournisseur.findMany({ where: groupe ? { statut: { in: groupe } } : undefined, select: { id: true }, orderBy: { creeLe: "desc" }, take: 300 });
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <CommandeDetailClient
        commande={commande}
        pieces={pieces}
        fournisseurs={fournisseurs}
        enCommande={enCommande}
        tpsTaux={Number(dict.tps_taux || 5)}
        tvqTaux={Number(dict.tvq_taux || 9.975)}
        peutVoirDepenses={peutVoirDepenses}
      />
      <NavigationFiches cle="commandes" idCourant={commande.id} base="/secretaire/inventaire/commandes" voisinsParDefaut={voisinsFiche(ordre.map((c) => c.id), commande.id)} />
    </div>
  );
}
