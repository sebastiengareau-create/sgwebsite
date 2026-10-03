import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { construireRapportParFournisseur } from "@/lib/rapportInventaire";
import { genererPdfRapportInventaireFournisseurs } from "@/lib/pdfRapportInventaireFournisseurs";

export async function GET(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite")) && !(await aAccesSection(session, "inventaire"))) {
    return Response.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const fournisseurId = new URL(request.url).searchParams.get("fournisseur") || null;
  const [rapport, { nomEntreprise }] = await Promise.all([
    construireRapportParFournisseur(prisma, fournisseurId),
    obtenirInfosEntreprise(),
  ]);
  const titreFournisseur = fournisseurId ? rapport.groupes[0]?.fournisseur?.nom : null;
  const pdf = await genererPdfRapportInventaireFournisseurs(rapport, nomEntreprise, titreFournisseur);
  const suffixe = titreFournisseur ? `-${titreFournisseur.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : "";

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="inventaire-par-fournisseur${suffixe}-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
