import { notFound, redirect } from "next/navigation";
import { obtenirSession, nomAffichageRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import { valeursCommunes, valeursEmploye, valeursClient } from "@/lib/documents";
import { peutGererDestinataire } from "@/lib/documentsServeur";
import RedigerClient from "./RedigerClient";

// Rédiger une lettre : ?modele=<id>&pour=<id de l'employé ou du client>
export default async function RedigerDocument(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!session) redirect("/login");

  const modele = typeof searchParams?.modele === "string"
    ? await prisma.modeleDocument.findUnique({ where: { id: searchParams.modele } })
    : null;
  if (!modele) notFound();
  if (!(await peutGererDestinataire(session, modele.destinataire))) redirect("/gerant/documents");
  const pourId = typeof searchParams?.pour === "string" ? searchParams.pour : null;
  const pourEmploye = modele.destinataire === "EMPLOYE";

  const [entreprise, personnes, fiche, parametreTaux] = await Promise.all([
    obtenirInfosEntreprise(),
    pourEmploye
      ? prisma.user.findMany({ select: { id: true, nom: true, actif: true }, orderBy: [{ actif: "desc" }, { nom: "asc" }] })
      : prisma.client.findMany({ select: { id: true, nom: true, telephone: true }, orderBy: { nom: "asc" } }),
    !pourId ? null : pourEmploye
      ? prisma.user.findUnique({ where: { id: pourId }, omit: { motDePasse: true, pin: true } })
      : prisma.client.findUnique({ where: { id: pourId } }),
    pourEmploye ? prisma.parametre.findUnique({ where: { cle: "cout_horaire_mecanicien" } }) : null,
  ]);

  let valeurs = null;
  if (fiche) {
    const propres = pourEmploye
      ? valeursEmploye(fiche, { tauxGlobal: Number(parametreTaux?.valeur) || null, nomRole: await nomAffichageRole(fiche.role) })
      : valeursClient(fiche);
    valeurs = { ...valeursCommunes({ entreprise, signataire: session.nom, aujourdhui: dateAujourdhuiQuebec() }), ...propres };
  }

  return (
    <RedigerClient
      key={`${modele.id}-${fiche?.id || ""}`}
      modele={modele} personnes={personnes} choisi={fiche ? { id: fiche.id, nom: fiche.nom } : null}
      valeurs={valeurs} entreprise={entreprise}
    />
  );
}
