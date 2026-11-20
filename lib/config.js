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
  personneResponsable: "", // signe les lettres de la section Documents
  numeroEmployeurArc: "", // compte de retenues sur la paie de l'ARC (ex. 123456789RP0001) — feuillets T4
  numeroEmployeurRq: "", // numéro d'identification de Revenu Québec, dossier RS (ex. 1234567890RS0001) — RL-1
  conditionsGenerales: "", // texte légal en petits caractères au bas de la soumission, du bon et de la facture (vide = rien)
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
  personneResponsable: "entreprise_personne_responsable",
  numeroEmployeurArc: "entreprise_numero_arc",
  numeroEmployeurRq: "entreprise_numero_rq",
  conditionsGenerales: "entreprise_conditions_generales",
};

// Texte suggéré pour les conditions générales — le bouton « Insérer le
// texte suggéré » du formulaire le copie dans le champ, à compléter
// (montants entre crochets) avant de sauvegarder.
const MODELE_CONDITIONS_GENERALES = `CONDITIONS GÉNÉRALES
1. Garantie. Les travaux et pièces sont garantis selon les modalités convenues par écrit. Les joints de scellant (toit, fenêtres, carrosserie, compartiments, etc.) ne sont pas garantis, leur durabilité dépendant de facteurs hors de notre contrôle (vieillissement, intempéries, vibrations, mouvement de la structure). Le propriétaire est responsable de leur inspection et de leur entretien périodiques.
2. Entreposage. Le véhicule doit être récupéré dans les [3] jours ouvrables suivant l'avis que les travaux sont terminés. Passé ce délai, des frais d'entreposage de [__ $] par jour pourront s'appliquer.
3. Carburant. Le véhicule doit être remis à l'atelier avec un niveau de carburant suffisant. Si le véhicule est remis avec un niveau bas, des frais additionnels de [__ $] pourront être facturés, en plus du coût du carburant requis pour les essais et la livraison.
4. Objets personnels. L'atelier n'est pas responsable des objets personnels laissés dans le véhicule.
5. Limitation de responsabilité. Sous réserve des droits que la loi ne permet pas d'écarter, la responsabilité de l'atelier est limitée au montant de la facture pour les travaux concernés. L'atelier n'est pas responsable des dommages indirects (perte de jouissance, frais de déplacement, hébergement, etc.).
6. Paiement. Le solde est payable à la livraison. L'atelier se réserve le droit de retenir le véhicule jusqu'au paiement complet.
7. Autorisation et acceptation. Le client reconnaît avoir autorisé les travaux décrits, avoir pris connaissance des présentes conditions et les accepter. Toute pièce remplacée est jetée sauf demande contraire à la prise en charge.`;

// Fonction principale — à utiliser partout dans l'appli. Retourne les
// valeurs configurées en base si présentes, sinon les défauts ci-dessus.
// Le code postal est ajouté à la fin de adresseLigne2 (s'il n'y est pas
// déjà), pour qu'il paraisse sur tous les documents ; { brut: true } garde
// les champs tels que saisis, pour le formulaire qui les modifie.
// adresseLigne2 (« Ville, QC ») est ce qu'affichent les documents ; le
// formulaire la recompose à partir de la ville et de la province.
// Mémorisée le temps d'une requête (lib/parametres.js) : métadonnées, en-tête et
// page la demandent chacun.
async function obtenirInfosEntreprise({ brut = false } = {}) {
  const { lireParametres } = require("./parametres");
  const dict = await lireParametres(Object.values(CLES_PARAMETRE));

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

// En-tête des factures : adresse, ville (et province), code postal,
// téléphone et courriel, un en dessous de l'autre ; les vides sont omis.
// Une installation sans ville séparée garde sa ligne 2 (« Ville, QC »),
// sans le code postal qui a sa propre ligne.
function lignesEnteteEntreprise(infos) {
  const sansEspaces = (t) => (t || "").replace(/\s+/g, "").toUpperCase();
  let ville = infos.ville ? [infos.ville, infos.province].filter(Boolean).join(", ") : (infos.adresseLigne2 || "");
  if (!infos.ville && infos.codePostal && sansEspaces(ville).endsWith(sansEspaces(infos.codePostal))) {
    // Retire le code postal ajouté à la fin de la ligne 2
    const cible = sansEspaces(infos.codePostal);
    for (let i = ville.length; i >= 0; i--) {
      if (sansEspaces(ville.slice(i)) === cible) { ville = ville.slice(0, i).trim().replace(/,$/, ""); break; }
    }
  }
  return [infos.adresseLigne1, ville, infos.codePostal, infos.telephone, infos.courriel].map((l) => (l || "").trim()).filter(Boolean);
}

module.exports = { ...DEFAUTS, obtenirInfosEntreprise, lignesEnteteEntreprise, DEFAUTS, CLES_PARAMETRE, MODELE_CONDITIONS_GENERALES };