import { prisma } from "@/lib/prisma";
import { routesElement } from "@/lib/immobilierRoutes";
import { sessionImmo, refus, erreur, reponseFichier } from "@/lib/immobilier";
import { versionDocument, verrouSignature } from "@/lib/signatureImmo";

export async function GET(request, props) {
  if (!(await sessionImmo())) return refus();
  const { id } = await props.params;
  const doc = await prisma.documentImmo.findUnique({ where: { id } });
  if (!doc) return erreur("Document introuvable.", 404);
  return reponseFichier(versionDocument(doc, request), request);
}

// Un document envoyé à la signature reste au dossier (preuve de la signature)
export const { PATCH, DELETE } = routesElement("documentImmo", "document", {
  avantSuppression: (d) => verrouSignature({ id: d.id }),
});
