// Bail officiel du TAL : le bail d'un logement se remplit et se signe sur la
// plateforme du Tribunal administratif du logement (formulaire obligatoire,
// toujours à jour), puis le PDF signé se dépose dans les documents du bail
// (catégorie BAIL_TAL). kontrolshop ne se connecte pas à la plateforme : la
// fiche ci-dessous reprend les données du bail dans l'ordre des sections du
// formulaire, pour les recopier. Fonctions pures (fiche du bail, tests).

import {
  MODES_PAIEMENT, CHAUFFAGES, ANIMAUX, FUMEUR, servicesListe, dureeMois, libelle, dateLisible,
} from "./immobilierCalculs";
import { argent } from "./format";

export const URL_BAIL_TAL = "https://www.tal.gouv.qc.ca/fr/bail-electronique";
export { CATEGORIE_BAIL_TAL, JOURS_CONSERVATION_TAL, estReconduction, loyerPlusBas12Mois } from "./immobilierCalculs";

// Date à recopier dans les cases Jour / Mois / Année : « 01/07/2027 »
export function dateCases(d) {
  if (!d) return "";
  const x = new Date(d);
  const deux = (n) => String(n).padStart(2, "0");
  return `${deux(x.getUTCDate())}/${deux(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`;
}

// Montant à recopier, sans le symbole : « 1 025,00 »
const montant = (n) => (n == null ? "" : argent(n).replace(/\s*\$$/, ""));

const parQui = (compris) => (compris ? "Locateur" : "Locataire");

// champ : { libelle, valeur (affichée), copie (texte copié, sinon valeur),
// note, alerte, facultatif } — valeur vide : à inscrire sur la plateforme
// (sauf facultatif)
const champ = (libelleChamp, valeur, extra = {}) => ({ libelle: libelleChamp, valeur: valeur == null ? "" : String(valeur), ...extra });
const date = (libelleChamp, d, extra = {}) => champ(libelleChamp, d ? dateLisible(d) : "", { copie: dateCases(d), ...extra });

