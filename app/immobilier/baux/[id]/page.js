import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import { obtenirInfosEntreprise } from "@/lib/config";
import { bailOfficielDe } from "@/lib/immobilier";
import { lireLocateur } from "@/lib/locateurImmo";
import { exigerAccesImmo, simple, DOC_SANS_DONNEES } from "../../acces";
import BailClient from "./BailClient";

export default async function FicheBail(props) {
  const { id } = await props.params;
  const session = await exigerAccesImmo();
  const [bail, locataires] = await Promise.all([
    prisma.bailImmo.findUnique({
      where: { id },
      include: {
        logement: { select: { id: true, numero: true, type: true, pieces: true, etage: true, adresseCivique: true, immeuble: { select: { id: true, nom: true, adresse: true, ville: true, codePostal: true, anneeConstruction: true } } } },
        locataires: { select: { id: true, nom: true, telephone: true, telephone2: true, courriel: true, adresse: true, appartement: true, ville: true, codePostal: true } },
        charges: { orderBy: { date: "asc" } },
        paiements: { orderBy: { date: "asc" } },
        documents: {
          select: {
            ...DOC_SANS_DONNEES,
            signatures: { select: { id: true, role: true, nom: true, courriel: true, jeton: true, statut: true, demandeLe: true, envoyeLe: true, relances: true, vuLe: true, reponduLe: true, signataireNom: true, reponseAvis: true, note: true }, orderBy: { ordre: "asc" } },
          },
          orderBy: [{ date: "desc" }, { creeLe: "desc" }],
        },
        envois: { orderBy: { date: "desc" }, take: 30 },
        etatsLieux: { select: { id: true, moment: true, date: true, statut: true, documentId: true, _count: { select: { photos: true } } }, orderBy: { date: "desc" } },
      },
    }),
    prisma.locataireImmo.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  if (!bail) notFound();
  // Bail qui suit ou précède celui-ci dans le même logement ; bail officiel
  // du TAL (lib/bailTal.js) et infos du locateur pour la fiche à recopier
  const [suivant, precedent, officiel, entreprise] = await Promise.all([
    prisma.bailImmo.findFirst({ where: { logementId: bail.logementId, dateDebut: { gt: bail.dateDebut } }, orderBy: { dateDebut: "asc" }, select: { id: true, dateDebut: true, loyer: true } }),
    prisma.bailImmo.findFirst({ where: { logementId: bail.logementId, dateDebut: { lt: bail.dateDebut } }, orderBy: { dateDebut: "desc" }, select: { id: true, dateDebut: true, loyer: true } }),
    bailOfficielDe(bail),
    obtenirInfosEntreprise(),
  ]);
  const locateur = {
    ...(({ nomEntreprise, adresseLigne1, adresseLigne2, ville, codePostal, telephone, courriel, personneResponsable }) => ({ nomEntreprise, adresseLigne1, adresseLigne2, ville, codePostal, telephone, courriel, personneResponsable }))(entreprise),
    fiche: await lireLocateur(entreprise), // Immobilier → Locateur (lib/locateurImmo.js)
  };
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <BailClient {...simple({ bail, locataires, suivant, precedent, officiel, locateur })} courriel={Boolean(process.env.RESEND_API_KEY)} />
    </div>
  );
}
