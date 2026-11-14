import ExcelJS from "exceljs";
import { obtenirSession } from "@/lib/auth";
import { accesFeuillesTemps, chargerFeuillesTemps } from "@/lib/quarts";

const FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const COLONNES = [
  { titre: "No employé", valeur: (f) => f.employe.numeroEmploye || "" },
  { titre: "Nom", valeur: (f) => f.employe.nom },
  { titre: "Début de période", valeur: (f, p) => p.debut },
  { titre: "Fin de période", valeur: (f, p) => p.fin },
  { titre: "Heures régulières", valeur: (f) => f.heuresRegulieres, nombre: true },
  { titre: "Heures supplémentaires", valeur: (f) => f.heuresSupplementaires, nombre: true },
  { titre: "Heures jours fériés", valeur: (f) => f.heuresFeries, nombre: true },
  { titre: "Primes ($)", valeur: (f) => f.prime, nombre: true },
  { titre: "Taux horaire ($)", valeur: (f) => f.taux, nombre: true },
];

function echapperCsv(valeur) {
  const texte = String(valeur ?? "");
  return /[;"\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

// Export de la feuille de temps vers un logiciel de paie (Nethris, Employeur
// D, Wagepoint…) : une ligne par employé — heures régulières, heures
// supplémentaires, heures de jours fériés, primes. format=csv (défaut) ou xlsx.
export async function GET(request) {
  const session = await obtenirSession();
  if (!(await accesFeuillesTemps(session))) return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  const parametres = new URL(request.url).searchParams;
  const periode = { debut: parametres.get("debut") || "", fin: parametres.get("fin") || "" };
  if (!FORMAT.test(periode.debut) || !FORMAT.test(periode.fin) || periode.fin < periode.debut) {
    return new Response(JSON.stringify({ erreur: "Période invalide." }), { status: 400 });
  }

  const { feuilles } = await chargerFeuillesTemps(periode.debut, periode.fin);
  const lignes = feuilles.map((f) => COLONNES.map((c) => c.valeur(f, periode)));
  const nom = `feuille-de-temps-${periode.debut}-au-${periode.fin}`;

  if (parametres.get("format") === "xlsx") {
    const classeur = new ExcelJS.Workbook();
    const feuille = classeur.addWorksheet("Feuille de temps");
    feuille.columns = COLONNES.map((c) => ({ header: c.titre, width: Math.max(14, c.titre.length + 2), style: c.nombre ? { numFmt: "0.00" } : {} }));
    feuille.getRow(1).font = { bold: true };
    lignes.forEach((l) => feuille.addRow(l));
    return new Response(await classeur.xlsx.writeBuffer(), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nom}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const nombre = (n) => Number(n || 0).toFixed(2).replace(".", ",");
  const csv = "﻿" + [
    COLONNES.map((c) => echapperCsv(c.titre)).join(";"),
    ...lignes.map((l) => l.map((v, i) => (COLONNES[i].nombre ? nombre(v) : echapperCsv(v))).join(";")),
  ].join("\r\n"); // BOM, pour que les accents s'affichent bien dans Excel
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nom}.csv"`, "Cache-Control": "no-store" },
  });
}
