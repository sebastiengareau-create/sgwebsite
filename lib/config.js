// ============================================================
// CONFIGURATION DU CLIENT — à modifier pour chaque nouveau garage
// ============================================================
// C'est le SEUL fichier à changer pour adapter ce modèle à un nouveau
// client. Le reste de l'application lit ces valeurs automatiquement.
//
// Pour créer une nouvelle installation :
// 1. Copie le dossier complet du projet
// 2. Change les valeurs ci-dessous
// 3. Remplace le fichier public/logo.png par le logo du nouveau client
// 4. Crée une nouvelle base de données (nouveau projet Railway)
// ============================================================

// ============================================================
// CONFIGURATION DU CLIENT — valeurs par défaut, modifiables ensuite
// directement dans l'appli via Administrateur → Informations de l'entreprise
// ============================================================
// Ces valeurs ne servent que de point de départ pour une toute nouvelle
// installation — une fois configurées dans l'appli, ce sont les valeurs en
// base de données (table Parametre) qui priment. Voir obtenirInfosEntreprise()
// ci-dessous, utilisée partout ailleurs dans le code.
// ============================================================

const DEFAUTS = {
  nomEntreprise: "Ton Entreprise",
  descriptionCourte: "Gestion de garage — bons de travail, horodateur, inventaire",
  adresseLigne1: "",
  adresseLigne2: "",
  telephone: "",
  courriel: "",
};

const CLES_PARAMETRE = {
  nomEntreprise: "entreprise_nom",
  descriptionCourte: "entreprise_description",
  adresseLigne1: "entreprise_adresse1",
  adresseLigne2: "entreprise_adresse2",
  telephone: "entreprise_telephone",
  courriel: "entreprise_courriel",
};

// Fonction principale — à utiliser partout dans l'appli. Retourne les
// valeurs configurées en base si présentes, sinon les défauts ci-dessus.
async function obtenirInfosEntreprise() {
  const { prisma } = require("./prisma");
  const parametres = await prisma.parametre.findMany({ where: { cle: { in: Object.values(CLES_PARAMETRE) } } });
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  const infos = {};
  for (const [champ, cle] of Object.entries(CLES_PARAMETRE)) {
    infos[champ] = dict[cle] !== undefined && dict[cle] !== "" ? dict[cle] : DEFAUTS[champ];
  }
  return infos;
}

module.exports = { ...DEFAUTS, obtenirInfosEntreprise, DEFAUTS, CLES_PARAMETRE };