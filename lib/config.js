// ============================================================
// CONFIGURATION DU CLIENT — à modifier pour chaque nouveau garage
// ============================================================
// Le comportement propre à un client (type de véhicules, logo…) est dans
// lib/client.js ; voir GUIDE-NOUVEAU-CLIENT.md pour une nouvelle installation.
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
  ville: "",
  province: "",
  codePostal: "",
  telephone: "",
  courriel: "",
};

const CLES_PARAMETRE = {
  nomEntreprise: "entreprise_nom",
  descriptionCourte: "entreprise_description",
  adresseLigne1: "entreprise_adresse1",
  adresseLigne2: "entreprise_adresse2",
  ville: "entreprise_ville",
  province: "entreprise_province",
  codePostal: "entreprise_code_postal",
  telephone: "entreprise_telephone",
  courriel: "entreprise_courriel",
};

// Fonction principale — à utiliser partout dans l'appli. Retourne les
// valeurs configurées en base si présentes, sinon les défauts ci-dessus.
// Le code postal est ajouté à la fin de adresseLigne2 (s'il n'y est pas
// déjà), pour qu'il paraisse sur tous les documents ; { brut: true } garde
// les champs tels que saisis, pour le formulaire qui les modifie.
// adresseLigne2 (« Ville, QC ») est ce qu'affichent les documents ; le
// formulaire la recompose à partir de la ville et de la province.
async function obtenirInfosEntreprise({ brut = false } = {}) {
  const { prisma } = require("./prisma");
  const parametres = await prisma.parametre.findMany({ where: { cle: { in: Object.values(CLES_PARAMETRE) } } });
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  const infos = {};
  for (const [champ, cle] of Object.entries(CLES_PARAMETRE)) {
    infos[champ] = dict[cle] !== undefined && dict[cle] !== "" ? dict[cle] : DEFAUTS[champ];
  }
  // Installation d'avant la ville et la province séparées : on les tire de
  // la ligne 2 pour préremplir le formulaire
  if (brut && !infos.ville && infos.adresseLigne2) {
    const { decouperVille } = require("./adresse");
    const { ville, province, codePostal } = decouperVille(infos.adresseLigne2);
    infos.ville = ville || "";
    infos.province ||= province || "";
    infos.codePostal ||= codePostal || "";
  }
  const sansEspaces = (t) => t.replace(/\s+/g, "").toUpperCase();
  if (!brut && infos.codePostal && !sansEspaces(infos.adresseLigne2).includes(sansEspaces(infos.codePostal))) {
    infos.adresseLigne2 = [infos.adresseLigne2, infos.codePostal].filter(Boolean).join(" ");
  }
  return infos;
}

module.exports = { ...DEFAUTS, obtenirInfosEntreprise, DEFAUTS, CLES_PARAMETRE };