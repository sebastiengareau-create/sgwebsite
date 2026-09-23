import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Readable } from "stream";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prochainNumeroClient } from "@/lib/numerotation";

// Alias acceptés par colonne — comparés après avoir retiré accents/espaces/
// casse, pour accepter les en-têtes tels quels dans le fichier du client
// (ex. "Téléphone", "telephone", "Tel").
const ALIAS_CHAMPS = {
  nom: ["nom", "name", "client", "nomclient"],
  telephone: ["telephone", "tel", "phone", "cell", "cellulaire"],
  courriel: ["courriel", "email", "courriel electronique", "e mail", "adresse courriel"],
  adresse: ["adresse", "address"],
  ville: ["ville", "city"],
  codePostal: ["codepostal", "code postal", "postal", "zip", "zipcode"],
  garantieProlongee: ["garantie", "garantie prolongee", "no garantie", "numero garantie"],
};

function normaliserEntete(texte) {
  return String(texte || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // retire les accents
    .toLowerCase().trim().replace(/\s+/g, " ");
}

function construireMappageColonnes(ligneEntetes) {
  const mappage = {}; // index de colonne (1-based, ExcelJS) → nom de champ
  ligneEntetes.eachCell((cell, colNumber) => {
    const entete = normaliserEntete(cell.value);
    for (const [champ, alias] of Object.entries(ALIAS_CHAMPS)) {
      if (alias.includes(entete)) {
        mappage[colNumber] = champ;
        break;
      }
    }
  });
  return mappage;
}

function valeurCellule(cell) {
  if (cell == null) return "";
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && v.text) return String(v.text).trim(); // texte enrichi
  if (typeof v === "object" && v.result !== undefined) return String(v.result).trim(); // formule
  return String(v).trim();
}

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const formData = await request.formData();
  const fichier = formData.get("fichier");
  if (!fichier || typeof fichier === "string") {
    return NextResponse.json({ erreur: "Aucun fichier reçu." }, { status: 400 });
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  const classeur = new ExcelJS.Workbook();
  try {
    if (fichier.name?.toLowerCase().endsWith(".csv")) {
      // Les exports Excel en français utilisent souvent ";" (la virgule
      // sert de séparateur décimal dans ce format régional) — on détecte
      // le délimiteur réel plutôt que de supposer une virgule.
      const premiereLigne = octets.toString("utf-8").split(/\r?\n/, 1)[0] || "";
      const delimiter = (premiereLigne.match(/;/g) || []).length > (premiereLigne.match(/,/g) || []).length ? ";" : ",";
      await classeur.csv.read(Readable.from(octets), { parserOptions: { delimiter } });
    } else {
      await classeur.xlsx.load(octets);
    }
  } catch (e) {
    return NextResponse.json({ erreur: "Fichier illisible — assure-toi que c'est un .xlsx, .xls ou .csv valide." }, { status: 400 });
  }

  const feuille = classeur.worksheets[0];
  if (!feuille || feuille.rowCount < 2) {
    return NextResponse.json({ erreur: "Le fichier est vide ou n'a pas de ligne d'en-têtes." }, { status: 400 });
  }

  const mappage = construireMappageColonnes(feuille.getRow(1));
  if (!Object.values(mappage).includes("nom")) {
    return NextResponse.json({ erreur: "Aucune colonne \"Nom\" trouvée dans la première ligne du fichier." }, { status: 400 });
  }

  const nomsExistants = new Set(
    (await prisma.client.findMany({ select: { nom: true } })).map((c) => c.nom.toLowerCase())
  );

  let importes = 0;
  const doublons = [];
  const ignores = [];

  for (let numLigne = 2; numLigne <= feuille.rowCount; numLigne++) {
    const ligne = feuille.getRow(numLigne);
    if (!ligne.hasValues) continue;

    const donnees = {};
    for (const [colNumber, champ] of Object.entries(mappage)) {
      donnees[champ] = valeurCellule(ligne.getCell(Number(colNumber)));
    }

    const nom = (donnees.nom || "").trim();
    if (!nom) { ignores.push(`Ligne ${numLigne} — nom manquant`); continue; }

    if (nomsExistants.has(nom.toLowerCase())) {
      doublons.push(nom);
      continue;
    }

    await prisma.client.create({
      data: {
        numero: await prochainNumeroClient(),
        nom,
        telephone: donnees.telephone || null,
        courriel: donnees.courriel || null,
        adresse: donnees.adresse || null,
        ville: donnees.ville || null,
        codePostal: donnees.codePostal || null,
        garantieProlongee: donnees.garantieProlongee || null,
      },
    });
    nomsExistants.add(nom.toLowerCase()); // évite un doublon interne au même fichier
    importes++;
  }

  return NextResponse.json({ importes, doublons, ignores });
}
