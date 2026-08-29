import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import crypto from "crypto";
import EnTete from "../../components/EnTete";
import ParametresClient from "./ParametresClient";
import TachesInternesSection from "./TachesInternesSection";

export default async function Parametres() {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) redirect("/gerant");

  const parametres = await prisma.parametre.findMany();
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  let cleFlux = dict.calendrier_flux_cle;
  if (!cleFlux) {
    cleFlux = crypto.randomBytes(20).toString("hex");
    await prisma.parametre.create({ data: { cle: "calendrier_flux_cle", valeur: cleFlux } });
  }
  const urlFlux = `${process.env.APP_URL || "http://localhost:3000"}/api/calendrier/flux?cle=${cleFlux}`;

  const tachesInternes = await prisma.tacheInterne.findMany({ orderBy: { creeLe: "asc" } });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ParametresClient
        tauxHoraireInit={dict.taux_horaire_client || "195"}
        coutHoraireInit={dict.cout_horaire_mecanicien || "95"}
        horaireInit={{
          lun: dict.heures_lun ?? "8",
          mar: dict.heures_mar ?? "8",
          mer: dict.heures_mer ?? "8",
          jeu: dict.heures_jeu ?? "8",
          ven: dict.heures_ven ?? "5",
          sam: dict.heures_sam ?? "0",
          dim: dict.heures_dim ?? "0",
        }}
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
