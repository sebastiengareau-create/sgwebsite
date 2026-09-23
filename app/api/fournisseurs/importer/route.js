import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estDeveloppeur } from "@/lib/auth";
import { prochainNumeroFournisseur } from "@/lib/numerotation";
import { lireFeuille, mapperEntetes, lireLigne } from "@/lib/importFichier";

const ALIAS_CHAMPS = {
  nom: ["nom", "name", "fournisseur", "nomfournisseur"],
  telephone: ["telephone", "tel", "phone", "cell", "cellulaire"],
  courriel: ["courriel", "email", "courriel electronique", "e mail", "adresse courriel"],
  adresse: ["adresse", "address"],
  ville: ["ville", "city"],
  codePostal: ["codepostal", "code postal", "postal", "zip", "zipcode"],
};

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
  if (!Object.values(mappage).includes("nom")) {
    return NextResponse.json({ erreur: "Aucune colonne \"Nom\" trouvée dans la première ligne du fichier." }, { status: 400 });
  }

  const nomsExistants = new Set(
    (await prisma.fournisseur.findMany({ select: { nom: true } })).map((f) => f.nom.toLowerCase())
  );

  let importes = 0;
  const doublons = [];
  const ignores = [];

  for (let numLigne = 2; numLigne <= feuille.rowCount; numLigne++) {
    const ligne = feuille.getRow(numLigne);
    if (!ligne.hasValues) continue;

    const donnees = lireLigne(ligne, mappage);
    const nom = (donnees.nom || "").trim();
    if (!nom) { ignores.push(`Ligne ${numLigne} — nom manquant`); continue; }

    if (nomsExistants.has(nom.toLowerCase())) {
      doublons.push(nom);
      continue;
    }

    await prisma.fournisseur.create({
      data: {
        numero: await prochainNumeroFournisseur(),
        nom,
        telephone: donnees.telephone || null,
        courriel: donnees.courriel || null,
        adresse: donnees.adresse || null,
        ville: donnees.ville || null,
        codePostal: donnees.codePostal || null,
      },
    });
    nomsExistants.add(nom.toLowerCase());
    importes++;
  }

  return NextResponse.json({ importes, doublons, ignores });
}
