// Approbation d'une soumission en ligne par le client.
//
// Chaque soumission peut avoir un lien secret (jetonClient) vers une page
// publique (/soumission/<jeton>) : le client y voit sa soumission, coche les
// tâches qu'il accepte, signe du doigt et approuve — ou refuse. Sa réponse
// est notée sur la soumission et l'atelier en est avisé ; c'est toujours
// l'atelier qui transforme ensuite la soumission en bon (ou en facture),
// seulement avec les tâches approuvées.
//
// Modifier la soumission efface la réponse : le client a approuvé autre chose.
import crypto from "crypto";
import { prisma } from "./prisma";

export const REPONSE_VIDE = { reponseClient: null, reponseLe: null, signataireNom: null, signatureClient: null, noteClient: null };

function adressePublique() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function lienSoumission(jeton) {
  return `${adressePublique()}/soumission/${jeton}`;
}

// Lien de la soumission, créé au premier besoin
export async function assurerLienSoumission(soumissionId) {
  const s = await prisma.soumission.findUnique({ where: { id: soumissionId }, select: { jetonClient: true } });
  if (!s) return null;
  if (s.jetonClient) return lienSoumission(s.jetonClient);
  const jeton = crypto.randomBytes(24).toString("base64url");
  await prisma.soumission.update({ where: { id: soumissionId }, data: { jetonClient: jeton } });
  return lienSoumission(jeton);
}

export { peutRepondre, tachesRetenues, totauxTaches } from "./approbationCalculs";
