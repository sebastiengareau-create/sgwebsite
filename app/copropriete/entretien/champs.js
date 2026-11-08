// Champs des formulaires de demande, de bon de travail et d'entretien —
// partagés par la liste et par les fiches
import {
  TYPES_DEMANDE, CATEGORIES_TRAVAUX, PRIORITES, TYPES_ENTRETIEN,
} from "@/lib/coproprieteCalculs";

const options = (liste, libelle = (x) => x.nom) => liste.map((x) => ({ code: x.id, label: libelle(x) }));

export function champsDemande({ unites, batiments, coproprietaires }) {
  return [
    { nom: "type", label: "Type", type: "choix", options: TYPES_DEMANDE, defaut: "REPARATION" },
    { nom: "priorite", label: "Priorité", type: "choix", options: PRIORITES, defaut: "NORMALE" },
    { nom: "titre", label: "Problème (en quelques mots)", pleineLargeur: true },
    { nom: "categorie", label: "Catégorie", type: "choix", vide: "—", options: CATEGORIES_TRAVAUX },
    { nom: "uniteId", label: "Unité", type: "choix", vide: "— parties communes —", options: options(unites, (u) => u.numero) },
    ...(batiments.length > 0 ? [{ nom: "batimentId", label: "Bâtiment", type: "choix", vide: "—", options: options(batiments) }] : []),
    { nom: "emplacement", label: "Endroit précis", placeholder: "Garage P1, toit, corridor 3e…" },
    { nom: "coproprietaireId", label: "Demandé par (copropriétaire)", type: "choix", vide: "—", options: options(coproprietaires) },
    { nom: "signalePar", label: "Ou signalé par", placeholder: "Concierge, locataire…" },
    { nom: "description", label: "Description", type: "long", lignes: 4 },
  ];
}

export function champsTravail({ unites, batiments, fournisseurs }) {
  return [
    { nom: "titre", label: "Travaux à faire", pleineLargeur: true },
    { nom: "fournisseurId", label: "Fournisseur", type: "choix", vide: "— à choisir —", options: options(fournisseurs) },
    { nom: "priorite", label: "Priorité", type: "choix", options: PRIORITES, defaut: "NORMALE" },
    { nom: "categorie", label: "Catégorie", type: "choix", vide: "—", options: CATEGORIES_TRAVAUX },
    { nom: "datePrevue", label: "Date prévue", type: "date" },
    { nom: "coutEstime", label: "Coût estimé ($)", type: "nombre" },
    { nom: "uniteId", label: "Unité", type: "choix", vide: "— parties communes —", options: options(unites, (u) => u.numero) },
    ...(batiments.length > 0 ? [{ nom: "batimentId", label: "Bâtiment", type: "choix", vide: "—", options: options(batiments) }] : []),
    { nom: "emplacement", label: "Endroit précis" },
    { nom: "description", label: "Description", type: "long", lignes: 3 },
  ];
}

// Champs de clôture d'un bon : coût réel, facture, garantie
export const champsCloture = [
  { nom: "dateFin", label: "Terminé le", type: "date" },
  { nom: "coutReel", label: "Coût réel ($)", type: "nombre" },
  { nom: "numeroFacture", label: "No de facture du fournisseur" },
  { nom: "garantieFin", label: "Garantie jusqu'au", type: "date" },
];

export function champsEntretien({ batiments, fournisseurs }) {
  return [
    { nom: "titre", label: "Entretien ou inspection", pleineLargeur: true },
    { nom: "type", label: "Type", type: "choix", options: TYPES_ENTRETIEN, defaut: "ENTRETIEN" },
    { nom: "categorie", label: "Catégorie", type: "choix", vide: "—", options: CATEGORIES_TRAVAUX },
    { nom: "frequenceMois", label: "Aux combien de mois", type: "nombre", defaut: "12" },
    { nom: "prochaineDate", label: "Prochaine date", type: "date" },
    { nom: "derniereDate", label: "Dernière fois", type: "date" },
    { nom: "fournisseurId", label: "Fournisseur habituel", type: "choix", vide: "—", options: options(fournisseurs) },
    { nom: "coutEstime", label: "Coût estimé ($)", type: "nombre" },
    ...(batiments.length > 0 ? [{ nom: "batimentId", label: "Bâtiment", type: "choix", vide: "—", options: options(batiments) }] : []),
    { nom: "emplacement", label: "Endroit" },
    { nom: "obligatoire", label: "Exigé par la loi, un règlement ou l'assureur", type: "case" },
    { nom: "actif", label: "Actif (dans le calendrier)", type: "case", defaut: true },
    { nom: "description", label: "Description / liste de vérification", type: "long", lignes: 3 },
  ];
}
