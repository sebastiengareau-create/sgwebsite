import { prisma } from "@/lib/prisma";
import { coproprietaireParJeton, reponseFichier, erreur } from "@/lib/copropriete";

// Photo jointe à une des demandes de ce copropriétaire
export async function GET(request, props) {
  const { jeton, id } = await props.params;
  const c = await coproprietaireParJeton(jeton);
  if (!c) return erreur("Lien invalide.", 404);
  const f = await prisma.fichierCopro.findFirst({ where: { id, demande: { coproprietaireId: c.id } } });
  if (!f) return erreur("Fichier introuvable.", 404);
  return reponseFichier(f, request);
}
