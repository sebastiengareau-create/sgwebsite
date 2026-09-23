import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { alignerInventaireAuGL } from "@/lib/comptabilite";
import { lireFeuille, mapperEntetes, lireLigne } from "@/lib/importFichier";

const ALIAS_CHAMPS = {
  nom: ["nom", "name", "description", "piece"],
  numero: ["numero", "no piece", "no", "sku", "code"],
  qte: ["qte", "quantite", "qty", "quantity", "qte en stock", "stock"],
  qteMin: ["qte min", "quantite min", "qte minimum", "min"],
  qteMax: ["qte max", "quantite max", "qte maximum", "max"],
  emplacement: ["emplacement", "location", "tablette"],
  prix: ["prix", "prix vente", "price", "vendant"],
  coutant: ["coutant", "cout", "cost", "prix coutant"],
  categorie: ["categorie", "category"],
  fournisseur: ["fournisseur", "supplier", "vendeur"],
};

function versNombre(texte) {
  if (texte === undefined || texte === null || texte === "") return null;
  const n = Number(String(texte).replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const formData = await request.formData();
  const fichier = formData.get("fichier");
  if (!fichier || typeof fichier === "string") {
    return NextResponse.json({ erreur: "Aucun fichier reçu." }, { status: 400 });
  }

  let feuille;
  try {
    feuille = await lireFeuille(fichier);
  } catch (e) {
    return NextResponse.json({ erreur: "Fichier illisible — assure-toi que c'est un .xlsx, .xls ou .csv valide." }, { status: 400 });
  }

  if (!feuille || feuille.rowCount < 2) {
    return NextResponse.json({ erreur: "Le fichier est vide ou n'a pas de ligne d'en-têtes." }, { status: 400 });
  }

  const mappage = mapperEntetes(feuille.getRow(1), ALIAS_CHAMPS);
  if (!Object.values(mappage).includes("nom") || !Object.values(mappage).includes("numero")) {
    return NextResponse.json({ erreur: "Le fichier doit avoir au moins les colonnes \"Nom\" et \"Numéro\"." }, { status: 400 });
  }

  const [numerosExistants, categories, fournisseurs] = await Promise.all([
    prisma.piece.findMany({ select: { numero: true } }).then((r) => new Set(r.map((p) => p.numero.toLowerCase()))),
    prisma.categorieInventaire.findMany(),
    prisma.fournisseur.findMany({ select: { id: true, nom: true } }),
  ]);

  let importes = 0;
  const doublons = [];
  const ignores = [];
  const piecesCreees = [];

  for (let numLigne = 2; numLigne <= feuille.rowCount; numLigne++) {
    const ligne = feuille.getRow(numLigne);
    if (!ligne.hasValues) continue;

    const donnees = lireLigne(ligne, mappage);
    const nom = (donnees.nom || "").trim();
    const numero = (donnees.numero || "").trim();
    if (!nom || !numero) { ignores.push(`Ligne ${numLigne} — nom ou numéro manquant`); continue; }

    const prix = versNombre(donnees.prix);
    if (prix === null) { ignores.push(`Ligne ${numLigne} (${numero}) — prix manquant ou invalide`); continue; }

    if (numerosExistants.has(numero.toLowerCase())) {
      doublons.push(numero);
      continue;
    }

    const categorieTexte = (donnees.categorie || "").trim().toLowerCase();
    const categorieTrouvee = categories.find(
      (c) => c.code.toLowerCase() === categorieTexte || c.nom.toLowerCase() === categorieTexte
    );

    const fournisseurTexte = (donnees.fournisseur || "").trim().toLowerCase();
    const fournisseurTrouve = fournisseurTexte
      ? fournisseurs.find((f) => f.nom.toLowerCase() === fournisseurTexte)
      : null;

    const qteInitiale = versNombre(donnees.qte) || 0;

    const piece = await prisma.piece.create({
      data: {
        nom,
        numero,
        qte: qteInitiale,
        qteMin: versNombre(donnees.qteMin) || 0,
        qteMax: versNombre(donnees.qteMax),
        emplacement: donnees.emplacement || null,
        fournisseurId: fournisseurTrouve?.id || null,
        prix,
        coutant: versNombre(donnees.coutant) || 0,
        categorie: categorieTrouvee?.code || "PIECE",
        ...(qteInitiale !== 0 && {
          mouvements: {
            create: { type: "AJUSTEMENT", qte: qteInitiale, solde: qteInitiale, note: "Stock de départ (import)", creePar: session.nom },
          },
        }),
      },
    });
    numerosExistants.add(numero.toLowerCase());
    piecesCreees.push(piece);
    importes++;
  }

  // Une seule écriture pour tout le lot (plutôt qu'une par pièce) — les
  // pièces sont déjà créées, un échec comptable est seulement signalé.
  try {
    await alignerInventaireAuGL(session.nom, `Import de ${piecesCreees.length} pièce${piecesCreees.length !== 1 ? "s" : ""}`);
  } catch (e) {
    ignores.push(`Écriture comptable non créée : ${e.message.replace(/^PERIODE_LOCK:/, "")}`);
  }

  return NextResponse.json({ importes, doublons, ignores });
}
