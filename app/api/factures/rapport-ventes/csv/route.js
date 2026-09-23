import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { calculerRapportVentes, analyserFiltresPeriode } from "@/lib/rapportVentes";

function echapperCsv(valeur) {
  const texte = String(valeur ?? "");
  if (texte.includes(";") || texte.includes('"') || texte.includes("\n")) {
    return `"${texte.replace(/"/g, '""')}"`;
  }
  return texte;
}

function fmtNombre(n) {
  return n.toFixed(2).replace(".", ",");
}

export async function GET(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { debutStr, finStr, groupement, debut, fin } = analyserFiltresPeriode(Object.fromEntries(searchParams));

  const factures = await prisma.facture.findMany({
    where: { dateEmission: { gte: debut, lte: fin }, statut: { not: "ANNULEE" } },
    orderBy: { dateEmission: "asc" },
  });

  const { lignes, totaux } = calculerRapportVentes(factures, groupement);

  const lignesCsv = [
    ["Période", "Nb factures", "Pièces", "Main-d'œuvre", "Autres revenus", "Avant taxes", "TPS", "TVQ", "Avec taxes"].join(";"),
  ];
  for (const l of lignes) {
    lignesCsv.push([
      echapperCsv(l.libelle),
      l.nombreFactures,
      fmtNombre(l.totalPieces),
      fmtNombre(l.totalMainOeuvre),
      fmtNombre(l.totalAutresRevenus),
      fmtNombre(l.totalAvantTaxes),
      fmtNombre(l.tps),
      fmtNombre(l.tvq),
      fmtNombre(l.totalAvecTaxes),
    ].join(";"));
  }
  lignesCsv.push([
    "Total",
    totaux.nombreFactures,
    fmtNombre(totaux.totalPieces),
    fmtNombre(totaux.totalMainOeuvre),
    fmtNombre(totaux.totalAutresRevenus),
    fmtNombre(totaux.totalAvantTaxes),
    fmtNombre(totaux.tps),
    fmtNombre(totaux.tvq),
    fmtNombre(totaux.totalAvecTaxes),
  ].join(";"));

  const csv = "﻿" + lignesCsv.join("\r\n"); // ﻿ = BOM, pour que les accents s'affichent bien dans Excel
  const nomFichier = `rapport-ventes-${debutStr}-au-${finStr}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
