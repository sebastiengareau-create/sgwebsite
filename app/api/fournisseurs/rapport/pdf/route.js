import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { genererPdfRapportFournisseurs } from "@/lib/pdfRapportFournisseurs";

export async function GET() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite")) && !(await aAccesSection(session, "fournisseurs"))) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const [fournisseurs, { nomEntreprise }] = await Promise.all([
    prisma.fournisseur.findMany({ orderBy: { nom: "asc" } }),
    obtenirInfosEntreprise(),
  ]);

  const pdf = await genererPdfRapportFournisseurs(fournisseurs, nomEntreprise);
  const nomFichier = `liste-fournisseurs-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
