import { prisma } from "@/lib/prisma";
import { locataireParJeton, reponseFichier, erreur } from "@/lib/immobilier";
import { relevesDeLAnnee, pdfReleves31 } from "@/lib/releve31";

// Copie du relevé 31 du locataire : un relevé produit (coché « Produit »
// dans Immobilier → Relevé 31) d'un bail dont il est signataire
export async function GET(request, props) {
  const { jeton, id } = await props.params;
  const l = await locataireParJeton(jeton);
  if (!l) return erreur("Lien invalide.", 404);
  const suivi = await prisma.releve31Immo.findFirst({ where: { id, produitLe: { not: null }, bail: { locataires: { some: { id: l.id } } } } });
  if (!suivi) return erreur("Relevé introuvable.", 404);
  const releves = await relevesDeLAnnee(suivi.annee, { bailIds: [suivi.bailId] });
  if (releves.length === 0) return erreur("Relevé introuvable.", 404);
  const donnees = await pdfReleves31(suivi.annee, releves, { locataire: l.nom });
  return reponseFichier({ nom: `Releve-31-${suivi.annee}.pdf`, typeMime: "application/pdf", taille: donnees.length, donnees }, request);
}
