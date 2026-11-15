import { sessionElevage } from "@/lib/elevage";
import { chargerRegistre } from "@/lib/registreElevageDonnees";
import { ENTETES_EXPORT, ligneExport } from "@/lib/registreElevage";
import { dateCourte } from "@/lib/elevageCalculs";

function echapperCsv(valeur) {
  const texte = String(valeur ?? "");
  return /[;"\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

// Registre en CSV, pour préparer les déclarations à Agri-Traçabilité
// Québec. GET ?annee=2026 (toutes les années sinon) &aDeclarer=1 (seulement
// ce qui reste à déclarer)
export async function GET(request) {
  if (!(await sessionElevage())) return Response.json({ erreur: "Accès refusé." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const annee = params.get("annee");
  const seulementADeclarer = params.get("aDeclarer") === "1";
  const { evenements } = await chargerRegistre();
  const lignes = evenements
    .filter((e) => (!annee || dateCourte(e.date).startsWith(annee)) && (!seulementADeclarer || (e.aDeclarer && !e.declareLe)))
    .map((e) => ligneExport(e).map(echapperCsv).join(";"));
  const csv = "﻿" + [ENTETES_EXPORT.join(";"), ...lignes].join("\r\n"); // BOM : accents lisibles dans Excel
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registre-elevage-${annee || "complet"}.csv"`,
    },
  });
}
