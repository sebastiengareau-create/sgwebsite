import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable } from "@/lib/comptabilite";
import { dateAujourdhuiQuebec, dateQuebecStr } from "@/lib/temps";
import EnTete from "../../components/EnTete";
import PlanComptableClient from "./PlanComptableClient";

const NORMAL_DEBIT = ["ACTIF", "DEPENSE"]; // ces types augmentent au débit
const LABELS_TYPE = { ACTIF: "Actif", PASSIF: "Passif", CAPITAUX_PROPRES: "Capitaux propres", REVENU: "Revenus", DEPENSE: "Dépenses" };
const NOMS_MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juill.", "août", "sept.", "oct.", "nov.", "déc."];

export default async function Comptabilite() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerPlanComptable(); // crée le plan standard au besoin, sans dupliquer

  const comptes = await prisma.compte.findMany({
    where: { actif: true },
    include: { lignes: true },
    orderBy: { numero: "asc" },
  });

  const comptesAvecSolde = comptes.map((c) => {
    const totalDebit = c.lignes.reduce((s, l) => s + l.debit, 0);
    const totalCredit = c.lignes.reduce((s, l) => s + l.credit, 0);
    const solde = NORMAL_DEBIT.includes(c.type) ? totalDebit - totalCredit : totalCredit - totalDebit;
    return { id: c.id, numero: c.numero, nom: c.nom, type: c.type, solde, nbEcritures: c.lignes.length, typeCharge: c.typeCharge };
  });

  // Renommer un poste (nom seulement, jamais le numéro) est réservé au
  // développeur — même règle que dans app/api/comptabilite/comptes/[id]/route.js
  let estDeveloppeur = session.role === "DEVELOPPEUR";
  if (!estDeveloppeur) {
    const moi = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
    estDeveloppeur = moi?.estSuperAdmin || false;
  }

  const [annee, mois, jour] = dateAujourdhuiQuebec().split("-");
  const dateLabel = `${parseInt(jour, 10)} ${NOMS_MOIS_COURTS[parseInt(mois, 10) - 1]} ${annee}`;

  // Trésorerie : solde aux livres des comptes bancaires + date de la
  // dernière conciliation — affichage seulement, aucune donnée modifiée.
  const tresorerie = await prisma.compteTresorerie.findMany({
    where: { actif: true, categorie: "BANQUE" },
    select: { compteId: true },
  });
  const idsBanque = new Set(tresorerie.map((t) => t.compteId));
  const soldeBancaire = comptesAvecSolde.filter((c) => idsBanque.has(c.id)).reduce((s, c) => s + c.solde, 0);
  const derniereConciliation = await prisma.rapprochementBancaire.findFirst({
    orderBy: { dateRapprochement: "desc" },
    select: { dateRapprochement: true },
  });
  const dateConciliation = derniereConciliation
    ? (() => {
        const [a, m, j] = dateQuebecStr(derniereConciliation.dateRapprochement).split("-");
        return `${parseInt(j, 10)} ${NOMS_MOIS_COURTS[parseInt(m, 10) - 1]} ${a}`;
      })()
    : null;

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <PlanComptableClient
        comptes={comptesAvecSolde} labelsType={LABELS_TYPE} estDeveloppeur={estDeveloppeur} dateLabel={dateLabel}
        tresorerie={idsBanque.size > 0 ? { solde: soldeBancaire, dateConciliation } : null}
      />
    </div>
  );
}
