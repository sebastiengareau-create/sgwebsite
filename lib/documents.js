// Section Documents : modèles de lettres (référence d'emploi, promotion aux
// clients…) dont les champs entre accolades — {nom}, {date_embauche}… — se
// remplissent à partir de la fiche de l'employé ou du client choisi. Le
// texte rempli reste modifiable avant l'impression. Aucune dépendance
// serveur ici : le remplissage se fait aussi dans le navigateur.

export const DESTINATAIRES = {
  EMPLOYE: { libelle: "Employé", section: "employes" },
  CLIENT: { libelle: "Client", section: "clients" },
};

// Champs offerts dans tous les modèles
const CHAMPS_COMMUNS = {
  date: "Date du jour",
  entreprise: "Nom de l'entreprise",
  adresse_entreprise: "Adresse de l'entreprise",
  ville_entreprise: "Ville de l'entreprise",
  telephone_entreprise: "Téléphone de l'entreprise",
  courriel_entreprise: "Courriel de l'entreprise",
  signataire: "Ton nom (signature)",
};

export const CHAMPS = {
  EMPLOYE: {
    nom: "Nom de l'employé",
    poste: "Poste (assignation, sinon rôle)",
    date_embauche: "Date d'embauche",
    salaire: "Salaire annuel ou taux horaire",
    numero_employe: "Numéro d'employé",
    adresse: "Adresse de l'employé",
    ...CHAMPS_COMMUNS,
  },
  CLIENT: {
    nom: "Nom du client",
    adresse: "Adresse du client",
    telephone: "Téléphone du client",
    courriel: "Courriel du client",
    numero_client: "Numéro de client",
    ...CHAMPS_COMMUNS,
  },
};

// Modèles créés une seule fois par installation (voir
// assurerModelesDocuments) ; ensuite modifiables ou supprimables. Les
// crochets [ … ] marquent ce qu'il reste à écrire à la main.
export const MODELES_BASE = [
  {
    nom: "Lettre de référence",
    destinataire: "EMPLOYE",
    contenu: `{ville_entreprise}, le {date}

À qui de droit,

Objet : Lettre de référence — {nom}

Nous confirmons par la présente que {nom} est à l'emploi de {entreprise} depuis le {date_embauche}, au poste de {poste}.

Sa rémunération actuelle est de {salaire}.

[Ajoutez ici un mot sur son travail, sa fiabilité ou ses qualités.]

Pour tout renseignement supplémentaire, n'hésitez pas à communiquer avec nous au {telephone_entreprise}.

Veuillez agréer, Madame, Monsieur, nos salutations distinguées.


{signataire}
{entreprise}`,
  },
  {
    nom: "Lettre de promotion",
    destinataire: "CLIENT",
    contenu: `{ville_entreprise}, le {date}

{nom}
{adresse}

Objet : [Titre de la promotion]

Bonjour {nom},

Merci de votre confiance envers {entreprise}. Pour vous remercier, nous avons le plaisir de vous offrir [décrivez l'offre : rabais, service gratuit…], valable jusqu'au [date de fin].

Pour en profiter, présentez cette lettre lors de votre prochaine visite ou prenez rendez-vous au {telephone_entreprise}.

Au plaisir de vous revoir,


{signataire}
{entreprise}`,
  },
];

const CLE_MODELES_CREES = "documents_modeles_base";

// Crée les modèles de base la première fois — jamais par la suite, pour
// qu'un modèle supprimé ne revienne pas.
export async function assurerModelesDocuments(prisma) {
  const deja = await prisma.parametre.findUnique({ where: { cle: CLE_MODELES_CREES } });
  if (deja) return;
  try {
    await prisma.parametre.create({ data: { cle: CLE_MODELES_CREES, valeur: "oui" } });
  } catch {
    return; // créé au même moment par une autre requête
  }
  await prisma.modeleDocument.createMany({ data: MODELES_BASE });
}

function dateLongue(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
function montant(n) {
  return Number(n).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}
function adresseEnLignes(fiche) {
  return [fiche.adresse, [fiche.ville, fiche.province].filter(Boolean).join(" "), fiche.codePostal].filter(Boolean).join("\n");
}

// aujourdhui : « AAAA-MM-JJ » (heure du Québec)
export function valeursCommunes({ entreprise, signataire, aujourdhui }) {
  return {
    date: dateLongue(aujourdhui),
    entreprise: entreprise.nomEntreprise,
    adresse_entreprise: [entreprise.adresseLigne1, entreprise.adresseLigne2].filter(Boolean).join("\n"),
    ville_entreprise: entreprise.ville || "",
    telephone_entreprise: entreprise.telephone,
    courriel_entreprise: entreprise.courriel,
    signataire,
  };
}

// tauxGlobal : taux horaire des Paramètres, pour un employé à l'heure sans
// taux propre ; nomRole : nom affiché de son rôle
export function valeursEmploye(employe, { tauxGlobal, nomRole }) {
  const taux = employe.tauxHoraireEmploye || tauxGlobal;
  const salaire = employe.typeRemuneration === "SALAIRE"
    ? (employe.salaireAnnuel ? `${montant(employe.salaireAnnuel)} par année` : "")
    : (taux ? `${montant(taux)} de l'heure` : "");
  return {
    nom: employe.nom,
    poste: employe.assignation || nomRole || "",
    // Date choisie sans heure, enregistrée à minuit UTC
    date_embauche: employe.dateEmbauche ? dateLongue(new Date(employe.dateEmbauche).toISOString().slice(0, 10)) : "",
    salaire,
    numero_employe: employe.numeroEmploye || "",
    adresse: adresseEnLignes(employe),
  };
}

export function valeursClient(client) {
  return {
    nom: client.nom,
    adresse: adresseEnLignes(client),
    telephone: client.telephone || "",
    courriel: client.courriel || "",
    numero_client: client.numero || "",
  };
}

// Remplace chaque {champ} connu ; un champ vide dans la fiche devient
// « [Date d'embauche ?] », bien visible, à compléter avant d'imprimer.
// Avec effacerVides (envoi groupé, où personne ne relit chaque courriel),
// il disparaît plutôt, avec sa ligne s'il était seul dessus.
// Un {texte} inconnu reste tel quel.
export function remplirModele(contenu, valeurs, destinataire, { effacerVides = false } = {}) {
  const champs = CHAMPS[destinataire] || {};
  const remplacer = (texte) => texte.replace(/\{([a-z_]+)\}/g, (tout, cle) => {
    if (!Object.hasOwn(champs, cle)) return tout;
    const valeur = valeurs[cle];
    if (valeur) return String(valeur);
    return effacerVides ? "" : `[${champs[cle]} ?]`;
  });
  if (!effacerVides) return remplacer(contenu);
  return contenu.split("\n").flatMap((ligne) => {
    const remplie = remplacer(ligne);
    return ligne.trim() && !remplie.trim() ? [] : remplie.split("\n");
  }).join("\n");
}

// Sujet proposé pour un courriel : la ligne « Objet : … » de la lettre,
// sinon le nom du modèle
export function sujetParDefaut(texte, nomModele) {
  return texte.match(/^\s*Objet\s*:\s*(.+)$/m)?.[1].trim() || nomModele;
}

// Passages encore à compléter : [ … ] laissés par le modèle ou par un champ vide
export function passagesACompleter(texte) {
  return texte.match(/\[[^\]\n]+\]/g) || [];
}
