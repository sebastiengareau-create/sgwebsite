import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerModelesDocuments } from "@/lib/documents";
import { destinatairesPermis } from "@/lib/documentsServeur";
import EnTete from "../../components/EnTete";
import DocumentsClient from "./DocumentsClient";

// ?pour=<id>&destinataire=EMPLOYE|CLIENT : venu de la fiche d'un employé ou
// d'un client — seuls ses modèles sont offerts, et « Rédiger » le choisit déjà
export default async function Documents(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!session) redirect("/login");
  let permis = await destinatairesPermis(session);
  if (permis.length === 0) redirect("/gerant");

  let pour = null;
  if (typeof searchParams?.pour === "string" && permis.includes(searchParams.destinataire)) {
    const fiche = searchParams.destinataire === "EMPLOYE"
      ? await prisma.user.findUnique({ where: { id: searchParams.pour }, select: { id: true, nom: true } })
      : await prisma.client.findUnique({ where: { id: searchParams.pour }, select: { id: true, nom: true } });
    if (fiche) {
      pour = fiche;
      permis = [searchParams.destinataire];
    }
  }

  await assurerModelesDocuments(prisma);
  const modeles = await prisma.modeleDocument.findMany({ where: { destinataire: { in: permis } }, orderBy: { nom: "asc" } });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <DocumentsClient modeles={modeles} destinataires={permis} pour={pour} />
    </div>
  );
}
