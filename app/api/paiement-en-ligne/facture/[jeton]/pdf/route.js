import { prisma } from "@/lib/prisma";
import { pdfFactureDuBon } from "@/lib/pdfFactureBon";

// PDF de la facture, pour la page publique de paiement (/payer/<jeton>) :
// permis seulement avec le lien secret de la facture
export async function GET(request, props) {
  const { jeton } = await props.params;
  const facture = jeton ? await prisma.facture.findUnique({ where: { jetonPaiement: jeton }, select: { bonId: true, numero: true } }) : null;
  if (!facture) return Response.json({ erreur: "Ce lien n'est plus valide." }, { status: 404 });
  const pdf = await pdfFactureDuBon(facture.bonId);
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="facture-${facture.numero}.pdf"` } });
}
