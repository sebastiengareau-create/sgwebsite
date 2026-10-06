import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estDeveloppeur } from "@/lib/auth";
import { alignerInventaireAuGL } from "@/lib/comptabilite";
import { lireFeuille, mapperEntetes, lireLigne } from "@/lib/importFichier";
import { separerUgs } from "@/lib/codesBarres";

const ALIAS_CHAMPS = {
  nom: ["nom", "name", "description", "piece"],
  numero: ["numero", "no piece", "no", "sku", "code"],
  // Numéros séparés par des virgules qui renvoient à la pièce ; une suite de
  // 12 ou 13 chiffres parmi eux est son code-barres UPC/EAN (voir separerUgs).
  ugs: ["ugs", "autres numeros", "numeros alternatifs"],
  codeBarre: ["code barre", "code barres", "code-barre", "code-barres", "codebarre", "upc", "ean"],
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
  if (!estDeveloppeur(session)) {
    return NextResponse.json({ erreur: "Import réservé au mode développeur." }, { status: 403 });
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
  const colonnes = Object.values(mappage);
  if (!colonnes.includes("nom") || (!colonnes.includes("numero") && !colonnes.includes("ugs"))) {
    return NextResponse.json({ erreur: "Le fichier doit avoir au moins les colonnes \"Nom\" et \"Numéro\" (ou \"UGS\")." }, { status: 400 });
  }

  const [piecesExistantes, codesExistants, categories, fournisseurs] = await Promise.all([
    prisma.piece.findMany({ select: { id: true, numero: true, codeBarre: true, autresNumeros: true } })
      .then((r) => new Map(r.map((p) => [p.numero.toLowerCase(), p]))),
    prisma.piece.findMany({ where: { codeBarre: { not: null } }, select: { codeBarre: true } }).then((r) => new Set(r.map((p) => p.codeBarre))),
    prisma.categorieInventaire.findMany(),
    prisma.fournisseur.findMany({ select: { id: true, nom: true } }),
  ]);

  let importes = 0;
  const doublons = [];
  const completes = [];
  const ignores = [];
  const piecesCreees = [];

  for (let numLigne = 2; numLigne <= feuille.rowCount; numLigne++) {
    const ligne = feuille.getRow(numLigne);
    if (!ligne.hasValues) continue;

    const donnees = lireLigne(ligne, mappage);
    const nom = (donnees.nom || "").trim();
    const ugs = separerUgs(donnees.ugs);
    // Sans colonne Numéro, le premier numéro UGS devient le numéro de
    // référence ; les autres restent des numéros qui renvoient à la pièce.
    const numero = (donnees.numero || "").trim() || ugs.numeros[0] || "";
    if (!nom || !numero) { ignores.push(`Ligne ${numLigne} — nom ou numéro manquant`); continue; }
    const autresNumeros = ugs.numeros.filter((n) => n.toLowerCase() !== numero.toLowerCase());

    // Code-barres : la colonne dédiée d'abord, sinon la suite de 12 ou 13 chiffres
    // trouvée dans les UGS. Les codes en trop restent cherchables comme
    // autres numéros.
    const codesCandidats = [(donnees.codeBarre || "").replace(/\s+/g, ""), ...ugs.codesBarres].filter(Boolean);
    const codesUniques = codesCandidats.filter((c, i) => codesCandidats.indexOf(c) === i);

    const existante = piecesExistantes.get(numero.toLowerCase());
    if (existante) {
      // Pièce déjà là : on la complète avec ses numéros UGS et son
      // code-barres s'il lui manque, sans toucher au reste.
      const nouveauxNumeros = [...autresNumeros, ...codesUniques].filter((n) =>
        n.toLowerCase() !== existante.numero.toLowerCase() && n !== existante.codeBarre
        && !existante.autresNumeros.some((a) => a.toLowerCase() === n.toLowerCase()));
      const codeAjoute = !existante.codeBarre ? codesUniques.find((c) => !codesExistants.has(c)) || null : null;
      const numerosAjoutes = nouveauxNumeros.filter((n) => n !== codeAjoute);
      if (!codeAjoute && numerosAjoutes.length === 0) { doublons.push(numero); continue; }
      await prisma.piece.update({
        where: { id: existante.id },
        data: {
          ...(codeAjoute && { codeBarre: codeAjoute }),
          ...(numerosAjoutes.length > 0 && { autresNumeros: [...existante.autresNumeros, ...numerosAjoutes] }),
        },
      });
      if (codeAjoute) { existante.codeBarre = codeAjoute; codesExistants.add(codeAjoute); }
      existante.autresNumeros.push(...numerosAjoutes);
      completes.push(numero);
      continue;
    }

    const prix = versNombre(donnees.prix);
    if (prix === null) { ignores.push(`Ligne ${numLigne} (${numero}) — prix manquant ou invalide`); continue; }

    const categorieTexte = (donnees.categorie || "").trim().toLowerCase();
    const categorieTrouvee = categories.find(
      (c) => c.code.toLowerCase() === categorieTexte || c.nom.toLowerCase() === categorieTexte
    );

    const fournisseurTexte = (donnees.fournisseur || "").trim().toLowerCase();
    const fournisseurTrouve = fournisseurTexte
      ? fournisseurs.find((f) => f.nom.toLowerCase() === fournisseurTexte)
      : null;

    const qteInitiale = versNombre(donnees.qte) || 0;
    // Un code-barres déjà pris par une autre pièce n'est pas mis dans le
    // champ dédié (il est unique) mais reste cherchable comme autre numéro,
    // plutôt que de faire échouer la ligne.
    const codeBarreLibre = codesUniques.find((c) => !codesExistants.has(c)) || null;
    const autresNumerosPiece = [...autresNumeros, ...codesUniques.filter((c) => c !== codeBarreLibre)];

    const piece = await prisma.piece.create({
      data: {
        nom,
        numero,
        codeBarre: codeBarreLibre,
        autresNumeros: autresNumerosPiece,
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
    piecesExistantes.set(numero.toLowerCase(), { id: piece.id, numero, codeBarre: codeBarreLibre, autresNumeros: autresNumerosPiece });
    if (codeBarreLibre) codesExistants.add(codeBarreLibre);
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

  return NextResponse.json({ importes, doublons, completes, ignores });
}
