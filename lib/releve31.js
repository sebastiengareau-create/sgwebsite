// Relevés 31 en PDF (lib/pdfReleve31.js) : données des baux et du
// propriétaire, communes à la page Relevé 31 du propriétaire
// (/api/immobilier/releves31/pdf) et au portail du locataire
// (/api/portail-locataire/<jeton>/releves31/<id>).

import { prisma } from "./prisma";
import { bailAu31Decembre, donneesReleve31 } from "./immobilierCalculs";
import { obtenirInfosEntreprise } from "./config";
import { lireLocateur } from "./locateurImmo";
import { releves31Pdf } from "./pdfReleve31";

// Baux de logement en cours le 31 décembre de l'année (tous, ou ceux de bailIds)
// → [{ bailId, rl }] triés par immeuble et logement
export async function relevesDeLAnnee(annee, { bailIds } = {}) {
  const baux = await prisma.bailImmo.findMany({
    where: {
      ...(bailIds ? { id: { in: bailIds } } : {}),
      dateDebut: { lte: new Date(Date.UTC(annee, 11, 31, 23)) },
      OR: [{ dateFin: null }, { dateFin: { gte: new Date(Date.UTC(annee, 11, 31)) } }],
      logement: { type: "LOGEMENT" },
    },
    select: {
      id: true, dateDebut: true, dateFin: true, terminaisonLe: true,
      locataires: { select: { nom: true }, orderBy: { nom: "asc" } },
      logement: { select: { numero: true, type: true, numeroLogementRq: true, adresseCivique: true, immeuble: { select: { nom: true, adresse: true, ville: true, codePostal: true } } } },
    },
  });
  return baux
    .filter((b) => bailAu31Decembre(b, annee))
    .sort((a, b) => a.logement.immeuble.nom.localeCompare(b.logement.immeuble.nom) || a.logement.numero.localeCompare(b.logement.numero, "fr", { numeric: true }))
    .map((b) => ({ bailId: b.id, rl: donneesReleve31(b) }));
}

// Propriétaire inscrit sur le relevé : la fiche du locateur (ou l'entreprise)
export async function proprietaireReleve31() {
  const entreprise = await obtenirInfosEntreprise();
  const { locateurs } = await lireLocateur(entreprise);
  const l = locateurs[0] || {};
  return {
    nom: locateurs.map((x) => x.nom).filter(Boolean).join(" et ") || entreprise.nomEntreprise || "",
    adresse: [[l.no, l.rue].filter(Boolean).join(" ") + (l.app ? `, app. ${l.app}` : ""), l.ville, l.codePostal].filter(Boolean).join(", "),
    telephone: l.telephone || "",
  };
}

// PDF des relevés ; locataire : seulement la copie de ce locataire (nom)
export async function pdfReleves31(annee, releves, { copieProprietaire = false, locataire } = {}) {
  return releves31Pdf({ annee, releves, proprietaire: await proprietaireReleve31(), copieProprietaire, locataire });
}
