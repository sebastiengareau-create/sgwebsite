import { prisma } from "@/lib/prisma";
import { aAccesSection } from "@/lib/auth";
import { moduleComptabiliteActif } from "@/lib/comptabilite";
import { lireLienCompta, dernierResultatCompta, etatLienCompta } from "@/lib/immobilierCompta";
import EnTete from "../../components/EnTete";
import { exigerAccesImmo, simple } from "../acces";
import ComptabiliteClient from "./ComptabiliteClient";

export default async function ComptabiliteImmo() {
  const session = await exigerAccesImmo();
  const [reglages, dernier, etat, tresorerie, moduleCompta, acces] = await Promise.all([
    lireLienCompta(), dernierResultatCompta(), etatLienCompta(),
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
