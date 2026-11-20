import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accesFeuillesTemps, chargerFeuillesTemps, periodeParDefaut } from "@/lib/quarts";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import { chargerReglagesDisponibilites } from "@/lib/disponibilites";
import EnTete from "../../components/EnTete";
import FeuillesTempsClient from "./FeuillesTempsClient";

const FORMAT = /^\d{4}-\d{2}-\d{2}$/;

// Feuilles de temps (module Pointage de quart, lib/quarts.js) : présence par
// employé et par jour pour une période de paie, efficacité, anomalies,
// corrections, verrouillage et export vers la paie.
export default async function FeuillesTemps(props) {
  const session = await obtenirSession();
  if (!(await accesFeuillesTemps(session))) redirect("/gerant");

  const recherche = await props.searchParams;
  let periode = { debut: recherche?.debut, fin: recherche?.fin };
  if (!FORMAT.test(periode.debut || "") || !FORMAT.test(periode.fin || "") || periode.fin < periode.debut) {
    periode = await periodeParDefaut();
  }

  const [{ periode: enregistree, reglages, feuilles }, journal, employes, { heures: horaires }] = await Promise.all([
    chargerFeuillesTemps(periode.debut, periode.fin),
    prisma.correctionQuart.findMany({ where: { jour: { gte: periode.debut, lte: periode.fin } }, orderBy: { creeLe: "desc" }, take: 300 }),
    prisma.user.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    // Heures d'ouverture du commerce (Paramètres) : heures proposées pour un quart ajouté ou corrigé
    chargerReglagesDisponibilites(),
  ]);

  // Dates en texte : les composants du navigateur ne reçoivent que du JSON
  const donnees = JSON.parse(JSON.stringify({ feuilles, journal }));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <FeuillesTempsClient
        periode={periode}
        verrou={enregistree?.statut === "VERROUILLEE" ? { par: enregistree.approuvePar, le: enregistree.approuveLe?.toISOString() } : null}
        reglages={reglages}
        feuilles={donnees.feuilles}
        journal={donnees.journal}
        employes={employes}
        horaires={horaires}
        aujourdhui={dateAujourdhuiQuebec()}
      />
    </div>
  );
}
