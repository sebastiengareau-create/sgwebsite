import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesPaieActif } from "@/lib/accesPaie";
import { obtenirInfosEntreprise } from "@/lib/config";
import { versFormulaire, partiesDuReleve, verifier } from "@/lib/releveEmploi";
import { pdfReleveEmploi } from "@/lib/pdfReleveEmploi";

// Relevé d'emploi en PDF : copie de travail (pas le relevé officiel, qui
// passe par RE Web), offerte même s'il reste des points à corriger — ils
// sont alors listés en haut. Contient le NAS.
export async function GET(request, props) {
  const session = await obtenirSession();
  if (!(await accesPaieActif(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { id } = await props.params;
  const enregistre = await prisma.releveEmploi.findUnique({ where: { id } });
  if (!enregistre) return NextResponse.json({ erreur: "Relevé introuvable." }, { status: 404 });
  const releve = versFormulaire(enregistre);
  const [parties, entreprise] = await Promise.all([partiesDuReleve(releve.employeId), obtenirInfosEntreprise()]);
  const pdf = await pdfReleveEmploi({ releve, ...parties, entreprise, erreurs: verifier(releve, parties) });
  const nom = `RE_${(parties.employe.nomFamille || "employe").normalize("NFD").replace(/[^\w]/g, "")}_${releve.dernierJourPaye}`;
  return new Response(pdf, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nom}.pdf"`, "Cache-Control": "no-store" },
  });
}
