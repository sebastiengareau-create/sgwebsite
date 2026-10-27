// Section Documents, côté serveur : qui peut gérer quels modèles, et
// validation d'un modèle reçu. Voir lib/documents.js.
import { aAccesSection } from "@/lib/auth";
import { DESTINATAIRES } from "@/lib/documents";

// Un modèle pour employés se gère avec l'accès à la section Employés (il
// peut afficher un salaire) ; un modèle pour clients, avec la section Clients
export async function peutGererDestinataire(session, destinataire) {
  const d = DESTINATAIRES[destinataire];
  return !!d && (await aAccesSection(session, d.section));
}

// Destinataires dont la personne peut gérer et rédiger les modèles
export async function destinatairesPermis(session) {
  const permis = [];
  for (const cle of Object.keys(DESTINATAIRES)) {
    if (await peutGererDestinataire(session, cle)) permis.push(cle);
  }
  return permis;
}

// { nom, destinataire, contenu } → { donnees } ou { erreur }
export function validerModele(corps) {
  const nom = String(corps.nom || "").trim();
  const contenu = String(corps.contenu || "").trim();
  const destinataire = corps.destinataire;
  if (!nom) return { erreur: "Le nom du modèle est requis." };
  if (!Object.hasOwn(DESTINATAIRES, destinataire || "")) return { erreur: "Destinataire invalide." };
  if (!contenu) return { erreur: "Le texte du modèle est vide." };
  return { donnees: { nom, destinataire, contenu } };
}
