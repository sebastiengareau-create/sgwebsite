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
  if (!(await aAccesSection(session, "comptabilite")) && !(await aAccesSection(session, "fournisseurs"))) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const fournisseurs = await prisma.fournisseur.findMany({ orderBy: { nom: "asc" } });

  const lignesCsv = [
    ["No fournisseur", "Nom", "Adresse", "Téléphone", "Courriel", "Statut"].join(";"),
  ];
  for (const f of fournisseurs) {
    lignesCsv.push([
      echapperCsv(f.numero),
      echapperCsv(f.nom),
      echapperCsv([f.adresse, f.ville, f.codePostal].filter(Boolean).join(", ")),
      echapperCsv(f.telephone),
      echapperCsv(f.courriel),
      f.actif ? "Actif" : "Inactif",
    ].join(";"));
  }

  const csv = "﻿" + lignesCsv.join("\r\n"); // ﻿ = BOM, pour que les accents s'affichent bien dans Excel
  const nomFichier = `liste-fournisseurs-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
