import { prisma } from "@/lib/prisma";
import { sessionImmo, refus, erreur, bailComplet, reponseFichier } from "@/lib/immobilier";
import { obtenirInfosEntreprise } from "@/lib/config";
import { recuLoyer } from "@/lib/pdfImmobilier";

// Reçu de loyer d'un paiement, généré à la demande (PDF)
export async function GET(request, props) {
  if (!(await sessionImmo())) return refus();
  const { id } = await props.params;
  const paiement = await prisma.paiementImmo.findUnique({ where: { id } });
  if (!paiement) return erreur("Paiement introuvable.", 404);
  const [bail, entreprise] = await Promise.all([bailComplet(paiement.bailId), obtenirInfosEntreprise()]);
  const donnees = await recuLoyer(bail, entreprise, paiement);
  return reponseFichier({ nom: `Recu-loyer-${paiement.date.toISOString().slice(0, 10)}.pdf`, typeMime: "application/pdf", taille: donnees.length, donnees }, request);
}
