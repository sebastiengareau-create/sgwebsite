// Section Documents, côté serveur : qui peut gérer quels modèles, et
// validation d'un modèle reçu. Voir lib/documents.js.
import { aAccesSection, nomAffichageRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import { DESTINATAIRES, valeursCommunes, valeursEmploye, valeursClient } from "@/lib/documents";

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

// Fiche complète de l'employé (sans mot de passe ni NIP) ou du client
export function chargerFiche(destinataire, id) {
  return destinataire === "EMPLOYE"
    ? prisma.user.findUnique({ where: { id }, omit: { motDePasse: true, pin: true } })
    : prisma.client.findUnique({ where: { id } });
}

// Valeurs des champs pour remplir un modèle. Préparé une fois (entreprise,
// date, signataire, taux), puis appelé pour chaque fiche.
export async function preparerValeurs(session, destinataire) {
  const [entreprise, parametreTaux] = await Promise.all([
    obtenirInfosEntreprise(),
    destinataire === "EMPLOYE" ? prisma.parametre.findUnique({ where: { cle: "cout_horaire_mecanicien" } }) : null,
  ]);
  const communes = valeursCommunes({ entreprise, signataire: session.nom, aujourdhui: dateAujourdhuiQuebec() });
  return {
    entreprise,
    pour: async (fiche) => ({
      ...communes,
      ...(destinataire === "EMPLOYE"
        ? valeursEmploye(fiche, { tauxGlobal: Number(parametreTaux?.valeur) || null, nomRole: await nomAffichageRole(fiche.role) })
        : valeursClient(fiche)),
    }),
  };
}
