import { prisma } from "@/lib/prisma";
import { aAccesSection } from "@/lib/auth";
import { moduleComptabiliteActif } from "@/lib/comptabilite";
import { lireLienComptaCopro, dernierResultatComptaCopro, etatLienComptaCopro } from "@/lib/coproprieteCompta";
import EnTete from "../../components/EnTete";
import { exigerAccesCopro, simple } from "../acces";
import ComptabiliteClient from "./ComptabiliteClient";

export default async function ComptabiliteCopro() {
  const session = await exigerAccesCopro();
  const [reglages, dernier, etat, tresorerie, moduleCompta, acces] = await Promise.all([
    lireLienComptaCopro(), dernierResultatComptaCopro(), etatLienComptaCopro(),
    prisma.compteTresorerie.findMany({ where: { actif: true }, select: { id: true, nom: true, compte: { select: { numero: true } } }, orderBy: [{ ordre: "asc" }, { nom: "asc" }] }),
    moduleComptabiliteActif(), aAccesSection(session, "comptabilite"),
  ]);
  const numeros = Object.values(reglages.comptes || {});
  const comptes = numeros.length ? await prisma.compte.findMany({ where: { numero: { in: numeros } }, select: { numero: true, nom: true }, orderBy: { numero: "asc" } }) : [];
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ComptabiliteClient {...simple({ reglages, dernier, etat, tresorerie, moduleCompta, acces, comptes })} />
    </div>
  );
}
