import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection, nomAffichageRole, ROLES_VALIDES } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { genererPdfRapportEmployes } from "@/lib/pdfRapportEmployes";

export async function GET() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite")) && !(await aAccesSection(session, "employes"))) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const [employes, { nomEntreprise }] = await Promise.all([
    prisma.user.findMany({ orderBy: { nom: "asc" } }),
    obtenirInfosEntreprise(),
  ]);
  const nomsRoles = Object.fromEntries(await Promise.all(ROLES_VALIDES.map(async (r) => [r, await nomAffichageRole(r)])));

  const pdf = await genererPdfRapportEmployes(employes, nomsRoles, nomEntreprise);
  const nomFichier = `liste-employes-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
