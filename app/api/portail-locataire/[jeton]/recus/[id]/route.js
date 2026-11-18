import { prisma } from "@/lib/prisma";
import { locataireParJeton, bailComplet, reponseFichier, erreur } from "@/lib/immobilier";
import { obtenirInfosEntreprise } from "@/lib/config";
import { recuLoyer } from "@/lib/pdfImmobilier";

// Reçu d'un paiement fait sur un des baux de ce locataire
export async function GET(request, props) {
  const { jeton, id } = await props.params;
  const l = await locataireParJeton(jeton);
  if (!l) return erreur("Lien invalide.", 404);
  const paiement = await prisma.paiementImmo.findFirst({ where: { id, bail: { locataires: { some: { id: l.id } } } } });
  if (!paiement) return erreur("Paiement introuvable.", 404);
  const [bail, entreprise] = await Promise.all([bailComplet(paiement.bailId), obtenirInfosEntreprise()]);
  const donnees = await recuLoyer(bail, entreprise, paiement);
  return reponseFichier({ nom: `Recu-loyer-${paiement.date.toISOString().slice(0, 10)}.pdf`, typeMime: "application/pdf", taille: donnees.length, donnees }, request);
}
