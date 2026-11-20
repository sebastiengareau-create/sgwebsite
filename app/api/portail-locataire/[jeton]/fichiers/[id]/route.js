import { prisma } from "@/lib/prisma";
import { locataireParJeton, bauxDuLocataire, filtreReparationsLocataire, reponseFichier, erreur } from "@/lib/immobilier";

// Photo d'une réparation que ce locataire peut voir
export async function GET(request, props) {
  const { jeton, id } = await props.params;
  const l = await locataireParJeton(jeton);
  if (!l) return erreur("Lien invalide.", 404);
  const f = await prisma.fichierImmo.findFirst({ where: { id, reparation: filtreReparationsLocataire(l.id, await bauxDuLocataire(l.id)) } });
  if (!f) return erreur("Fichier introuvable.", 404);
  return reponseFichier(f, request);
}
