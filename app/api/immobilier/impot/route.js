import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { donneesImpot, csvImpot } from "@/lib/immobilierImpot";
import { etatRevenusPdf } from "@/lib/pdfImmobilier";
import { obtenirInfosEntreprise } from "@/lib/config";

// Revenus de location d'une année pour le comptable : ?annee=2026&format=pdf
// (une page par immeuble, lignes du T776) ou format=csv (le détail)
export async function GET(request) {
  const session = await sessionImmo();
  if (!session) return refus();
  const params = new URL(request.url).searchParams;
  const annee = Number(params.get("annee"));
  if (!(annee >= 2000 && annee <= 2100)) return erreur("Année invalide.");
  const donnees = await donneesImpot(annee);
  if (params.get("format") === "csv") {
    return new Response(csvImpot(donnees), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="revenus-location-${annee}.csv"` } });
  }
  const pdf = await etatRevenusPdf(await obtenirInfosEntreprise(), donnees);
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="revenus-location-${annee}.pdf"` } });
}
