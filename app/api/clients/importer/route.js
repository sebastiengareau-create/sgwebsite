import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estDeveloppeur } from "@/lib/auth";
import { prochainNumeroClient } from "@/lib/numerotation";
import { lireFeuille, analyserFeuille, ALIAS_COORDONNEES, nettoyerCoordonnees, noteDetection } from "@/lib/importFichier";

// En-têtes reconnus (sans accents, casse ni ponctuation) — en plus des
// coordonnées communes (lib/importFichier.js). « No client » est reconnu
// pour ne pas être pris pour le nom.
const ALIAS_CHAMPS = {
  ...ALIAS_COORDONNEES,
  nom: [
    "nom", "name", "client", "nomclient", "nom client", "nom du client", "nom complet", "full name",
    "nom de famille", "last name", "lastname", "customer", "customer name", "contact", "nom prenom",
  ],
  garantieProlongee: ["garantie", "garantie prolongee", "no garantie", "numero garantie", "contrat garantie"],
  numero: ["no client", "numero client", "numero du client", "code client", "id client", "customer id", "id"],
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
    (await prisma.client.findMany({ select: { nom: true } })).map((c) => c.nom.toLowerCase())
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

    await prisma.client.create({
      data: {
        numero: await prochainNumeroClient(),
        nom,
        telephone: donnees.telephone,
        courriel: donnees.courriel,
        adresse: donnees.adresse,
        ville: donnees.ville,
        province: donnees.province,
        codePostal: donnees.codePostal,
        garantieProlongee: brut.garantieProlongee || null,
      },
    });
    nomsExistants.add(nom.toLowerCase()); // évite un doublon interne au même fichier
    importes++;
  }

  return NextResponse.json({ importes, doublons, ignores, note: noteDetection(analyse.detectees) });
}
