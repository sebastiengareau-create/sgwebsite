import { notFound, redirect } from "next/navigation";
import { peutGererJobsDeplacement } from "@/lib/envois";
import { obtenirSession, estGerantOuDev, aAccesSection, ROLES_VALIDES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable, COMPTES_REVENU_RESERVES } from "@/lib/comptabilite";
import { CLE as CLE_SITES_PIECES, lireSites } from "@/lib/recherchePieces";
import { assurerComptesTresorerie, obtenirComptesTresoreriePourSelection } from "@/lib/tresorerie";
import EnTete from "../../components/EnTete";
import BonDetailClient from "../BonDetailClient";

export default async function DetailBonPage(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!session) redirect("/login");

  const bon = await prisma.bonTravail.findUnique({
    where: { id: params.id },
    include: {
      client: { include: { vehicules: { orderBy: { creeLe: "desc" } } } },
      vehicule: true,
      vehiculeVente: { select: { id: true, numero: true } },
      problemes: {
        orderBy: { id: "asc" },
        include: {
          photos: true,
          pieces: { include: { piece: true } },
          entreesTemps: { include: { employe: true } },
        },
      },
      facture: true,
      piecesACommander: {
        orderBy: { creeLe: "asc" },
        include: {
          piece: { select: { id: true, nom: true, numero: true, qte: true, actif: true } },
          pieceUtilisee: { select: { id: true, bo: true, problemeId: true } },
          commande: { select: { id: true, numero: true, statut: true, depenses: { select: { id: true, statut: true } } } },
        },
      },
      // Fichiers joints au rendez-vous d'où vient le bon : noms seulement
      rendezVous: { select: { fichiers: { select: { id: true, nom: true }, orderBy: { creeLe: "asc" } } } },
    },
  });
  if (!bon) notFound();

  // N'importe quel mécanicien peut voir/travailler sur n'importe quel bon —
  // il n'y a plus d'assignation restrictive.

  const inventaire = await prisma.piece.findMany({
    where: { actif: true },
    include: { fournisseurs: { select: { numeroFournisseur: true, fournisseurId: true } } },
    orderBy: { nom: "asc" },
  });
  // Tous les employés actifs (pas seulement les mécaniciens) peuvent se voir
  // attribuer du temps manuellement sur une tâche.
  const employes = await prisma.user.findMany({
    where: { actif: true, role: { in: ROLES_VALIDES } },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });
  await assurerPlanComptable();
  // Inclut aussi les comptes désactivés (affichés grisés, non sélectionnables)
  // pour qu'une tâche déjà classée dessus ne se retrouve jamais avec une
  // valeur qui ne correspond à aucune option affichée.
  const postesRevenu = await prisma.compte.findMany({
    where: { type: "REVENU", numero: { notIn: COMPTES_REVENU_RESERVES } },
    orderBy: { numero: "asc" },
  });
  await assurerComptesTresorerie();
  const comptesTresorerie = await obtenirComptesTresoreriePourSelection();
  const parametres = await prisma.parametre.findMany();
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tauxHoraireClient = Number(dict.taux_horaire_client || 195);
  const coutHoraireMecanicien = Number(dict.cout_horaire_mecanicien || 95);
  // Bon interne sur un véhicule à vendre : facturé sans taxes
  const tpsTaux = bon.vehiculeVente ? 0 : Number(dict.tps_taux || 5);
  const tvqTaux = bon.vehiculeVente ? 0 : Number(dict.tvq_taux || 9.975);
  const sitesPieces = lireSites(dict[CLE_SITES_PIECES]);
  const peutModifier = await aAccesSection(session, "operations");
  const peutEnvoyer = await peutGererJobsDeplacement(session);
  // « 🛒 Commander » une pièce à commander : circuit des commandes fournisseurs
  const peutCommander = await aAccesSection(session, "inventaire");
  const fournisseurs = peutCommander
    ? await prisma.fournisseur.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } })
    : [];
  const peutPoinconner = estGerantOuDev(session) || session.role === "MECANICIEN";

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <BonDetailClient
        bon={bon}
        inventaire={inventaire}
        employes={employes}
        postesRevenu={postesRevenu}
        comptesTresorerie={comptesTresorerie}
        tauxHoraireClient={tauxHoraireClient}
        coutHoraireMecanicien={coutHoraireMecanicien}
        tpsTaux={tpsTaux}
        tvqTaux={tvqTaux}
        sitesPieces={sitesPieces}
        fournisseurs={fournisseurs}
        peutCommander={peutCommander}
        peutModifier={peutModifier}
        peutEnvoyer={peutEnvoyer}
        peutPoinconner={peutPoinconner}
        estGerant={estGerantOuDev(session)}
        moi={session.id}
      />
    </div>
  );
}
