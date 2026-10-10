import { obtenirSession, aAccesSection, nomAffichageRole, estGerantOuDev, estNiveauMaxOuDev, niveauRole, ROLES_VALIDES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { dateAujourdhuiQuebec, limitesJourQuebec, jourSemaineQuebec } from "@/lib/temps";
import EnTete from "../../../components/EnTete";
import EmployeDetailClient from "./EmployeDetailClient";
import { voisinsFiche } from "@/lib/navigationFiches";
import NavigationFiches from "../../../components/NavigationFiches";

export default async function DetailEmploye(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "employes"))) redirect("/gerant");

  const [employeComplet, paies, modulePaie] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id }, omit: { pin: false } }),
    prisma.paie.findMany({ where: { employeId: params.id }, orderBy: { periodeFin: "desc" }, take: 10 }),
    prisma.parametre.findUnique({ where: { cle: "module_paie" } }),
  ]);
  if (!employeComplet) notFound();
  // Jamais envoyer au navigateur le mot de passe (même haché) ni le NIP —
  // seulement si un NIP est défini.
  const { motDePasse, pin, ...employeSansSecrets } = employeComplet;
  const employe = { ...employeSansSecrets, pin: !!pin };

  const [accumule, dejaVerse] = await Promise.all([
    prisma.paie.aggregate({ where: { employeId: params.id, statut: { not: "CORRIGEE" }, typePaie: "REGULIERE" }, _sum: { vacancesAccumulees: true } }),
    prisma.paie.aggregate({ where: { employeId: params.id, statut: { not: "CORRIGEE" }, typePaie: "VACANCES" }, _sum: { salaireBrut: true } }),
  ]);
  // Heures poinçonnées (bons + tâches internes ; un poinçon encore actif
  // compte jusqu'à maintenant) : cette semaine (depuis lundi) et depuis la
  // fin de la dernière paie.
  const maintenant = new Date();
  const indexJour = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].indexOf(jourSemaineQuebec(maintenant));
  const lundi = new Date(`${dateAujourdhuiQuebec()}T12:00:00Z`);
  lundi.setUTCDate(lundi.getUTCDate() - indexJour);
  const debutSemaine = limitesJourQuebec(lundi.toISOString().slice(0, 10)).debut;
  const dernierePaie = paies.find((p) => p.statut !== "CORRIGEE" && p.typePaie !== "VACANCES");
  const debutPeriode = dernierePaie ? new Date(dernierePaie.periodeFin.getTime() + 1) : null;
  const debutRequete = debutPeriode && debutPeriode < debutSemaine ? debutPeriode : debutSemaine;
  const [entrees, entreesInternes] = await Promise.all([
    prisma.entreeTemps.findMany({ where: { employeId: params.id, OR: [{ fin: null }, { fin: { gte: debutRequete } }] }, select: { debut: true, fin: true } }),
    prisma.entreeTempsInterne.findMany({ where: { employeId: params.id, OR: [{ fin: null }, { fin: { gte: debutRequete } }] }, select: { debut: true, fin: true } }),
  ]);
  function heuresDepuis(depuis) {
    return [...entrees, ...entreesInternes].reduce((s, e) => {
      const debut = Math.max(e.debut.getTime(), depuis.getTime());
      const fin = (e.fin || maintenant).getTime();
      return fin > debut ? s + (fin - debut) / 3600000 : s;
    }, 0);
  }
  const heures = {
    semaine: heuresDepuis(debutSemaine),
    depuisDernierePaie: debutPeriode ? heuresDepuis(debutPeriode) : null,
    dernierePaieFin: dernierePaie?.periodeFin || null,
    poinconActif: [...entrees, ...entreesInternes].some((e) => !e.fin),
  };

  const soldeVacances = Math.max(0, (accumule._sum.vacancesAccumulees || 0) - (dejaVerse._sum.salaireBrut || 0));
  const nomsRoles = Object.fromEntries(await Promise.all(ROLES_VALIDES.map(async (r) => [r, await nomAffichageRole(r)])));
  // Même règle que la création : un employé (même un GERANT) ne peut ni
  // assigner un rôle au-dessus du sien, ni gérer (modifier, changer le rôle,
  // désactiver, supprimer) la fiche de quelqu'un dont le niveau actuel
  // dépasse déjà le sien — seul le niveau 4/développeur passe toujours.
  const rolesAssignables = estNiveauMaxOuDev(session) ? ROLES_VALIDES : ROLES_VALIDES.filter((r) => niveauRole(r) <= niveauRole(session.role));
  // Ordre par défaut de la liste : actifs puis inactifs, par nom
  const ordre = await prisma.user.findMany({ where: employe.actif ? { actif: true } : undefined, select: { id: true }, orderBy: [{ actif: "desc" }, { nom: "asc" }] });
  const peutGererEmploye = estNiveauMaxOuDev(session) || niveauRole(employe.role) <= niveauRole(session.role);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EmployeDetailClient
        employe={employe} paies={paies} estMoi={employe.id === session.id} paieActif={modulePaie?.valeur === "actif"}
        soldeVacances={soldeVacances} heures={heures} nomsRoles={nomsRoles} peutModifierTheme={estGerantOuDev(session)}
        rolesAssignables={rolesAssignables} peutGererEmploye={peutGererEmploye}
      />
      <NavigationFiches cle="employes" idCourant={employe.id} base="/gerant/employes" voisinsParDefaut={voisinsFiche(ordre.map((e) => e.id), employe.id)} />
    </div>
  );
}
