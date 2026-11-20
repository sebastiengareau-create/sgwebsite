import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { dateAujourdhuiQuebec, limitesJourQuebec, dateQuebecStr, jourSemaineQuebec, dateHeureQuebecVersUTC, FUSEAU } from "@/lib/temps";
import { chargerReglagesDisponibilites } from "@/lib/disponibilites";
import { estPoinconSuspect, JOURS_POINCONS_OUBLIES, productiviteActif } from "@/lib/productivite";
import { chargerHeuresJour } from "@/lib/heuresJour";
import EnTete from "../../components/EnTete";
import RapportsClient from "./RapportsClient";

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}

const CLES_JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"]; // aligné sur Date.getUTCDay() : 0=dim

export default async function RapportJournalier(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "jobs-temps-reel"))) redirect("/gerant");
  if (!(await productiviteActif())) redirect("/gerant");

  const dateStr = searchParams?.date || dateAujourdhuiQuebec();
  const { debut: debutJour, fin: finJour } = limitesJourQuebec(dateStr);
  const [an, mois, jour] = dateStr.split("-").map(Number);
  const jourSemaine = CLES_JOURS[new Date(Date.UTC(an, mois - 1, jour)).getUTCDay()];

  // Un gérant peut lui aussi poinçonner sur un bon (voir peutPoinconner dans
  // app/bons/[id]/page.js) — s'il n'était pas inclus ici, ses heures
  // facturées seraient bel et bien enregistrées mais absentes du rapport et
  // du revenu total de l'équipe.
  // Poinçons oubliés (lib/productivite.js) : tous les poinçons encore ouverts,
  // plus ceux fermés des derniers jours — peu importe la date affichée, pour
  // qu'ils soient corrigés avant de fausser la paie et les rapports. Un bon
  // facturé est figé : ses poinçons ne peuvent plus se corriger ici.
  const depuisPoinconsOublies = new Date(Date.now() - JOURS_POINCONS_OUBLIES * 86400000);
  const filtrePoinconsOublies = { OR: [{ fin: null }, { debut: { gte: depuisPoinconsOublies } }] };
  const [parametres, mecaniciens, entrees, entreesInternes, reglages, candidatsBon, candidatsInternes, heuresJour, tachesInternes] = await Promise.all([
    prisma.parametre.findMany(),
    prisma.user.findMany({ where: { role: { in: ["MECANICIEN", "GERANT"] } }, orderBy: { nom: "asc" } }),
    prisma.entreeTemps.findMany({
      where: { debut: { gte: debutJour, lte: finJour } },
      include: {
        employe: true,
        probleme: { include: { bon: { include: { client: true, problemes: { orderBy: { id: "asc" } } } } } },
      },
      orderBy: { debut: "asc" },
    }),
    prisma.entreeTempsInterne.findMany({
      where: { debut: { gte: debutJour, lte: finJour } },
      include: { employe: true, tacheInterne: true },
      orderBy: { debut: "asc" },
    }),
    chargerReglagesDisponibilites(),
    prisma.entreeTemps.findMany({
      where: { ...filtrePoinconsOublies, probleme: { bon: { facture: { is: null } } } },
      include: { employe: { select: { nom: true } }, probleme: { select: { description: true, bon: { select: { id: true, numero: true } } } } },
      orderBy: { debut: "asc" },
    }),
    prisma.entreeTempsInterne.findMany({
      where: filtrePoinconsOublies,
      include: { employe: { select: { nom: true } }, tacheInterne: { select: { nom: true } } },
      orderBy: { debut: "asc" },
    }),
    chargerHeuresJour(dateStr, dateStr),
    // Pour les poinçons ajoutés à la main (tâches internes seulement)
    prisma.tacheInterne.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);

  const maintenant = new Date();
  // Heure de fin proposée pour corriger : la fermeture du jour où le poinçon a
  // commencé (si elle est après son début), sinon une heure après son début
  // (jour fermé, poinçon démarré après la fermeture) — format datetime-local
  // en heure du Québec.
  const heureLocale = (date) => new Intl.DateTimeFormat("en-GB", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  const finProposee = (debut) => {
    const jourStr = dateQuebecStr(debut);
    const horaire = reglages.heures[jourSemaineQuebec(debut)];
    if (horaire && dateHeureQuebecVersUTC(jourStr, horaire.fermeture) > new Date(debut)) return `${jourStr}T${horaire.fermeture}`;
    const uneHeureApres = new Date(Math.min(new Date(debut).getTime() + 3600000, maintenant.getTime()));
    return `${dateQuebecStr(uneHeureApres)}T${heureLocale(uneHeureApres)}`;
  };
  const poinconsOublies = [
    ...candidatsBon.filter((e) => estPoinconSuspect(e, maintenant)).map((e) => ({
      type: "bon", id: e.id, debut: e.debut, fin: e.fin, employe: e.employe.nom,
      libelle: `#${e.probleme.bon.numero} — ${e.probleme.description}`, bonId: e.probleme.bon.id, finProposee: finProposee(e.debut),
    })),
    ...candidatsInternes.filter((e) => estPoinconSuspect(e, maintenant)).map((e) => ({
      type: "interne", id: e.id, debut: e.debut, fin: e.fin, employe: e.employe.nom,
      libelle: `🛠️ ${e.tacheInterne.nom} (interne)`, bonId: null, finProposee: finProposee(e.debut),
    })),
  ].sort((a, b) => new Date(a.debut) - new Date(b.debut));

  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const heuresAttendues = Number(dict[`heures_${jourSemaine}`] ?? 8);
  const coutHoraire = Number(dict.cout_horaire_mecanicien || 95);
  const tauxHoraireClient = Number(dict.taux_horaire_client || 195);

  // Heures d'ouverture du jour (mêmes réglages que le calendrier), en heures
  // décimales pour l'encadré de la frise ; null si le commerce est fermé.
  const horaireJour = reglages.heures[jourSemaine];
  const versHeures = (str) => { const [h, m] = str.split(":").map(Number); return h + m / 60; };
  const heuresOuverture = horaireJour
    ? { debut: versHeures(horaireJour.ouverture), fin: versHeures(horaireJour.fermeture), libelle: `${horaireJour.ouverture}–${horaireJour.fermeture}` }
    : null;

  const parMecanicien = mecaniciens.map((m) => {
    const siennes = entrees.filter((e) => e.employeId === m.id);
    const totalHeures = siennes.reduce(
      (s, e) => s + (e.fin ? dureeHeures(e.debut, e.fin) : dureeHeures(e.debut, new Date().toISOString())),
      0
    );
    const siennesInternes = entreesInternes.filter((e) => e.employeId === m.id);
    const totalHeuresInternes = siennesInternes.reduce(
      (s, e) => s + (e.fin ? dureeHeures(e.debut, e.fin) : dureeHeures(e.debut, new Date().toISOString())),
      0
    );
    // Présent dès qu'il y a un poinçon, facturable OU interne — les heures
    // internes ne comptent jamais dans heuresPoinconnees (qui sert au calcul
    // du revenu), seulement dans la présence et le total d'heures travaillées
    // Heures réellement travaillées ce jour-là, si le gérant les a entrées
    // (sinon null : les heures prévues de l'horaire s'appliquent)
    const heuresReelles = heuresJour.get(`${m.id}|${dateStr}`) ?? null;
    return {
      employe: m,
      heuresReelles,
      entrees: siennes,
      entreesInternes: siennesInternes,
      heuresPoinconnees: totalHeures,
      heuresInternes: totalHeuresInternes,
    };
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <RapportsClient
        dateStr={dateStr}
        parMecanicien={parMecanicien}
        heuresAttendues={heuresAttendues}
        coutHoraire={coutHoraire}
        tauxHoraireClient={tauxHoraireClient}
        heuresOuverture={heuresOuverture}
        poinconsOublies={poinconsOublies}
        tachesInternes={tachesInternes}
      />
    </div>
  );
}