// Fiche du bail pour remplir le formulaire du TAL.
// bail : avec logement.immeuble et locataires ; entreprise : infos de
// l'entreprise (le locateur) ; loyerAncien : loyerPlusBas12Mois() du bail
// → [{ lettre, titre, groupes: [{ titre, champs }] }]
export function ficheBailTal({ bail, entreprise = {}, loyerAncien = null, maintenant = new Date() }) {
  const l = bail.logement || {};
  const i = l.immeuble || {};
  const services = new Set(servicesListe(bail.services));
  const duree = dureeMois(bail);
  const sections = [];

  // A — Les parties
  const entrepriseVide = (v) => (v ? {} : { note: "Dans Administrateur → Informations de l'entreprise." });
  const locataires = (bail.locataires || []).map((x, n) => ({
    titre: (bail.locataires.length > 1 ? `Locataire ${n + 1}` : "Le locataire"),
    champs: [
      champ("Nom", x.nom),
      champ("Adresse actuelle", "", { note: "Pas dans la fiche du locataire : à lui demander." }),
      champ("Téléphone", x.telephone),
      champ("Autre téléphone (cellulaire)", x.telephone2, { facultatif: true }),
      champ("Courriel", x.courriel, x.courriel ? {} : { alerte: "Il faut un courriel pour signer sur la plateforme du TAL." }),
    ],
  }));
  sections.push({
    lettre: "A", titre: "Entre le locateur et le locataire",
    groupes: [
      {
        titre: "Le locateur",
        champs: [
          champ("Nom", entreprise.nomEntreprise, entrepriseVide(entreprise.nomEntreprise)),
          champ("Adresse", [entreprise.adresseLigne1, entreprise.adresseLigne2].filter(Boolean).join(", "), entrepriseVide(entreprise.adresseLigne1)),
          champ("Municipalité", entreprise.ville, entrepriseVide(entreprise.ville)),
          champ("Code postal", entreprise.codePostal, entrepriseVide(entreprise.codePostal)),
          champ("Téléphone", entreprise.telephone, entrepriseVide(entreprise.telephone)),
          champ("Courriel", entreprise.courriel, entreprise.courriel ? {} : { alerte: "Il faut un courriel au locateur pour signer sur la plateforme du TAL (Administrateur → Informations de l'entreprise)." }),
          champ("Représenté par", entreprise.personneResponsable, { facultatif: true }),
        ],
      },
      ...locataires,
    ],
  });

  // B — Le logement
  const accessoires = [
    services.has("STATIONNEMENT") ? "Stationnement" : null,
    services.has("RANGEMENT") ? "Espace de rangement" : null,
    bail.accessoires,
  ].filter(Boolean).join(" · ");
  const appareils = [
    services.has("ELECTROMENAGERS") ? "Électroménagers (cuisinière, réfrigérateur…)" : null,
    services.has("LAVEUSE_SECHEUSE") ? "Laveuse et sécheuse" : null,
  ].filter(Boolean).join(" · ");
  sections.push({
    lettre: "B", titre: "Description et destination du logement",
    groupes: [{
      champs: [
        champ("Adresse", l.adresseCivique || i.adresse),
        champ("App.", l.adresseCivique ? "" : l.numero),
        champ("Municipalité", i.ville),
        champ("Code postal", i.codePostal),
        champ("Nombre de pièces", l.pieces),
        champ("Loué à des fins d'habitation seulement", bail.usageMixte ? "Non — aussi un usage professionnel ou commercial (au plus le tiers de la superficie)" : "Oui", { copie: bail.usageMixte ? "Non" : "Oui" }),
        champ("Unité d'une copropriété divise", "", { note: "À cocher selon l'immeuble." }),
        champ("Stationnement, rangement et autres accessoires", accessoires || "Aucun"),
        champ("Meubles loués et inclus dans le loyer", services.has("MEUBLE") ? "Oui" : "Non"),
        champ("Appareils fournis", appareils || "Aucun", appareils ? { note: "Coche chaque appareil fourni sur le formulaire." } : {}),
      ],
    }],
  });

  // C — Durée
  sections.push({
    lettre: "C", titre: "Durée du bail",
    groupes: [{
      champs: bail.dateFin
        ? [
          champ("Bail à durée fixe de", duree ? `${duree} mois` : ""),
          date("Du", bail.dateDebut),
          date("Au", bail.dateFin),
        ]
        : [
          champ("Bail à durée indéterminée", "Oui"),
          date("Commençant le", bail.dateDebut),
        ],
    }],
  });

  // D — Loyer
  sections.push({
    lettre: "D", titre: "Loyer",
    groupes: [{
      champs: [
        champ("Loyer par mois", argent(bail.loyer), { copie: montant(bail.loyer) }),
        date("Premier terme payé le", bail.premierPaiementLe || bail.dateDebut),
        champ("Autres termes : le paiement se fait le", bail.jourPaiement === 1 || !bail.jourPaiement ? "1er jour du mois" : `${bail.jourPaiement} de chaque mois`),
        champ("Mode de paiement", bail.modePaiement ? libelle(MODES_PAIEMENT, bail.modePaiement) : ""),
        champ("Chèques postdatés remis par le locataire", bail.chequesPostdates ? "Oui" : "Non"),
        champ("Lieu du paiement", bail.lieuPaiement, { facultatif: true, note: bail.lieuPaiement ? "" : "Rien d'inscrit : payable au domicile du locataire (art. 1566 C.c.Q.)." }),
      ],
    }],
  });

  // E — Services et conditions
  const autres = [
    services.has("INTERNET") ? "Internet compris dans le loyer" : null,
    bail.fumeur ? libelle(FUMEUR, bail.fumeur) : null,
    bail.assuranceResponsabilite ? "Le locataire détient une assurance responsabilité civile pendant le bail" : null,
    bail.conditions,
  ].filter(Boolean).join("\n");
  sections.push({
    lettre: "E", titre: "Services et conditions",
    groupes: [
      {
        champs: [
          date("Règlement de l'immeuble remis le", bail.reglementRemisLe, bail.reglementRemisLe ? {} : { note: "Seulement s'il existe un règlement : à remettre avant la conclusion du bail." }),
          champ("Travaux et réparations promis", bail.travauxPromis, { facultatif: true }),
        ],
      },
      {
        titre: "Services, taxes et coûts : assumés par",
        champs: [
          champ("Chauffage du logement", `${parQui(services.has("CHAUFFAGE"))}${bail.chauffage ? ` · ${libelle(CHAUFFAGES, bail.chauffage)}` : ""}`),
          champ("Eau chaude (frais d'utilisation)", parQui(services.has("EAU_CHAUDE"))),
          champ("Électricité (autre usage que le chauffage)", parQui(services.has("ELECTRICITE"))),
          champ("Déneigement et déglaçage", parQui(services.has("DENEIGEMENT"))),
        ],
      },
      {
        titre: "Conditions",
        champs: [
          champ("Animaux", bail.animaux ? libelle(ANIMAUX, bail.animaux) : ""),
          champ("Autres services, conditions et restrictions", autres, { facultatif: true }),
        ],
      },
    ],
  });

  // F — Immeuble neuf (5 ans ou moins)
  const anneeLimite = new Date(maintenant).getUTCFullYear() - 5;
  const recent = !bail.immeubleNeuf && i.anneeConstruction && i.anneeConstruction >= anneeLimite;
  sections.push({
    lettre: "F", titre: "Restrictions au droit à la fixation du loyer",
    groupes: [{
      champs: bail.immeubleNeuf
        ? [
          champ("Immeuble prêt pour l'habitation depuis 5 ans ou moins", "Oui (case à cocher)", { copie: "Oui" }),
          champ("Prêt pour l'habitation", i.anneeConstruction ? `en ${i.anneeConstruction}` : "", { note: "Inscris la date exacte sur le formulaire." }),
          champ("Hausse de loyer maximale pendant ces 5 ans", bail.hausseMaximaleF),
        ]
        : [champ("Immeuble prêt pour l'habitation depuis 5 ans ou moins", "Non — aucune case à cocher", { copie: "Non", ...(recent ? { alerte: `Immeuble construit en ${i.anneeConstruction} : vérifie si la section F s'applique (Bail → Modifier → Mentions).` } : {}) })],
    }],
  });

  // G — Avis au nouveau locataire (loyer le plus bas des 12 derniers mois)
  if (!bail.immeubleNeuf) {
    const valeur = bail.loyerAncien ?? loyerAncien?.montant ?? null;
    const note = bail.loyerAncien != null
      ? bail.loyerAncienNote || ""
      : loyerAncien
        ? `Calculé d'après ${loyerAncien.baux > 1 ? `les ${loyerAncien.baux} baux précédents` : "le bail précédent"} du logement dans l'appli : vérifie.`
        : "Aucun bail de ce logement dans l'appli pour ces 12 mois : inscris le loyer connu (Bail → Modifier → Mentions).";
    sections.push({
      lettre: "G", titre: "Avis au nouveau locataire",
      groupes: [{
        champs: [
          champ("Loyer le plus bas payé au cours des 12 mois précédant le début du bail", valeur != null ? `${argent(valeur)} par mois` : "", { copie: montant(valeur), note }),
          ...(bail.loyerAncien != null || !bail.loyerAncienNote ? [] : [champ("Précision", bail.loyerAncienNote)]),
        ],
      }],
    });
  }

  // H — Signatures
  sections.push({
    lettre: "H", titre: "Signatures",
    groupes: [{
      champs: [
        champ("Les locataires s'engagent solidairement", (bail.locataires || []).length > 1 ? "" : "Sans objet (un seul locataire)", (bail.locataires || []).length > 1 ? { note: "Oui ou Non, selon votre entente." } : {}),
        champ("Caution (autre signataire)", bail.caution, { facultatif: true }),
      ],
    }],
  });

  return sections;
}

// La fiche en texte, pour « Tout copier »
export function texteFiche(sections) {
  const lignes = [];
  for (const s of sections) {
    lignes.push("", `${s.lettre} — ${s.titre.toUpperCase()}`);
    for (const g of s.groupes) {
      if (g.titre) lignes.push(`  ${g.titre}`);
      for (const c of g.champs) lignes.push(`    ${c.libelle} : ${c.valeur || "—"}`);
    }
  }
  return lignes.join("\n").trim();
}

// Champs vides à inscrire et alertes, pour le résumé en tête de fiche
export function manquesFiche(sections) {
  const vides = [];
  const alertes = [];
  for (const s of sections) {
    for (const g of s.groupes) {
      for (const c of g.champs) {
        if (c.alerte) alertes.push(`${s.lettre} · ${c.alerte}`);
        if (!c.valeur && !c.note && !c.alerte && !c.facultatif) vides.push(`${s.lettre} · ${g.titre ? `${g.titre} — ` : ""}${c.libelle}`);
      }
    }
  }
  return { vides, alertes };
}
