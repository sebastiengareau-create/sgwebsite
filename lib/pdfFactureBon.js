import { prisma } from "./prisma";
import { genererPdfFacture } from "./pdfFacture";
import { obtenirInfosEntreprise } from "./config";

// PDF de la facture d'un bon, tel que le client le reçoit (page de paiement
// en ligne, portail client)
export async function pdfFactureDuBon(bonId) {
  const bon = await prisma.bonTravail.findUnique({
    where: { id: bonId },
    include: {
      client: true,
      vehicule: true,
      facture: { include: { paiements: { select: { montant: true, modePaiement: true, depot: { select: { id: true } } } } } },
      depots: { select: { montant: true } },
      problemes: { orderBy: { id: "asc" }, include: { pieces: { include: { piece: true } }, entreesTemps: { include: { employe: true } } } },
    },
  });
  if (!bon?.facture) return null;
  const parametres = await prisma.parametre.findMany();
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tpsTaux = bon.vehiculeVenteId ? 0 : Number(dict.tps_taux || 5);
  const tvqTaux = bon.vehiculeVenteId ? 0 : Number(dict.tvq_taux || 9.975);
  return genererPdfFacture(bon, await obtenirInfosEntreprise(), dict, tpsTaux, tvqTaux);
}
