import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estDeveloppeur } from "@/lib/auth";
import { prochainNumeroFournisseur } from "@/lib/numerotation";
import { lireFeuille, analyserFeuille, ALIAS_COORDONNEES, nettoyerCoordonnees, noteDetection } from "@/lib/importFichier";

// En-têtes reconnus (sans accents, casse ni ponctuation) — en plus des
// coordonnées communes (lib/importFichier.js). La personne-ressource et le
// numéro de fournisseur sont reconnus pour ne pas être pris pour le nom.
const { prenom, ...COORDONNEES } = ALIAS_COORDONNEES;
const ALIAS_CHAMPS = {
  ...COORDONNEES,
  nom: [
    "nom", "name", "fournisseur", "nomfournisseur", "nom fournisseur", "nom du fournisseur", "compagnie", "nom compagnie",
    "entreprise", "nom entreprise", "nom de l entreprise", "raison sociale", "company", "company name", "supplier", "vendor", "vendor name",
  ],
  contact: ["contact", "nom du contact", "nom contact", "personne ressource", "representant", "contact name", ...prenom],
  numero: ["no fournisseur", "numero fournisseur", "numero du fournisseur", "code fournisseur", "id fournisseur", "vendor id", "id"],
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

  const analyse = analyserFeuille(feuille, ALIAS_CHAMPS);
  if (!analyse.champs.has("nom")) {
    return NextResponse.json({ erreur: "Aucune colonne \"Nom\" trouvée dans le fichier." }, { status: 400 });
  }

  const nomsExistants = new Set(
    (await prisma.fournisseur.findMany({ select: { nom: true } })).map((f) => f.nom.toLowerCase())
  );

  let importes = 0;
  const doublons = [];
  const ignores = [];

  for (let numLigne = analyse.premiereLigne; numLigne <= feuille.rowCount; numLigne++) {
    const ligne = feuille.getRow(numLigne);
    if (!ligne.hasValues) continue;

    const brut = analyse.lire(ligne);
    const donnees = nettoyerCoordonnees(brut);
    const nom = donnees.nom;
    if (!nom) { ignores.push(`Ligne ${numLigne} — nom manquant`); continue; }

    if (nomsExistants.has(nom.toLowerCase())) {
      doublons.push(nom);
      continue;
    }

    await prisma.fournisseur.create({
      data: {
        numero: await prochainNumeroFournisseur(),
        nom,
        telephone: donnees.telephone,
        courriel: donnees.courriel,
        adresse: donnees.adresse,
        ville: donnees.ville,
        province: donnees.province,
        codePostal: donnees.codePostal,
      },
    });
    nomsExistants.add(nom.toLowerCase());
    importes++;
  }

  return NextResponse.json({ importes, doublons, ignores, note: noteDetection(analyse.detectees) });
}
