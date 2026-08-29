import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";

function echapperCsv(valeur) {
  const texte = String(valeur ?? "");
  if (texte.includes(";") || texte.includes('"') || texte.includes("\n")) {
    return `"${texte.replace(/"/g, '""')}"`;
  }
  return texte;
}

export async function GET(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const debut = searchParams.get("debut");
  const fin = searchParams.get("fin");

  const filtreDate = {};
  if (debut) filtreDate.gte = new Date(`${debut}T00:00:00`);
  if (fin) filtreDate.lte = new Date(`${fin}T23:59:59`);

  const ecritures = await prisma.ecritureComptable.findMany({
    where: Object.keys(filtreDate).length ? { date: filtreDate } : undefined,
    include: { lignes: { include: { compte: true } } },
    orderBy: { date: "asc" },
  });

  const lignesCsv = [
    ["Date", "No écriture", "Description", "No compte", "Nom du compte", "Débit", "Crédit", "Créé par"].join(";"),
  ];

  for (const e of ecritures) {
    const dateTexte = new Date(e.date).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });
    for (const l of e.lignes) {
      lignesCsv.push([
        dateTexte,
        e.numero,
        echapperCsv(e.description),
        l.compte.numero,
        echapperCsv(l.compte.nom),
        l.debit > 0 ? l.debit.toFixed(2).replace(".", ",") : "",
        l.credit > 0 ? l.credit.toFixed(2).replace(".", ",") : "",
        echapperCsv(e.creePar || ""),
      ].join(";"));
    }
  }

  const csv = "\uFEFF" + lignesCsv.join("\r\n"); // \uFEFF = BOM, pour que les accents s'affichent bien dans Excel
  const nomFichier = `journal-comptable-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
