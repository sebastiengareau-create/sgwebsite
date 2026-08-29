import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import EnTete from "../../../components/EnTete";
import RentabiliteClient from "./RentabiliteClient";

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}

export default async function RapportRentabilite({ searchParams }) {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) redirect("/gerant");

  const aujourdhui = dateAujourdhuiQuebec();
  const [an, mois] = aujourdhui.split("-");
  const debutStr = searchParams?.debut || `${an}-${mois}-01`;
  const finStr = searchParams?.fin || aujourdhui;
  const debut = new Date(`${debutStr}T00:00:00`);
  const fin = new Date(`${finStr}T23:59:59`);

  const [employes, entreesBon, entreesInternes, parametreTaux] = await Promise.all([
    prisma.user.findMany({ where: { actif: true, role: { in: ["MECANICIEN", "SECRETAIRE", "GERANT"] } }, orderBy: { nom: "asc" } }),
    prisma.entreeTemps.findMany({
      where: { fin: { not: null }, debut: { gte: debut, lte: fin } },
      include: { probleme: { include: { bon: { include: { facture: true, client: true } } } } },
    }),
    prisma.entreeTempsInterne.findMany({ where: { fin: { not: null }, debut: { gte: debut, lte: fin } } }),
    prisma.parametre.findUnique({ where: { cle: "cout_horaire_mecanicien" } }),
  ]);

  const tauxCoutGlobal = Number(parametreTaux?.valeur || 95);

  const parEmploye = employes.map((e) => {
    const siennesBon = entreesBon.filter((t) => t.employeId === e.id);
    const siennesInternes = entreesInternes.filter((t) => t.employeId === e.id);

    const heuresBon = siennesBon.reduce((s, t) => s + dureeHeures(t.debut, t.fin), 0);
    const heuresInternes = siennesInternes.reduce((s, t) => s + dureeHeures(t.debut, t.fin), 0);
    const heuresTotales = heuresBon + heuresInternes;

    // Le revenu se calcule seulement sur les heures d'un bon RÉELLEMENT
    // FACTURÉ, au taux qui a vraiment été chargé sur cette facture — pas
    // une simple estimation, un vrai montant réparti entre les mécaniciens
    // qui ont partagé le bon
    const siennesFacturees = siennesBon.filter((t) => t.probleme.bon.facture);
    const heuresFacturables = siennesFacturees.reduce((s, t) => s + dureeHeures(t.debut, t.fin), 0);
    const revenuGenere = siennesFacturees.reduce(
      (s, t) => s + dureeHeures(t.debut, t.fin) * t.probleme.bon.facture.tauxHoraireUtilise,
      0
    );

    const tauxCout = e.tauxHoraireEmploye || tauxCoutGlobal;
    const coutReel = heuresTotales * tauxCout;
    const marge = revenuGenere - coutReel;

    return {
      employe: e,
      heuresTotales,
      heuresFacturables,
      heuresInternes,
      revenuGenere,
      coutReel,
      marge,
      tauxCout,
    };
  }).filter((d) => d.heuresTotales > 0);

  parEmploye.sort((a, b) => b.marge - a.marge);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <RentabiliteClient donnees={parEmploye} debutStr={debutStr} finStr={finStr} />
    </div>
  );
}
