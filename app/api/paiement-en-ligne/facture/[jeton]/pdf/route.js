import { prisma } from "@/lib/prisma";
import { genererPdfFacture } from "@/lib/pdfFacture";
import { obtenirInfosEntreprise } from "@/lib/config";

// PDF de la facture, pour la page publique de paiement (/payer/<jeton>) :
// permis seulement avec le lien secret de la facture
export async function GET(request, props) {
  const { jeton } = await props.params;
  const facture = jeton ? await prisma.facture.findUnique({ where: { jetonPaiement: jeton }, select: { bonId: true, numero: true } }) : null;
  if (!facture) return Response.json({ erreur: "Ce lien n'est plus valide." }, { status: 404 });
  const bon = await prisma.bonTravail.findUnique({
    where: { id: facture.bonId },
    include: {
      client: true,
      vehicule: true,
      facture: { include: { paiements: { select: { montant: true, modePaiement: true, depot: { select: { id: true } } } } } },
      depots: { select: { montant: true } },
      problemes: { orderBy: { id: "asc" }, include: { pieces: { include: { piece: true } }, entreesTemps: { include: { employe: true } } } },
    },
  });
  const parametres = await prisma.parametre.findMany();
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tpsTaux = bon.vehiculeVenteId ? 0 : Number(dict.tps_taux || 5);
  const tvqTaux = bon.vehiculeVenteId ? 0 : Number(dict.tvq_taux || 9.975);
  const pdf = await genererPdfFacture(bon, await obtenirInfosEntreprise(), dict, tpsTaux, tvqTaux);
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="facture-${facture.numero}.pdf"` } });
}
