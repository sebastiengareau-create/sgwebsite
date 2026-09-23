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
  if (!(await aAccesSection(session, "comptabilite")) && !(await aAccesSection(session, "clients"))) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const clients = await prisma.client.findMany({
    include: { _count: { select: { bons: true } } },
    orderBy: { nom: "asc" },
  });

  const lignesCsv = [
    ["No client", "Nom", "Adresse", "Téléphone", "Courriel", "Bons"].join(";"),
  ];
  for (const c of clients) {
    lignesCsv.push([
      echapperCsv(c.numero),
      echapperCsv(c.nom),
      echapperCsv([c.adresse, c.ville, c.codePostal].filter(Boolean).join(", ")),
      echapperCsv(c.telephone),
      echapperCsv(c.courriel),
      c._count.bons,
    ].join(";"));
  }

  const csv = "﻿" + lignesCsv.join("\r\n"); // ﻿ = BOM, pour que les accents s'affichent bien dans Excel
  const nomFichier = `liste-clients-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
