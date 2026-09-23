import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { genererPdfRapportClients } from "@/lib/pdfRapportClients";

export async function GET() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite")) && !(await aAccesSection(session, "clients"))) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const [clients, { nomEntreprise }] = await Promise.all([
    prisma.client.findMany({ orderBy: { nom: "asc" } }),
    obtenirInfosEntreprise(),
  ]);

  const pdf = await genererPdfRapportClients(clients, nomEntreprise);
  const nomFichier = `liste-clients-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
