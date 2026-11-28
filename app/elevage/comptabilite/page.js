import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { peutGererElevage } from "@/lib/elevage";
import { moduleComptabiliteActif } from "@/lib/comptabilite";
import { lireLienComptaElevage, dernierResultatComptaElevage, etatLienComptaElevage } from "@/lib/elevageCompta";
import EnTete from "../../components/EnTete";
import ComptabiliteClient from "./ComptabiliteClient";

// Élevage → Comptabilité (lib/elevageCompta.js)
export default async function ComptabiliteElevage() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererElevage(session))) redirect("/mecanicien");
  const [reglages, dernier, etat, tresorerie, moduleCompta, acces] = await Promise.all([
    lireLienComptaElevage(), dernierResultatComptaElevage(), etatLienComptaElevage(),
    prisma.compteTresorerie.findMany({ where: { actif: true }, select: { id: true, nom: true, compte: { select: { numero: true } } }, orderBy: [{ ordre: "asc" }, { nom: "asc" }] }),
    moduleComptabiliteActif(), aAccesSection(session, "comptabilite"),
  ]);
  const numeros = Object.values(reglages.comptes || {});
  const comptes = numeros.length ? await prisma.compte.findMany({ where: { numero: { in: numeros } }, select: { numero: true, nom: true }, orderBy: { numero: "asc" } }) : [];
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ComptabiliteClient {...JSON.parse(JSON.stringify({ reglages, dernier, etat, tresorerie, moduleCompta, acces, comptes }))} />
    </div>
  );
}
