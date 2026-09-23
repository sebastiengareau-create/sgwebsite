import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estDeveloppeur, hashPassword, nomAffichageRole, ROLES_VALIDES } from "@/lib/auth";
import { prochainNumeroEmploye } from "@/lib/numerotation";
import { lireFeuille, mapperEntetes, lireLigne } from "@/lib/importFichier";

const ALIAS_CHAMPS = {
  nom: ["nom", "name", "employe", "nom employe", "nom complet"],
  courriel: ["courriel", "email", "e mail", "adresse courriel", "courriel electronique"],
  motDePasse: ["mot de passe", "motdepasse", "password", "mdp"],
  role: ["role", "niveau", "niveau acces"],
  telephone: ["telephone", "tel", "phone", "cell", "cellulaire"],
  adresse: ["adresse", "address"],
  ville: ["ville", "city"],
  codePostal: ["codepostal", "code postal", "postal", "zip", "zipcode"],
  assignation: ["assignation", "poste", "specialite", "titre"],
  dateEmbauche: ["date embauche", "date d'embauche", "embauche", "hire date"],
};

const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

// Sans caractères ambigus (0/O, 1/l/I) — le mot de passe temporaire est lu
// à voix haute ou copié à la main.
const ALPHABET_MDP = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function motDePasseTemporaire() {
  return Array.from({ length: 8 }, () => ALPHABET_MDP[randomInt(ALPHABET_MDP.length)]).join("");
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
  const champsPresents = Object.values(mappage);
  if (!champsPresents.includes("nom")) {
    return NextResponse.json({ erreur: "Aucune colonne \"Nom\" trouvée dans la première ligne du fichier." }, { status: 400 });
  }

  // Un rôle se reconnaît par son code (GERANT) ou par son nom affiché, y
  // compris un nom personnalisé (Administrateur → Rôles et accès).
  const roleParTexte = {};
  for (const r of ROLES_VALIDES) {
    roleParTexte[norm(r)] = r;
    roleParTexte[norm(await nomAffichageRole(r))] = r;
  }

  const existants = await prisma.user.findMany({ select: { courriel: true, nom: true } });
  const courrielsExistants = new Set(existants.map((u) => u.courriel.toLowerCase()));
  const nomsExistants = new Set(existants.map((u) => u.nom.toLowerCase()));

  let importes = 0;
  const doublons = [];
  const ignores = [];
  const identifiants = []; // à noter : identifiant généré et/ou mot de passe temporaire

  for (let numLigne = 2; numLigne <= feuille.rowCount; numLigne++) {
    const ligne = feuille.getRow(numLigne);
    if (!ligne.hasValues) continue;

    const donnees = lireLigne(ligne, mappage);
    const nom = (donnees.nom || "").trim();
    let courriel = (donnees.courriel || "").trim();
    if (!nom) { ignores.push(`Ligne ${numLigne} — nom manquant`); continue; }
    if (courriel && !courriel.includes("@")) { ignores.push(`Ligne ${numLigne} (${nom}) — courriel invalide`); continue; }

    // Sans courriel, le doublon se détecte par le nom
    if (courriel ? courrielsExistants.has(courriel.toLowerCase()) : nomsExistants.has(nom.toLowerCase())) {
      doublons.push(courriel || nom);
      continue;
    }

    // Rôle vide = niveau le plus bas (Mécanicien) ; un rôle écrit mais non
    // reconnu bloque la ligne plutôt que de deviner un niveau d'accès.
    let role = "MECANICIEN";
    if ((donnees.role || "").trim()) {
      role = roleParTexte[norm(donnees.role)];
      if (!role) { ignores.push(`Ligne ${numLigne} (${nom}) — rôle "${donnees.role}" non reconnu`); continue; }
    }

    let motDePasse = (donnees.motDePasse || "").trim();
    const genere = !motDePasse;
    if (genere) {
      motDePasse = motDePasseTemporaire();
    } else if (motDePasse.length < 4 || motDePasse.length > 12) {
      ignores.push(`Ligne ${numLigne} (${nom}) — mot de passe de 4 à 12 caractères requis`);
      continue;
    }

    let dateEmbauche = null;
    if ((donnees.dateEmbauche || "").trim()) {
      const d = new Date(donnees.dateEmbauche);
      if (isNaN(d.getTime())) { ignores.push(`Ligne ${numLigne} (${nom}) — date d'embauche invalide`); continue; }
      dateEmbauche = d;
    }

    // Le courriel est obligatoire et unique en base (c'est aussi l'identifiant
    // de connexion) : sans courriel dans le fichier, on génère un identifiant
    // unique à partir du numéro d'employé, modifiable ensuite sur la fiche.
    const numeroEmploye = await prochainNumeroEmploye();
    const courrielGenere = !courriel;
    if (courrielGenere) courriel = `${numeroEmploye.toLowerCase()}@sans-courriel.local`;

    await prisma.user.create({
      data: {
        nom,
        courriel,
        motDePasse: await hashPassword(motDePasse),
        role,
        telephone: donnees.telephone || null,
        adresse: donnees.adresse || null,
        ville: donnees.ville || null,
        codePostal: donnees.codePostal || null,
        assignation: donnees.assignation || null,
        numeroEmploye,
        dateEmbauche,
      },
    });
    courrielsExistants.add(courriel.toLowerCase());
    nomsExistants.add(nom.toLowerCase());
    if (genere || courrielGenere) {
      identifiants.push({ nom, courriel, motDePasse: genere ? motDePasse : "(celui du fichier)" });
    }
    importes++;
  }

  return NextResponse.json({ importes, doublons, ignores, motsDePasse: identifiants });
}
