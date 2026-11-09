// Facture comptoir — vente de pièces de l'inventaire ou de services qui n'a
// rien à voir avec un véhicule ni avec de la main-d'œuvre (client qui passe
// acheter une pièce, frais de service…).
//
// C'est un bon de travail ordinaire marqué `comptoir` : même fiche, mêmes
// lignes, pièces, escompte, dépôts, facture et paiements. Il n'a pas de
// véhicule, ne s'inscrit pas au calendrier, n'a pas de poinçon et
// n'apparaît pas dans la vue des mécaniciens.
//
// Client de passage (sans dossier) : un client interne unique, créé au
// premier besoin et retrouvé ensuite par son id gardé dans les paramètres.
import { prisma } from "./prisma";
import { prochainNumeroClient, creerAvecNumero } from "./numerotation";

const CLE_CLIENT_PASSAGE = "client_comptoir_passage";
export const NOM_CLIENT_PASSAGE = "Client de passage";

// Ligne créée avec la facture quand aucune n'est entrée
export const LIGNE_COMPTOIR_DEFAUT = "Vente au comptoir";

export async function obtenirClientPassage() {
  const param = await prisma.parametre.findUnique({ where: { cle: CLE_CLIENT_PASSAGE } });
  if (param?.valeur) {
    const client = await prisma.client.findUnique({ where: { id: param.valeur } });
    if (client) return client;
  }
  const client = await creerAvecNumero(prochainNumeroClient, (numero) => prisma.client.create({ data: { numero, nom: NOM_CLIENT_PASSAGE } }));
  await prisma.parametre.upsert({
    where: { cle: CLE_CLIENT_PASSAGE },
    update: { valeur: client.id },
    create: { cle: CLE_CLIENT_PASSAGE, valeur: client.id },
  });
  return client;
}
