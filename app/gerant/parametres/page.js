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

  const tachesInternes = await prisma.tacheInterne.findMany({ orderBy: { creeLe: "asc" } });
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
    </div>
  );
}
