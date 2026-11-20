import { notFound, redirect } from "next/navigation";
import { peutGererJobsDeplacement } from "@/lib/envois";
import { obtenirSession, estGerantOuDev, aAccesSection, ROLES_VALIDES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { lireParametres } from "@/lib/parametres";
import { assurerPlanComptable, COMPTES_REVENU_RESERVES } from "@/lib/comptabilite";
import { CLE as CLE_SITES_PIECES, lireSites } from "@/lib/recherchePieces";
import { assurerComptesTresorerie, obtenirComptesTresoreriePourSelection } from "@/lib/tresorerie";
import { CLIENT } from "@/lib/client";
import { kitsDisponibles } from "@/lib/kits";
import { soldeCredit } from "@/lib/creditClient";
import EnTete from "../../components/EnTete";
import BonDetailClient from "../BonDetailClient";

export default async function DetailBonPage(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!session) redirect("/login");

  // Tout ce qui ne dépend pas du bon est lu en parallèle avec lui, plutôt
  // qu'une lecture après l'autre
  const [
    bon, inventaireBrut, employes, postesRevenu, comptesTresorerie, dict,
    peutModifier, peutEnvoyer, peutCommander, { nomEntreprise },
  ] = await Promise.all([
    prisma.bonTravail.findUnique({
      where: { id: params.id },
      include: {
        client: { include: { vehicules: { orderBy: { creeLe: "desc" } } } },
        vehicule: true,
        vehiculeVente: { select: { id: true, numero: true } },
        // Positions seulement : les images se chargent sur demande
        photosArrivee: CLIENT.photosArrivee ? { select: { id: true, position: true, ajouteeLe: true } } : false,
        problemes: {
          orderBy: { id: "asc" },
          include: {
            // Sans les images : chacune se charge à part (GET …/photos/[photoId])
            photos: { select: { id: true } },
            retourPiece: { select: { numero: true, nom: true } }, // retour d'une pièce hors inventaire (lib/retours.js)
            pieces: { include: { piece: true } },
            entreesTemps: { include: { employe: true } },
          },
        },
        facture: {
          include: {
            paiements: { include: { compteTresorerie: { select: { nom: true } }, depot: { select: { datePaiement: true } } }, orderBy: { datePaiement: "asc" } },
            // Excédents de paiement gardés en crédit client (lib/creditClient.js)
            creditsTropPaye: { where: { type: "TROP_PAYE" }, include: { compteTresorerie: { select: { nom: true } } }, orderBy: { date: "asc" } },
          },
        },
        // Dépôts reçus avant la facture (lib/depots.js)
        depots: {
          include: { compteTresorerie: { select: { nom: true } }, paiementFacture: { select: { montant: true } }, creditClient: { select: { montant: true } } },
          orderBy: { datePaiement: "asc" },
        },
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
    }),
    // Seulement ce qu'utilisent le choix de pièce, le scan et les pièces à
    // commander (BonDetailClient, PiecesACommander) — l'inventaire peut compter
    // des milliers de pièces, envoyées à chaque ouverture d'un bon
    prisma.piece.findMany({
      where: { actif: true },
      select: {
        id: true, nom: true, numero: true, autresNumeros: true, codeBarre: true, qte: true, prix: true, estKit: true, actif: true, fournisseurId: true,
        fournisseurs: { select: { numeroFournisseur: true, fournisseurId: true } },
        composantsKit: { select: { pieceId: true, qte: true, piece: { select: { qte: true } } } },
      },
      orderBy: { nom: "asc" },
    }),
    // Tous les employés actifs (pas seulement les mécaniciens) peuvent se voir
    // attribuer du temps manuellement sur une tâche.
    prisma.user.findMany({
      where: { actif: true, role: { in: ROLES_VALIDES } },
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    }),
    // Inclut aussi les comptes désactivés (affichés grisés, non sélectionnables)
    // pour qu'une tâche déjà classée dessus ne se retrouve jamais avec une
    // valeur qui ne correspond à aucune option affichée.
    assurerPlanComptable().then(() => prisma.compte.findMany({
      where: { type: "REVENU", numero: { notIn: COMPTES_REVENU_RESERVES } },
      orderBy: { numero: "asc" },
    })),
    assurerComptesTresorerie().then(() => obtenirComptesTresoreriePourSelection()),
    lireParametres(["taux_horaire_client", "cout_horaire_mecanicien", "tps_taux", "tvq_taux", "tps_numero", "tvq_numero", CLE_SITES_PIECES]),
    aAccesSection(session, "operations"),
    peutGererJobsDeplacement(session),
    // « 🛒 Commander » une pièce à commander : circuit des commandes fournisseurs
    aAccesSection(session, "inventaire"),
    obtenirInfosEntreprise(), // signe les textos au client
  ]);
  if (!bon) notFound();

  // N'importe quel mécanicien peut voir/travailler sur n'importe quel bon —
  // il n'y a plus d'assignation restrictive.

  // Un kit n'a pas de stock à lui : sa quantité est le nombre de kits que
  // le stock de ses pièces permet de faire (999 : kit sans pièce)
  const inventaire = inventaireBrut.map(({ composantsKit, ...p }) => (p.estKit ? { ...p, qte: kitsDisponibles(composantsKit) ?? 999 } : p));
  const tauxHoraireClient = Number(dict.taux_horaire_client || 195);
  const coutHoraireMecanicien = Number(dict.cout_horaire_mecanicien || 95);
  // Bon interne sur un véhicule à vendre : facturé sans taxes
  const tpsTaux = bon.vehiculeVente ? 0 : Number(dict.tps_taux || 5);
  const tvqTaux = bon.vehiculeVente ? 0 : Number(dict.tvq_taux || 9.975);
  const sitesPieces = lireSites(dict[CLE_SITES_PIECES]);
  const peutPoinconner = estGerantOuDev(session) || session.role === "MECANICIEN";
  const [creditClient, fournisseurs, clientsChoix] = await Promise.all([
    // Crédit du client disponible pour la facture (lib/creditClient.js)
    bon.vehiculeVenteId ? 0 : soldeCredit(bon.clientId),
    peutCommander
      ? prisma.fournisseur.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } })
      : [],
    // Choix d'un autre client (« Changer » sous le nom) : bon modifiable seulement
    peutModifier && !bon.facture && !bon.vehiculeVenteId
      ? prisma.client.findMany({ select: { id: true, nom: true, numero: true, telephone: true }, orderBy: { nom: "asc" } })
      : [],
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <BonDetailClient
        nomEntreprise={nomEntreprise}
        bon={bon}
        inventaire={inventaire}
        employes={employes}
        postesRevenu={postesRevenu}
        comptesTresorerie={comptesTresorerie}
        tauxHoraireClient={tauxHoraireClient}
        coutHoraireMecanicien={coutHoraireMecanicien}
        tpsTaux={tpsTaux}
        tvqTaux={tvqTaux}
        tpsNumero={dict.tps_numero || ""}
        tvqNumero={dict.tvq_numero || ""}
        sitesPieces={sitesPieces}
        fournisseurs={fournisseurs}
        peutCommander={peutCommander}
        peutModifier={peutModifier}
        peutEnvoyer={peutEnvoyer}
        peutPoinconner={peutPoinconner}
        estGerant={estGerantOuDev(session)}
        moi={session.id}
        clientsChoix={clientsChoix}
        creditClient={creditClient}
      />
    </div>
  );
}
