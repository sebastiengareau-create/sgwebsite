import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { genererPdfRapportInventaire } from "@/lib/pdfRapportInventaire";

export async function GET() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite")) && !(await aAccesSection(session, "inventaire"))) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const [pieces, { nomEntreprise }] = await Promise.all([
    prisma.piece.findMany({ orderBy: { nom: "asc" } }),
    obtenirInfosEntreprise(),
  ]);

  const pdf = await genererPdfRapportInventaire(pieces, nomEntreprise);
  const nomFichier = `rapport-inventaire-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
