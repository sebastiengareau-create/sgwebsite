import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { exporterDonnees } from "@/lib/sauvegarde";

export async function GET() {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const donnees = await exporterDonnees();
  const nomFichier = `vr-premium-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(donnees, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
