// Protection de la connexion.
//
// 1. Limite d'essais : trop de mots de passe ratés pour un même courriel, ou
//    depuis une même adresse IP, bloquent la connexion un moment — quelqu'un
//    qui essaie des mots de passe en boucle n'avance plus.
// 2. Double vérification (Administrateur → Modules) : après le bon mot de
//    passe, un gérant ou un niveau 4 reçoit un code à 6 chiffres par courriel.
//    Un appareil déjà vérifié n'est plus questionné pendant 30 jours (ou
//    jusqu'au changement du mot de passe).
import crypto from "crypto";
import { prisma } from "./prisma";
import { lireParametre } from "./parametres";

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

// ---------- Limite d'essais ----------

const FENETRE_MS = 15 * 60 * 1000;
const MAX_PAR_COURRIEL = 5;
const MAX_PAR_IP = 30; // plus large : tout un atelier peut sortir par la même adresse
const MAX_CODES = 5;

export function ipDeLaRequete(request) {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnue";
}

const cleCourriel = (courriel) => `courriel:${String(courriel || "").trim().toLowerCase().slice(0, 200)}`;
const cleIp = (ip) => `ip:${ip}`;
const cleCode = (userId) => `code:${userId}`;

// Minutes à attendre avant le prochain essai permis pour cette clé (0 : permis)
async function attente(cle, max) {
  const depuis = new Date(Date.now() - FENETRE_MS);
  const essais = await prisma.tentativeConnexion.findMany({ where: { cle, creeLe: { gte: depuis } }, orderBy: { creeLe: "desc" }, take: max, select: { creeLe: true } });
  if (essais.length < max) return 0;
  // Débloqué quand le plus ancien des `max` derniers essais sort de la fenêtre
  const fin = essais[essais.length - 1].creeLe.getTime() + FENETRE_MS;
  return Math.max(1, Math.ceil((fin - Date.now()) / 60000));
}

export async function minutesDeBlocage(courriel, ip) {
  const [parCourriel, parIp] = await Promise.all([attente(cleCourriel(courriel), MAX_PAR_COURRIEL), attente(cleIp(ip), MAX_PAR_IP)]);
  return Math.max(parCourriel, parIp);
}

export async function noterEchec(courriel, ip) {
  await prisma.tentativeConnexion.createMany({ data: [{ cle: cleCourriel(courriel) }, { cle: cleIp(ip) }] });
  // Ménage : rien de plus vieux qu'un jour ne sert
  prisma.tentativeConnexion.deleteMany({ where: { creeLe: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } }).catch(() => {});
}

// Connexion réussie : le compteur de ce courriel repart à zéro
export async function effacerEchecs(courriel) {
  await prisma.tentativeConnexion.deleteMany({ where: { cle: cleCourriel(courriel) } }).catch(() => {});
}

export function messageBlocage(minutes) {
  return `Trop d'essais. Réessaie dans ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}

// ---------- Double vérification ----------

export const COOKIE_CODE = "garage_code"; // code en attente de saisie
export const COOKIE_APPAREIL = "garage_appareil"; // appareil déjà vérifié
const DUREE_CODE_MS = 10 * 60 * 1000;
export const DUREE_APPAREIL_S = 30 * 24 * 3600;
const ROLES_VERIFIES = ["GERANT", "NIVEAU4"];

export async function doubleVerificationRequise(utilisateur) {
  if (!ROLES_VERIFIES.includes(utilisateur.role) && !utilisateur.estSuperAdmin) return false;
  return (await lireParametre("module_double_verification")) === "actif";
}

function hmac(texte, cle = SECRET) {
  return crypto.createHmac("sha256", cle).update(texte).digest("base64url");
}
function egal(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function scelle(objet, cle) {
  const corps = Buffer.from(JSON.stringify(objet)).toString("base64url");
  return `${corps}.${hmac(corps, cle)}`;
}
function descelle(jeton, cle) {
  const [corps, signature] = String(jeton || "").split(".");
  if (!corps || !signature || !egal(signature, hmac(corps, cle))) return null;
  try {
    const objet = JSON.parse(Buffer.from(corps, "base64url").toString());
    return objet.exp > Date.now() ? objet : null;
  } catch {
    return null;
  }
}

// Nouveau code à 6 chiffres → { code, jeton } : le jeton (témoin du
// navigateur) ne contient que l'empreinte du code, jamais le code lui-même
export function nouveauCode(userId) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  return { code, jeton: scelle({ id: userId, c: hmac(`${userId}:${code}`), exp: Date.now() + DUREE_CODE_MS }) };
}

// → { userId } si le code est bon ; sinon { erreur, expire } (expire : il
// faut recommencer la connexion). Cinq mauvais codes bloquent 15 minutes.
export async function verifierCode(jeton, code) {
  const attendu = descelle(jeton);
  if (!attendu) return { erreur: "Ce code a expiré. Recommence la connexion.", expire: true };
  const minutes = await attente(cleCode(attendu.id), MAX_CODES);
  if (minutes) return { erreur: messageBlocage(minutes), expire: true };
  const propre = String(code || "").replace(/\D/g, "");
  if (!egal(hmac(`${attendu.id}:${propre}`), attendu.c)) {
    await prisma.tentativeConnexion.create({ data: { cle: cleCode(attendu.id) } });
    return { erreur: "Code incorrect." };
  }
  await prisma.tentativeConnexion.deleteMany({ where: { cle: cleCode(attendu.id) } }).catch(() => {});
  return { userId: attendu.id };
}

// Témoin « appareil déjà vérifié » : lié au mot de passe haché, donc changer
// le mot de passe redemande un code sur tous les appareils
export function jetonAppareil(utilisateur) {
  return scelle({ id: utilisateur.id, exp: Date.now() + DUREE_APPAREIL_S * 1000 }, SECRET + utilisateur.motDePasse);
}
export function appareilVerifie(jeton, utilisateur) {
  return descelle(jeton, SECRET + utilisateur.motDePasse)?.id === utilisateur.id;
}

// « j•••@domaine.com » : rappelle où le code est parti sans afficher l'adresse
export function masquerCourriel(courriel) {
  const [nom, domaine] = String(courriel).split("@");
  return domaine ? `${nom.slice(0, 1)}•••@${domaine}` : courriel;
}
