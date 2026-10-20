// Avertissement « bon non facturé en cours » à la création d'un bon (profil
// avertirBonNonFacture). Aucune dépendance serveur : sert au formulaire du
// nouveau bon et aux routes qui créent un bon (lib/bons.js trouve les bons).
import { bonEstAVenir, dateCourteQuebec } from "./regroupementDates";

const STATUTS = { EN_ATTENTE: "en attente", EN_COURS: "en cours" };

// bons : [{ numero, statut, datePrevue }]
export function messageBonsNonFactures(nomClient, bons) {
  const liste = bons.map((b) => {
    const etat = bonEstAVenir(b) ? `planifié le ${dateCourteQuebec(b.datePrevue)}` : STATUTS[b.statut] || b.statut;
    return `#${b.numero} (${etat})`;
  }).join(", ");
  return bons.length > 1
    ? `⚠️ ${nomClient} a déjà ${bons.length} bons non facturés en cours : ${liste}.`
    : `⚠️ ${nomClient} a déjà un bon non facturé en cours : ${liste}.`;
}

export const QUESTION_BON_NON_FACTURE = "Créer quand même un nouveau bon ?";
