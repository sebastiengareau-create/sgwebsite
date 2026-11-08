import { prisma } from "@/lib/prisma";
import { routesElement } from "@/lib/coproprieteRoutes";
import { sessionCopro, refus, erreur, reponseFichier } from "@/lib/copropriete";

export async function GET(request, props) {
  if (!(await sessionCopro())) return refus();
  const { id } = await props.params;
  const doc = await prisma.documentCopro.findUnique({ where: { id } });
  if (!doc) return erreur("Document introuvable.", 404);
  return reponseFichier(doc, request);
}

export const { PATCH, DELETE } = routesElement("documentCopro", "document");
