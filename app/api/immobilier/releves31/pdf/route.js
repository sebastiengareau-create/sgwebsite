import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { relevesDeLAnnee, pdfReleves31 } from "@/lib/releve31";

// Relevés 31 en PDF, une page par locataire : ?annee=2026 (tous les
// logements occupés au 31 décembre) ou &bailId=… (un seul logement) ;
// &proprietaire=1 ajoute une copie pour les dossiers du propriétaire
export async function GET(request) {
  const session = await sessionImmo();
  if (!session) return refus();
  const params = new URL(request.url).searchParams;
  const annee = Number(params.get("annee"));
  if (!(annee >= 2000 && annee <= 2100)) return erreur("Année invalide.");
  const bailId = params.get("bailId");
  const releves = await relevesDeLAnnee(annee, bailId ? { bailIds: [bailId] } : {});
  if (bailId && releves.length === 0) return erreur(`Ce bail n'était pas en cours au 31 décembre ${annee}.`, 404);
  const pdf = await pdfReleves31(annee, releves, { copieProprietaire: params.get("proprietaire") === "1" });
  const nom = bailId ? `releve-31-${annee}-${releves[0].rl.c1 || releves[0].rl.c2 || "logement"}` : `releves-31-${annee}`;
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nom.replace(/[^\w.-]+/g, "-")}.pdf"` } });
}
