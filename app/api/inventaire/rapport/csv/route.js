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
  if (!(await aAccesSection(session, "comptabilite"))) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const pieces = await prisma.piece.findMany({ orderBy: { nom: "asc" } });

  const lignesCsv = [
    ["No pièce", "Description", "Qté", "Coûtant", "Vendant", "Marge"].join(";"),
  ];
  for (const p of pieces) {
    const marge = p.prix - p.coutant;
    lignesCsv.push([
      echapperCsv(p.numero),
      echapperCsv(p.nom),
      p.qte,
      p.coutant.toFixed(2).replace(".", ","),
      p.prix.toFixed(2).replace(".", ","),
      marge.toFixed(2).replace(".", ","),
    ].join(";"));
  }

  const csv = "﻿" + lignesCsv.join("\r\n"); // ﻿ = BOM, pour que les accents s'affichent bien dans Excel
  const nomFichier = `rapport-inventaire-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
