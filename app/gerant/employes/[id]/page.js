import { obtenirSession, aAccesSection, nomAffichageRole, estGerantOuDev, estNiveauMaxOuDev, niveauRole, ROLES_VALIDES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimerSalaireImposableParDefaut } from "@/lib/paie";
import { redirect, notFound } from "next/navigation";
import EnTete from "../../../components/EnTete";
import EmployeDetailClient from "./EmployeDetailClient";

export default async function DetailEmploye({ params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "employes"))) redirect("/gerant");

  const [employe, paies, modulePaie, parametreTaux] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id } }),
    prisma.paie.findMany({ where: { employeId: params.id }, orderBy: { periodeFin: "desc" }, take: 10 }),
    prisma.parametre.findUnique({ where: { cle: "module_paie" } }),
    prisma.parametre.findUnique({ where: { cle: "cout_horaire_mecanicien" } }),
  ]);
  if (!employe) notFound();

  // Valeur de départ du champ "Salaire imposable" quand il n'a jamais été
  // rempli — le taux horaire effectif de l'employé (le sien, sinon le taux
  // global) × l'horaire d'ouverture du commerce (voir lib/paie.js).
  const tauxEffectif = employe.tauxHoraireEmploye || Number(parametreTaux?.valeur || 95);
  const salaireImposableParDefaut = await estimerSalaireImposableParDefaut(tauxEffectif);

  const [accumule, dejaVerse] = await Promise.all([
    prisma.paie.aggregate({ where: { employeId: params.id, statut: { not: "CORRIGEE" }, typePaie: "REGULIERE" }, _sum: { vacancesAccumulees: true } }),
    prisma.paie.aggregate({ where: { employeId: params.id, statut: { not: "CORRIGEE" }, typePaie: "VACANCES" }, _sum: { salaireBrut: true } }),
  ]);
  const soldeVacances = Math.max(0, (accumule._sum.vacancesAccumulees || 0) - (dejaVerse._sum.salaireBrut || 0));
  const nomsRoles = Object.fromEntries(await Promise.all(ROLES_VALIDES.map(async (r) => [r, await nomAffichageRole(r)])));
  // Même règle que la création : un employé (même un GERANT) ne peut ni
  // assigner un rôle au-dessus du sien, ni gérer (modifier, changer le rôle,
  // désactiver, supprimer) la fiche de quelqu'un dont le niveau actuel
  // dépasse déjà le sien — seul le niveau 4/développeur passe toujours.
  const rolesAssignables = estNiveauMaxOuDev(session) ? ROLES_VALIDES : ROLES_VALIDES.filter((r) => niveauRole(r) <= niveauRole(session.role));
  const peutGererEmploye = estNiveauMaxOuDev(session) || niveauRole(employe.role) <= niveauRole(session.role);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EmployeDetailClient
        employe={employe} paies={paies} estMoi={employe.id === session.id} paieActif={modulePaie?.valeur === "actif"}
        soldeVacances={soldeVacances} nomsRoles={nomsRoles} peutModifierTheme={estGerantOuDev(session)}
        rolesAssignables={rolesAssignables} peutGererEmploye={peutGererEmploye}
        salaireImposableParDefaut={salaireImposableParDefaut}
      />
    </div>
  );
}
