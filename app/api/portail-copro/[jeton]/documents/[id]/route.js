import { prisma } from "@/lib/prisma";
import { coproprietaireParJeton, unitesDuCoproprietaire, filtreDocumentsVisibles, reponseFichier, erreur } from "@/lib/copropriete";

// Document ouvert depuis le portail : seulement s'il est permis à ce
// copropriétaire (tous, ou réservé à une de ses unités)
export async function GET(request, props) {
  const { jeton, id } = await props.params;
  const c = await coproprietaireParJeton(jeton);
  if (!c) return erreur("Lien invalide.", 404);
  const doc = await prisma.documentCopro.findFirst({ where: { id, ...filtreDocumentsVisibles(await unitesDuCoproprietaire(c.id)) } });
  if (!doc) return erreur("Document introuvable.", 404);
  return reponseFichier(doc, request);
}
