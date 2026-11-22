import { clientParJeton, bonDeFactureDuClient } from "@/lib/portailClient";
import { pdfFactureDuBon } from "@/lib/pdfFactureBon";

// PDF d'une facture, depuis le portail du client : seulement ses propres factures
export async function GET(request, props) {
  const { jeton, factureId } = await props.params;
  const client = await clientParJeton(jeton);
  if (!client) return Response.json({ erreur: "Ce lien n'est plus valide." }, { status: 404 });
  const facture = await bonDeFactureDuClient(client.id, factureId);
  if (!facture) return Response.json({ erreur: "Facture introuvable." }, { status: 404 });
  const pdf = await pdfFactureDuBon(facture.bonId);
  return new Response(pdf, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="facture-${facture.numero}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
