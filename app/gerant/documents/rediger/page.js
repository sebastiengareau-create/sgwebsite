import { notFound, redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { peutGererDestinataire, chargerFiche, preparerValeurs } from "@/lib/documentsServeur";
import { courrielConfigure } from "@/lib/courrielDocuments";
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

  const [personnes, fiche, { entreprise, pour }] = await Promise.all([
    modele.destinataire === "EMPLOYE"
      ? prisma.user.findMany({ select: { id: true, nom: true, actif: true }, orderBy: [{ actif: "desc" }, { nom: "asc" }] })
      : prisma.client.findMany({ select: { id: true, nom: true, telephone: true }, orderBy: { nom: "asc" } }),
    pourId ? chargerFiche(modele.destinataire, pourId) : null,
    preparerValeurs(session, modele.destinataire),
  ]);

  return (
    <RedigerClient
      key={`${modele.id}-${fiche?.id || ""}`}
      modele={modele} personnes={personnes}
      choisi={fiche ? { id: fiche.id, nom: fiche.nom, courriel: fiche.courriel || "", desabonne: !!fiche.promotionsRefuseesLe } : null}
      valeurs={fiche ? await pour(fiche) : null} entreprise={entreprise} courrielConfigure={courrielConfigure()}
    />
  );
}
