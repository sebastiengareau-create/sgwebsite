import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { construireRapportParFournisseur } from "@/lib/rapportInventaire";

function echapperCsv(valeur) {
  const texte = String(valeur ?? "");
  if (texte.includes(";") || texte.includes('"') || texte.includes("\n")) {
    return `"${texte.replace(/"/g, '""')}"`;
  }
  return texte;
}
const nombre = (n) => (n == null ? "" : n.toFixed(2).replace(".", ","));

// Une ligne par couple fournisseur × pièce — se trie et se filtre dans Excel.
export async function GET(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite")) && !(await aAccesSection(session, "inventaire"))) {
    return Response.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const fournisseurId = new URL(request.url).searchParams.get("fournisseur") || null;
  const rapport = await construireRapportParFournisseur(prisma, fournisseurId);

  const lignesCsv = [
    ["Fournisseur", "Habituel", "Notre no", "No fournisseur", "Description", "Qté", "Qté min", "Dernier prix", "Dernier achat", "Coût moyen", "Valeur"].join(";"),
  ];
  for (const g of rapport.groupes) {
    for (const l of g.lignes) {
      lignesCsv.push([
        echapperCsv(g.fournisseur?.nom || "Sans fournisseur"),
        l.habituel ? "Oui" : "",
        echapperCsv(l.numero),
        echapperCsv(l.numeroFournisseur || ""),
        echapperCsv(l.nom),
        l.qte,
        l.qteMin,
        nombre(l.dernierPrix),
        l.dernierAchat ? new Date(l.dernierAchat).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" }) : "",
        nombre(l.coutant),
        nombre(l.valeur),
      ].join(";"));
    }
  }

  const csv = "﻿" + lignesCsv.join("\r\n"); // BOM : accents corrects dans Excel
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventaire-par-fournisseur-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
