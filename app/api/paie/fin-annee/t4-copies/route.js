import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { calculerFeuillets } from "@/lib/feuilletsFiscaux";
import { lireCodeDentaireDefaut } from "@/lib/finAnnee";
import { pdfCopiesT4 } from "@/lib/pdfT4";
import { accesPaieActif, anneeDemandee } from "@/lib/accesPaie";

// Copies T4 des employés en PDF (?annee=AAAA, &employe=<id> pour un seul).
// Contiennent les NAS.
export async function GET(request) {
  const session = await obtenirSession();
  if (!(await accesPaieActif(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const annee = anneeDemandee(request);
  if (!annee) return NextResponse.json({ erreur: "Année invalide." }, { status: 400 });
  const employeId = new URL(request.url).searchParams.get("employe");

  const [entreprise, { feuillets: tous }, codeDentaireDefaut] = await Promise.all([obtenirInfosEntreprise(), calculerFeuillets(annee), lireCodeDentaireDefaut()]);
  const feuillets = employeId ? tous.filter((f) => f.employe.id === employeId) : tous;
  if (feuillets.length === 0) return NextResponse.json({ erreur: `Aucun feuillet pour ${annee}.` }, { status: 404 });

  const pdf = await pdfCopiesT4({ annee, feuillets, entreprise, codeDentaireDefaut });
  const suffixe = employeId ? `-${(feuillets[0].employe.numeroEmploye || feuillets[0].employe.nom).replace(/[^\w-]+/g, "-")}` : "";
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="T4-${annee}-copies${suffixe}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
