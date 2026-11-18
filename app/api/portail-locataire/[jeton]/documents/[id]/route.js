import { prisma } from "@/lib/prisma";
import { locataireParJeton, bauxDuLocataire, filtreDocumentsLocataire, reponseFichier, erreur } from "@/lib/immobilier";

// Document ouvert depuis le portail : seulement s'il est permis à ce locataire
export async function GET(request, props) {
  const { jeton, id } = await props.params;
  const l = await locataireParJeton(jeton);
  if (!l) return erreur("Lien invalide.", 404);
  const doc = await prisma.documentImmo.findFirst({ where: { id, ...filtreDocumentsLocataire(l.id, await bauxDuLocataire(l.id)) } });
  if (!doc) return erreur("Document introuvable.", 404);
  return reponseFichier(doc, request);
}
