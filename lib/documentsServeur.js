// Section Documents, côté serveur : qui peut gérer quels modèles, et
// validation d'un modèle reçu. Voir lib/documents.js.
import { aAccesSection, nomAffichageRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import { DESTINATAIRES, valeursCommunes, valeursEmploye, valeursClient } from "@/lib/documents";

// Module Documents : inactif tant que le super-administrateur ne l'active
// pas dans Administrateur → Modules (offert ou non au client)
export async function documentsActif() {
  const p = await prisma.parametre.findUnique({ where: { cle: "module_documents" } });
  return p?.valeur === "actif";
}

// Module actif et section Documents (Administrateur → Rôles et accès),
// plus : la section Employés pour un modèle pour employés (il peut afficher
// un salaire), la section Clients pour un modèle pour clients
export async function peutGererDestinataire(session, destinataire) {
  const d = DESTINATAIRES[destinataire];
  return !!d && (await documentsActif()) && (await aAccesSection(session, "documents")) && (await aAccesSection(session, d.section));
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
  // Signée par la personne responsable (Informations de l'entreprise),
  // sinon par la personne connectée
  const signataire = entreprise.personneResponsable || session.nom;
  const communes = valeursCommunes({ entreprise, signataire, aujourdhui: dateAujourdhuiQuebec() });
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

// Note un envoi dans l'historique des courriels. personnes : [{ nom, a }] ;
// echecs : résultat d'envoyerCourriels. Une erreur ici n'annule pas l'envoi,
// déjà fait.
export async function noterEnvoi({ session, modele, groupe, sujet, texte, personnes, echecs }) {
  const erreurParAdresse = new Map(echecs.map((e) => [e.a, e.erreur]));
  const destinataires = personnes.map(({ nom, a }) => (erreurParAdresse.has(a) ? { nom, a, erreur: erreurParAdresse.get(a) } : { nom, a }));
  try {
    await prisma.envoiCourrielDocument.create({
      data: {
        envoyePar: session.nom || "",
        modeleNom: modele.nom,
        destinataire: modele.destinataire,
        groupe,
        sujet,
        texte,
        nbEnvoyes: destinataires.filter((d) => !d.erreur).length,
        nbEchecs: destinataires.filter((d) => d.erreur).length,
        destinataires,
      },
    });
  } catch (e) {
    console.error("Historique des courriels non noté :", e.message);
  }
}
