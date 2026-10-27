import { notFound, redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { peutGererDestinataire, preparerValeurs } from "@/lib/documentsServeur";
import { courrielConfigure } from "@/lib/courrielDocuments";
import EnTete from "../../../components/EnTete";
import EnvoiGroupeClient from "./EnvoiGroupeClient";

// Envoi groupé d'un modèle de lettre aux clients par courriel : ?modele=<id>
export default async function EnvoiGroupe(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererDestinataire(session, "CLIENT"))) redirect("/gerant/documents");

  const modele = typeof searchParams?.modele === "string"
    ? await prisma.modeleDocument.findUnique({ where: { id: searchParams.modele } })
    : null;
  if (!modele || modele.destinataire !== "CLIENT") notFound();

  const [clients, { pour }] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, numero: true, nom: true, courriel: true, telephone: true, adresse: true, ville: true, province: true, codePostal: true, promotionsRefuseesLe: true },
      orderBy: { nom: "asc" },
    }),
    preparerValeurs(session, "CLIENT"),
  ]);
  // Champs communs (entreprise, date, signataire) : les mêmes pour tous —
  // l'aperçu ajoute ceux du client dans le navigateur
  const communes = await pour({ nom: "" });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EnvoiGroupeClient modele={modele} clients={clients} communes={communes} courrielConfigure={courrielConfigure()} />
    </div>
  );
}
