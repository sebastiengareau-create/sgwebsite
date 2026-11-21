import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesPaieActif } from "@/lib/accesPaie";
import { versFormulaire, partiesDuReleve, verifier } from "@/lib/releveEmploi";
import { xmlRelevesEmploi } from "@/lib/releveEmploiCalculs";

// Fichier du relevé pour RE Web (.BLK, XML W-2.0). ?emission=S pour le
// soumettre directement ; par défaut (D), il arrive en brouillon dans RE
// Web, à réviser et soumettre là-bas. Refusé (409) s'il reste des erreurs.
// Contient le NAS.
export async function GET(request, props) {
  const session = await obtenirSession();
  if (!(await accesPaieActif(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { id } = await props.params;
  const enregistre = await prisma.releveEmploi.findUnique({ where: { id } });
  if (!enregistre) return NextResponse.json({ erreur: "Relevé introuvable." }, { status: 404 });
  const releve = versFormulaire(enregistre);
  const parties = await partiesDuReleve(releve.employeId);
  const erreurs = verifier(releve, parties);
  if (erreurs.length > 0) return NextResponse.json({ erreur: "Le relevé n'est pas complet.", manque: erreurs }, { status: 409 });
  const emission = new URL(request.url).searchParams.get("emission") === "S" ? "S" : "D";
  const xml = xmlRelevesEmploi([{ releve, employe: parties.employe }], { employeur: parties.employeur, emission, versionLogiciel: (process.env.RAILWAY_GIT_COMMIT_SHA || "dev").slice(0, 7) });
  const nom = `RE_${(parties.employe.nomFamille || "employe").normalize("NFD").replace(/[^\w]/g, "")}_${releve.dernierJourPaye}`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}.BLK"`,
      "Cache-Control": "no-store",
    },
  });
}
