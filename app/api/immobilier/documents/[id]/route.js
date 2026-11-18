import { prisma } from "@/lib/prisma";
import { routesElement } from "@/lib/immobilierRoutes";
import { sessionImmo, refus, erreur, reponseFichier } from "@/lib/immobilier";

export async function GET(request, props) {
  if (!(await sessionImmo())) return refus();
  const { id } = await props.params;
  const doc = await prisma.documentImmo.findUnique({ where: { id } });
  if (!doc) return erreur("Document introuvable.", 404);
  return reponseFichier(doc, request);
}

export const { PATCH, DELETE } = routesElement("documentImmo", "document");
