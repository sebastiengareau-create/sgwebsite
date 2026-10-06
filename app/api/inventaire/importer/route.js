import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estDeveloppeur } from "@/lib/auth";
import { alignerInventaireAuGL } from "@/lib/comptabilite";
import { lireFeuille, mapperEntetes, lireLigne } from "@/lib/importFichier";
import { separerUgs } from "@/lib/codesBarres";
import { prochainNumero } from "@/lib/numerotation";

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

// « 12,50 $ », « $1,234.56 », « 1 234,56 » → nombre ; vide ou illisible
// (« N/D », « — ») → null. Quand virgule et point sont tous deux présents,
// le dernier des deux est le séparateur décimal.
function versNombre(texte) {
  if (texte === undefined || texte === null || texte === "") return null;
  let t = String(texte).replace(/[^0-9.,\-]/g, "");
  if (t.includes(",") && t.includes(".")) {
    t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else {
    t = t.replace(",", ".");
  }
  if (!/\d/.test(t)) return null;
  const n = Number(t);
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
  // Il faut de quoi identifier une pièce : un nom ou un numéro (le reste
  // peut manquer et se complète ensuite dans la fiche).
  if (!["nom", "numero", "ugs", "codeBarre"].some((c) => colonnes.includes(c))) {
    return NextResponse.json({ erreur: "Le fichier doit avoir au moins une colonne \"Nom\" ou \"Numéro\" (ou \"UGS\")." }, { status: 400 });
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
  const sansPrix = []; // importées quand même, prix de vente à 0 $ à compléter
  const numerosGeneres = []; // pièces sans numéro dans le fichier

  for (let numLigne = 2; numLigne <= feuille.rowCount; numLigne++) {
    const ligne = feuille.getRow(numLigne);
    if (!ligne.hasValues) continue;

    const donnees = lireLigne(ligne, mappage);
    const ugs = separerUgs(donnees.ugs);
    const codeBarreFichier = (donnees.codeBarre || "").replace(/\s+/g, "");
    // Sans colonne Numéro, le premier numéro UGS (sinon le code-barres)
    // devient le numéro de référence ; les autres restent des numéros qui
    // renvoient à la pièce.
    let numero = (donnees.numero || "").trim() || ugs.numeros[0] || codeBarreFichier || "";
    // Sans nom, le numéro en tient lieu (et inversement, un numéro est attribué)
    const nom = (donnees.nom || "").trim() || numero;
    if (!nom) { ignores.push(`Ligne ${numLigne} — ni nom ni numéro`); continue; }
    if (!numero) {
      numero = await prochainNumero(prisma.piece, "numero", "PIECE");
      numerosGeneres.push(`${nom} → ${numero}`);
    }
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

    // Prix de vente ou coûtant absent : la pièce est importée quand même, à 0 $
    const prix = versNombre(donnees.prix);
    if (prix === null) sansPrix.push(numero);

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
        prix: prix ?? 0,
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

  // Ce qui manquait dans le fichier : importé quand même, à compléter
  const liste = (t) => t.slice(0, 20).join(", ") + (t.length > 20 ? "…" : "");
  const pluriel = (n) => (n !== 1 ? "s" : "");
  const notes = [];
  if (sansPrix.length > 0) notes.push(`${sansPrix.length} pièce${pluriel(sansPrix.length)} sans prix de vente — importée${pluriel(sansPrix.length)} à 0 $, à compléter dans la fiche : ${liste(sansPrix)}`);
  if (numerosGeneres.length > 0) notes.push(`${numerosGeneres.length} pièce${pluriel(numerosGeneres.length)} sans numéro — numéro attribué : ${liste(numerosGeneres)}`);
  const note = notes.join(" · ") || null;

  return NextResponse.json({ importes, doublons, completes, ignores, note });
}
