import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { limitesJourQuebec, dateAujourdhuiQuebec } from "@/lib/temps";

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

  // Période facultative : debut et fin (AAAA-MM-JJ), journées au Québec —
  // une écriture de 21 h le 31 reste dans le mois, peu importe le fuseau du serveur
  const { searchParams } = new URL(request.url);
  const debut = searchParams.get("debut") || "";
  const fin = searchParams.get("fin") || "";
  const dateValide = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`));
  if ((debut && !dateValide(debut)) || (fin && !dateValide(fin))) {
    return new Response(JSON.stringify({ erreur: "Dates invalides (AAAA-MM-JJ)." }), { status: 400 });
  }
  if (debut && fin && debut > fin) {
    return new Response(JSON.stringify({ erreur: "Le début de la période est après sa fin." }), { status: 400 });
  }

  const filtreDate = {};
  if (debut) filtreDate.gte = limitesJourQuebec(debut).debut;
  if (fin) filtreDate.lte = limitesJourQuebec(fin).fin;

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
  const periode = debut || fin ? `${debut || "debut"}_au_${fin || dateAujourdhuiQuebec()}` : `complet-${dateAujourdhuiQuebec()}`;
  const nomFichier = `journal-comptable-${periode}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
