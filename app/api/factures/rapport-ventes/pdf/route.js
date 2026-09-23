import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { calculerRapportVentes, analyserFiltresPeriode } from "@/lib/rapportVentes";
import { genererPdfRapportVentes } from "@/lib/pdfRapportVentes";

export async function GET(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { debutStr, finStr, groupement, debut, fin } = analyserFiltresPeriode(Object.fromEntries(searchParams));

  const [factures, { nomEntreprise }] = await Promise.all([
    prisma.facture.findMany({
      where: { dateEmission: { gte: debut, lte: fin }, statut: { not: "ANNULEE" } },
      orderBy: { dateEmission: "asc" },
    }),
    obtenirInfosEntreprise(),
  ]);

  const { lignes, totaux, ticketMoyen } = calculerRapportVentes(factures, groupement);
  const pdf = await genererPdfRapportVentes({ lignes, totaux, ticketMoyen, debutStr, finStr, groupement }, nomEntreprise);
  const nomFichier = `rapport-ventes-${debutStr}-au-${finStr}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
