import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

function echapperCsv(valeur) {
  const texte = String(valeur ?? "");
  if (texte.includes(";") || texte.includes('"') || texte.includes("\n")) {
    return `"${texte.replace(/"/g, '""')}"`;
  }
  return texte;
}

export async function GET() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite")) && !(await aAccesSection(session, "employes"))) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const employes = await prisma.user.findMany({ orderBy: { nom: "asc" } });

  const lignesCsv = [
    ["No employé", "Nom", "Adresse", "Assignation", "Téléphone", "Courriel", "Statut"].join(";"),
  ];
  for (const e of employes) {
    lignesCsv.push([
      echapperCsv(e.numeroEmploye),
      echapperCsv(e.nom),
      echapperCsv([e.adresse, e.ville, e.codePostal].filter(Boolean).join(", ")),
      echapperCsv(e.assignation),
      echapperCsv(e.telephone),
      echapperCsv(e.courriel),
      e.actif ? "Actif" : "Inactif",
    ].join(";"));
  }

  const csv = "﻿" + lignesCsv.join("\r\n"); // ﻿ = BOM, pour que les accents s'affichent bien dans Excel
  const nomFichier = `liste-employes-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
