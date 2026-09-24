import { obtenirSession, estGerantOuDev, ROLES_VALIDES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import { chargerHoraireOuverture, heuresPrevuesJoursPoinconnes } from "@/lib/paie";
import EnTete from "../../../components/EnTete";
import RentabiliteClient from "./RentabiliteClient";

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}

export default async function RapportRentabilite(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) redirect("/gerant");

  const aujourdhui = dateAujourdhuiQuebec();
  const [an, mois] = aujourdhui.split("-");
  const debutStr = searchParams?.debut || `${an}-${mois}-01`;
  const finStr = searchParams?.fin || aujourdhui;
  const debut = new Date(`${debutStr}T00:00:00`);
  const fin = new Date(`${finStr}T23:59:59`);

  const [employes, entreesBon, entreesInternes, parametreCout, parametreTauxClient, horaire] = await Promise.all([
    prisma.user.findMany({ where: { actif: true, role: { in: ROLES_VALIDES } }, orderBy: { nom: "asc" } }),
    prisma.entreeTemps.findMany({
      where: { fin: { not: null }, debut: { gte: debut, lte: fin } },
      include: { probleme: { include: { bon: { include: { facture: true, client: true } } } } },
    }),
    prisma.entreeTempsInterne.findMany({ where: { fin: { not: null }, debut: { gte: debut, lte: fin } } }),
    prisma.parametre.findUnique({ where: { cle: "cout_horaire_mecanicien" } }),
    prisma.parametre.findUnique({ where: { cle: "taux_horaire_client" } }),
    chargerHoraireOuverture(),
  ]);

  const tauxCoutGlobal = Number(parametreCout?.valeur || 95);
  const tauxClientDefaut = Number(parametreTauxClient?.valeur || 195);
  // Heures d'ouverture annuelles, pour ramener un salaire fixe à un taux
  // horaire au prorata (ex. 50 000 $ / (37h × 52) = 25,99 $/h).
  const heuresAnnuelles = Object.values(horaire).reduce((s, h) => s + (h || 0), 0) * 52;

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

    // Heures réelles : seulement les jours où le poinçon a été enclenché,
    // chacun compté pour l'horaire prévu CE jour-là (ex. lundi + mardi
    // poinçonnés = 16h). Même règle pour tous les rôles dans ce rapport,
    // contrairement à la paie (où la secrétaire, le gérant et le niveau 4
    // sont payés pour tout l'horaire d'ouverture).
    const heuresPayees = heuresPrevuesJoursPoinconnes([...siennesBon, ...siennesInternes], debut, fin, horaire);
    const tauxCout = e.typeRemuneration === "SALAIRE" && e.salaireAnnuel && heuresAnnuelles > 0
      ? e.salaireAnnuel / heuresAnnuelles
      : e.tauxHoraireEmploye || tauxCoutGlobal;
    const coutReel = heuresPayees * tauxCout;
    const marge = revenuGenere - coutReel;

    return {
      employe: e,
      heuresTotales,
      heuresPayees,
      heuresFacturables,
      heuresEstimees,
      heuresInternes,
      revenuGenere,
      coutReel,
      marge,
      tauxCout,
    };
  })
    // Seulement les employés qui ont démarré l'horodateur sur un bon et ont
    // donc des heures facturables sur la période — les autres (seulement du
    // temps interne, ou aucun poinçon) ne sont pas affichés.
    .filter((d) => d.heuresFacturables > 0);

  parEmploye.sort((a, b) => b.marge - a.marge);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <RentabiliteClient donnees={parEmploye} debutStr={debutStr} finStr={finStr} />
    </div>
  );
}
