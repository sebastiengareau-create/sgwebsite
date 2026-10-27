import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { formaterNas } from "@/lib/nas";
import { calculerFeuillets, CASES_T4, CASES_RL1 } from "@/lib/feuilletsFiscaux";

function echapperCsv(valeur) {
  const texte = String(valeur ?? "");
  if (texte.includes(";") || texte.includes('"') || texte.includes("\n")) {
    return `"${texte.replace(/"/g, '""')}"`;
  }
  return texte;
}
const montant = (n) => Number(n || 0).toFixed(2).replace(".", ",");

// Sommaires T4 / RL-1 en Excel (CSV) : une ligne par employé, une colonne
// par case — pour le comptable. Contient les NAS.
export async function GET(request) {
  const session = await obtenirSession();
  const modulePaie = await prisma.parametre.findUnique({ where: { cle: "module_paie" } });
  if (!(await aAccesSection(session, "paie")) || modulePaie?.valeur !== "actif") {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }
  const annee = Number(new URL(request.url).searchParams.get("annee"));
  if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) {
    return new Response(JSON.stringify({ erreur: "Année invalide." }), { status: 400 });
  }

  const { feuillets } = await calculerFeuillets(annee);
  const lignesCsv = [
    ["Nom", "NAS", "No employé", ...CASES_T4.map((c) => `T4 ${c.t4} ${c.libelle}`), ...CASES_RL1.map((c) => `RL-1 ${c.rl1} ${c.libelle}`)].map(echapperCsv).join(";"),
  ];
  for (const f of feuillets) {
    lignesCsv.push([
      echapperCsv(f.employe.nom),
      echapperCsv(formaterNas(f.employe.nas || "")),
      echapperCsv(f.employe.numeroEmploye),
      ...CASES_T4.map((c) => montant(f.montants[c.cle])),
      ...CASES_RL1.map((c) => montant(f.montants[c.cle])),
    ].join(";"));
  }

  const csv = "﻿" + lignesCsv.join("\r\n"); // BOM, pour que les accents s'affichent bien dans Excel
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sommaires-t4-rl1-${annee}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
