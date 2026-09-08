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

  const [employes, entreesBon, entreesInternes, parametreCout, parametreTauxClient] = await Promise.all([
    prisma.user.findMany({ where: { actif: true, role: { in: ["MECANICIEN", "SECRETAIRE", "GERANT"] } }, orderBy: { nom: "asc" } }),
    prisma.entreeTemps.findMany({
      where: { fin: { not: null }, debut: { gte: debut, lte: fin } },
      include: { probleme: { include: { bon: { include: { facture: true, client: true } } } } },
    }),
    prisma.entreeTempsInterne.findMany({ where: { fin: { not: null }, debut: { gte: debut, lte: fin } } }),
    prisma.parametre.findUnique({ where: { cle: "cout_horaire_mecanicien" } }),
    prisma.parametre.findUnique({ where: { cle: "taux_horaire_client" } }),
  ]);

  const tauxCoutGlobal = Number(parametreCout?.valeur || 95);
  const tauxClientDefaut = Number(parametreTauxClient?.valeur || 195);

  const parEmploye = employes.map((e) => {
    const siennesBon = entreesBon.filter((t) => t.employeId === e.id);
    const siennesInternes = entreesInternes.filter((t) => t.employeId === e.id);

    const heuresBon = siennesBon.reduce((s, t) => s + dureeHeures(t.debut, t.fin), 0);
    const heuresInternes = siennesInternes.reduce((s, t) => s + dureeHeures(t.debut, t.fin), 0);
    const heuresTotales = heuresBon + heuresInternes;

    // Le revenu compte toutes les heures liées à un bon : au taux RÉEL de
    // la facture quand le bon est déjà facturé, sinon au taux horaire
    // client par défaut — pour donner une marge estimée presque en temps
    // réel plutôt qu'un trou dans les chiffres tant que la facture n'est
    // pas encore émise (le montant se corrige tout seul une fois facturé).
    const siennesFacturees = siennesBon.filter((t) => t.probleme.bon.facture);
    const siennesNonFacturees = siennesBon.filter((t) => !t.probleme.bon.facture);
    const heuresEstimees = siennesNonFacturees.reduce((s, t) => s + dureeHeures(t.debut, t.fin), 0);
    const heuresFacturables = heuresBon;
    const revenuGenere =
      siennesFacturees.reduce((s, t) => s + dureeHeures(t.debut, t.fin) * t.probleme.bon.facture.tauxHoraireUtilise, 0) +
      heuresEstimees * tauxClientDefaut;

    const tauxCout = e.tauxHoraireEmploye || tauxCoutGlobal;
    const coutReel = heuresTotales * tauxCout;
    const marge = revenuGenere - coutReel;

    return {
      employe: e,
      heuresTotales,
      heuresFacturables,
      heuresEstimees,
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
