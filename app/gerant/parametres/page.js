import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { chargerReglagesDisponibilites } from "@/lib/disponibilites";
import { dateAujourdhuiQuebec, limitesMoisQuebec, joursCalendairesQuebec } from "@/lib/temps";
import { calculerResumeRevenusDepenses } from "@/lib/rapportsComptables";
import EnTete from "../../components/EnTete";
import ParametresClient from "./ParametresClient";
import TachesInternesSection from "./TachesInternesSection";
import SitesPiecesSection from "./SitesPiecesSection";
import PartsTechSection from "./PartsTechSection";
import AProposSection from "./AProposSection";
import GrillesInspectionSection from "./GrillesInspectionSection";
import PaiementEnLigneSection from "./PaiementEnLigneSection";
import { paiementEnLigneActif, lirePourcentDepot, modeTestStripe } from "@/lib/paiementEnLigne";
import TextosSection from "./TextosSection";
import { textosActifs, lireReglagesTextos, numeroEnvoi } from "@/lib/textosAuto";
import { segmentsTexto } from "@/lib/textos";
import { inspectionActive, lireGrilles, CLE_GRILLES } from "@/lib/inspections";
import { nbPointsGrille } from "@/lib/grillesInspection";
import { lireConfig as lireConfigPartsTech } from "@/lib/partstech";
import { CLE as CLE_SITES_PIECES, lireSites } from "@/lib/recherchePieces";
import { CLIENT } from "@/lib/client";

