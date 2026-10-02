import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { genererPdfCommandeFournisseur } from "@/lib/pdfCommandeFournisseur";

export async function GET(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return Response.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const [commande, entreprise] = await Promise.all([
    prisma.commandeFournisseur.findUnique({
      where: { id: params.id },
      include: { fournisseur: true, lignes: { include: { piece: true }, orderBy: { id: "asc" } } },
    }),
    obtenirInfosEntreprise(),
  ]);
  if (!commande) return Response.json({ erreur: "Commande introuvable." }, { status: 404 });

  const pdf = await genererPdfCommandeFournisseur(commande, entreprise);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${commande.numero}.pdf"`,
    },
  });
}