export default async function Parametres() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) {
    // GERANT est configurable ici aussi — repli sûr si jamais décoché, pour
    // éviter une boucle vers /gerant si "vue-ensemble" est aussi décoché.
    redirect(session.role === "GERANT" ? "/secretaire" : "/gerant");
  }

  const parametres = await prisma.parametre.findMany();
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  let cleFlux = dict.calendrier_flux_cle;
  if (!cleFlux) {
    cleFlux = crypto.randomBytes(20).toString("hex");
    await prisma.parametre.create({ data: { cle: "calendrier_flux_cle", valeur: cleFlux } });
  }
  const urlFlux = `${process.env.APP_URL || "http://localhost:3000"}/api/calendrier/flux?cle=${cleFlux}`;

  const tachesInternesBrutes = await prisma.tacheInterne.findMany({ orderBy: { creeLe: "asc" } });
  // Heures et coût de chaque tâche interne ce mois-ci (heures × coût horaire
  // du garage) — reflète les poinçons ajustés dans Productivité par employés
  const [anMois, moisMois] = dateAujourdhuiQuebec().split("-").map(Number);
  const limitesMoisCourant = limitesMoisQuebec(anMois, moisMois);
  const entreesInternesMois = await prisma.entreeTempsInterne.findMany({
    where: { fin: { not: null }, debut: { gte: limitesMoisCourant.debut, lte: limitesMoisCourant.fin } },
    select: { tacheInterneId: true, debut: true, fin: true },
  });
  const heuresParTache = new Map();
  for (const e of entreesInternesMois) {
    heuresParTache.set(e.tacheInterneId, (heuresParTache.get(e.tacheInterneId) || 0) + (e.fin - e.debut) / 3600000);
  }
  const coutHoraireGarage = Number(dict.cout_horaire_mecanicien || 95);
  const tachesInternes = tachesInternesBrutes.map((t) => {
    const heuresMois = heuresParTache.get(t.id) || 0;
    return { ...t, heuresMois, coutMois: heuresMois * coutHoraireGarage };
  });
  const reglagesDisponibilites = await chargerReglagesDisponibilites();

  // Coût réel selon nos résultats : dépenses du mois précédent (au dernier
  // jour de ce mois), et combien de chaque jour de semaine ce mois-là
  // comptait — le client en tire les heures disponibles selon l'horaire.
  const [anCourant, moisCourant] = dateAujourdhuiQuebec().split("-").map(Number);
  const anPrecedent = moisCourant === 1 ? anCourant - 1 : anCourant;
  const moisPrecedent = moisCourant === 1 ? 12 : moisCourant - 1;
  const limitesMoisPrecedent = limitesMoisQuebec(anPrecedent, moisPrecedent);
  const { depenses: depensesMoisPrecedent } = await calculerResumeRevenusDepenses(limitesMoisPrecedent);
  const joursMoisPrecedent = { lun: 0, mar: 0, mer: 0, jeu: 0, ven: 0, sam: 0, dim: 0 };
  for (const j of joursCalendairesQuebec(limitesMoisPrecedent.debut, limitesMoisPrecedent.fin)) joursMoisPrecedent[j.jour] += 1;
  const libelleMoisPrecedent = new Date(Date.UTC(anPrecedent, moisPrecedent - 1, 15))
    .toLocaleDateString("fr-CA", { month: "long", year: "numeric", timeZone: "UTC" });

  // Grilles d'inspection (module Inspection numérique) : résumé et lien vers l'éditeur
  const grillesInspection = (await inspectionActive())
    ? (await lireGrilles()).map((g) => ({ cle: g.cle, titre: g.titre, active: g.active, nbPoints: nbPointsGrille(g) }))
    : null;

  // Paiement en ligne (module) : réglages et derniers paiements, avec ce qu'ils paient
  let paiementEnLigne = null;
  if (await paiementEnLigneActif()) {
    const recents = await prisma.paiementEnLigne.findMany({ orderBy: { creeLe: "desc" }, take: 15 });
    const [factures, soumissions, bons] = await Promise.all([
      prisma.facture.findMany({ where: { id: { in: recents.map((p) => p.factureId).filter(Boolean) } }, select: { id: true, numero: true } }),
      prisma.soumission.findMany({ where: { id: { in: recents.map((p) => p.soumissionId).filter(Boolean) } }, select: { id: true, numero: true } }),
      prisma.bonTravail.findMany({ where: { id: { in: recents.map((p) => p.bonId).filter(Boolean) } }, select: { id: true, numero: true } }),
    ]);
    const numero = (liste, id) => liste.find((x) => x.id === id)?.numero || "?";
    paiementEnLigne = {
      modeTest: modeTestStripe(),
      adresseAvis: `${(process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "")}/api/stripe/webhook`,
      pourcentInitial: await lirePourcentDepot(),
      paiements: recents.map((p) => ({
        ...p,
        libelle: p.type === "FACTURE" ? `Facture ${numero(factures, p.factureId)}`
          : p.type === "DEPOT_SOUMISSION" ? `Dépôt — soumission ${numero(soumissions, p.soumissionId)}`
          : `Dépôt — bon ${numero(bons, p.bonId)}`,
      })),
    };
  }

  // Textos automatiques (module) : réglages, compte du mois et derniers textos
  let textos = null;
  if (await textosActifs()) {
    const { debut, fin } = limitesMoisQuebec(anCourant, moisCourant);
    const [recents, duMois, nbRefus, reglages] = await Promise.all([
      prisma.texto.findMany({ orderBy: { creeLe: "desc" }, take: 15 }),
      prisma.texto.findMany({ where: { creeLe: { gte: debut, lte: fin } }, select: { direction: true, statut: true, corps: true } }),
      prisma.refusTextos.count(),
      lireReglagesTextos(),
    ]);
    const clients = await prisma.client.findMany({ where: { id: { in: [...new Set(recents.map((t) => t.clientId).filter(Boolean))] } }, select: { id: true, nom: true } });
    const factures = duMois.filter((t) => t.statut !== "ECHEC");
    textos = {
      numeroEnvoi: numeroEnvoi(),
      adresseEntrant: `${(process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "")}/api/twilio/entrant`,
      reglagesInit: reglages,
      journal: recents.map((t) => ({ ...t, clientNom: clients.find((c) => c.id === t.clientId)?.nom || null })),
      mois: {
        envoyes: factures.filter((t) => t.direction === "SORTANT").length,
        recus: duMois.filter((t) => t.direction === "ENTRANT").length,
        echecs: duMois.filter((t) => t.statut === "ECHEC").length,
        segments: factures.reduce((n, t) => n + segmentsTexto(t.corps), 0),
      },
      nbRefus,
    };
  }

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ParametresClient
        tauxHoraireInit={dict.taux_horaire_client || "195"}
        coutHoraireInit={dict.cout_horaire_mecanicien || "95"}
        employesFacturablesInit={dict.employes_facturables || ""}
        depensesMoisPrecedent={depensesMoisPrecedent}
        joursMoisPrecedent={joursMoisPrecedent}
        libelleMoisPrecedent={libelleMoisPrecedent}
        horaireInit={{
          lun: dict.heures_lun ?? "8",
          mar: dict.heures_mar ?? "8",
          mer: dict.heures_mer ?? "8",
          jeu: dict.heures_jeu ?? "8",
          ven: dict.heures_ven ?? "5",
          sam: dict.heures_sam ?? "0",
          dim: dict.heures_dim ?? "0",
        }}
        heuresOuvertureInit={reglagesDisponibilites.heures}
        intervalleReservationInit={String(reglagesDisponibilites.intervalleMinutes)}
        capaciteReservationInit={String(reglagesDisponibilites.capacite)}
        tpsNumeroInit={dict.tps_numero || ""}
        tpsTauxInit={dict.tps_taux || "5"}
        tvqNumeroInit={dict.tvq_numero || ""}
        tvqTauxInit={dict.tvq_taux || "9.975"}
        quickbooksConnecte={!!dict.qb_access_token}
        urlFluxCalendrier={urlFlux}
      />
      <TachesInternesSection tachesInitiales={tachesInternes} />
      {grillesInspection && <GrillesInspectionSection grilles={grillesInspection} personnalisees={!!dict[CLE_GRILLES]} />}
      {paiementEnLigne && <PaiementEnLigneSection {...paiementEnLigne} />}
      {textos && <TextosSection {...textos} />}
      <SitesPiecesSection sitesInitiaux={lireSites(dict[CLE_SITES_PIECES])} />
      {CLIENT.partstech && <PartsTechSection configInitiale={await lireConfigPartsTech()} />}
      <AProposSection />
    </div>
  );
}
