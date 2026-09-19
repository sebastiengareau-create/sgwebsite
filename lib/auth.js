const bcrypt = require("bcryptjs");
const { cookies } = require("next/headers");

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const COOKIE_NAME = "garage_session";
const encoder = new TextEncoder();

// ---------- Mots de passe ----------

async function hashPassword(motDePasse) {
  return bcrypt.hash(motDePasse, 10);
}

async function verifyPassword(motDePasse, hash) {
  return bcrypt.compare(motDePasse, hash);
}

// ---------- Jeton de session signé ----------
// Utilise l'API Web Crypto (globalThis.crypto) plutôt que le module Node
// "crypto" : ça fonctionne autant dans les pages normales que dans le
// middleware (qui tourne dans un environnement limité, "Edge Runtime",
// où le module Node "crypto" n'est pas disponible).

async function signer(payload) {
  const cle = await crypto.subtle.importKey(
    "raw", encoder.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cle, encoder.encode(payload));
  return Buffer.from(signature).toString("hex");
}

async function creerJetonSession({ id, role, nom }) {
  const payload = Buffer.from(JSON.stringify({ id, role, nom })).toString("base64url");
  const signature = await signer(payload);
  return `${payload}.${signature}`;
}

async function verifierJeton(jeton) {
  if (!jeton) return null;
  const [payload, signature] = jeton.split(".");
  if (!payload || !signature) return null;
  const attendu = await signer(payload);
  if (attendu !== signature) return null; // jeton falsifié
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

// ---------- Session côté serveur (App Router) ----------

async function obtenirSession() {
  const store = await cookies();
  const jeton = store.get(COOKIE_NAME)?.value;
  const session = await verifierJeton(jeton);
  if (!session || session.role === "DEVELOPPEUR") return session;
  // Revérifié à chaque appel (pas seulement à la connexion) : un employé
  // désactivé pendant qu'il est déjà connecté perd l'accès immédiatement,
  // pas seulement à sa prochaine tentative de connexion.
  const { prisma } = require("./prisma");
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { actif: true } });
  if (!utilisateur || !utilisateur.actif) return null;
  return session;
}

// Rôles autorisés à voir une page. GERANT et DEVELOPPEUR ont toujours accès
// à tout — DEVELOPPEUR est un accès à part, jamais lié à un compte employé
// (voir estGerantOuDev), donc jamais supprimable par un gérant de garage.
function estAutorise(session, rolesPermis) {
  if (!session) return false;
  if (session.role === "GERANT" || session.role === "DEVELOPPEUR") return true;
  return rolesPermis.includes(session.role);
}

// Vrai pour un gérant normal, le niveau 4 (accès complet garanti, voir
// NIVEAU_ROLE), ou le développeur — pratique partout où le code vérifiait
// seulement `role === "GERANT"` jusqu'ici.
function estGerantOuDev(session) {
  return session?.role === "GERANT" || session?.role === "NIVEAU4" || session?.role === "DEVELOPPEUR";
}

// Défauts codés en dur, utilisés seulement si jamais configurés autrement
// dans Administrateur — préserve le comportement actuel tant que personne
// n'a touché aux réglages. GERANT reçoit toutes les sections par défaut : il
// était auparavant un accès total non configurable (voir aAccesSection),
// donc son passage au système configurable ne doit rien retirer tant que
// personne ne va explicitement décocher quelque chose dans Rôles et accès.
const TOUTES_SECTIONS = ["operations", "calendrier", "clients", "fournisseurs", "inventaire", "comptabilite", "paie", "employes", "vue-ensemble", "jobs-temps-reel"];
const DEFAUTS_INITIAUX_ROLE = {
  GERANT: TOUTES_SECTIONS,
  SECRETAIRE: ["operations", "calendrier", "clients", "inventaire"],
  MECANICIEN: [],
};

// Hiérarchie numérique des rôles employés (le développeur est à part,
// toujours au-dessus — voir estGerantOuDev, il n'a pas de "niveau" ici et
// n'est jamais un rôle stocké sur un User) : sert à empêcher un employé avec
// accès délégué à "employes" (ex: une secrétaire) de modifier ou supprimer
// la fiche de quelqu'un d'un niveau de sécurité supérieur au sien (rôle,
// mot de passe, activation…), ou de s'assigner/assigner à quelqu'un d'autre
// un rôle plus élevé que le sien.
const NIVEAU_ROLE = { MECANICIEN: 1, SECRETAIRE: 2, GERANT: 3, NIVEAU4: 4 };
const ROLES_VALIDES = Object.keys(NIVEAU_ROLE); // rôles assignables à un employé, du plus bas au plus haut niveau

function niveauRole(role) {
  return NIVEAU_ROLE[role] || 0;
}

// Vrai seulement pour le niveau 4 ou le développeur — plus étroit que
// estGerantOuDev. Sert uniquement à la hiérarchie de gestion des employés
// (app/api/utilisateurs) : même un GERANT (niveau 3) ne doit pas pouvoir
// modifier/supprimer la fiche de quelqu'un d'un niveau supérieur au sien
// (ici, niveau 4) — sinon on retombe dans le même bug qu'une secrétaire
// pouvant toucher un gérant, juste décalé d'un cran.
function estNiveauMaxOuDev(session) {
  return session?.role === "NIVEAU4" || session?.role === "DEVELOPPEUR";
}

function parseListe(valeur) {
  return (valeur || "").split(",").map((s) => s.trim()).filter(Boolean);
}

// Vérifie l'accès à une section précise (ex: "comptabilite", "operations").
// Vrai si : niveau 4/développeur (accès total, non configurable), OU la
// section fait partie des défauts configurables de son rôle (voir
// Administrateur → Rôles et accès) — GERANT y est inclus comme les autres
// rôles depuis l'ajout du niveau 4, mais démarre avec tout activé par
// défaut (voir DEFAUTS_INITIAUX_ROLE) tant que rien n'est décoché.
async function aAccesSection(session, cle) {
  if (estNiveauMaxOuDev(session)) return true;
  if (!session?.role) return false;
  const { prisma } = require("./prisma");

  const parametreRole = await prisma.parametre.findUnique({ where: { cle: `role_defaut_${session.role}` } });
  const defauts = parametreRole ? parseListe(parametreRole.valeur) : (DEFAUTS_INITIAUX_ROLE[session.role] || []);
  return defauts.includes(cle);
}

// Retourne le nom d'affichage d'un rôle — le nom personnalisé s'il a été
// changé dans Administrateur (ex: "Mécanicien" renommé "Plombier"), sinon
// le nom standard.
async function nomAffichageRole(role) {
  const NOMS_STANDARD = { GERANT: "Gérant", SECRETAIRE: "Secrétaire", MECANICIEN: "Mécanicien", NIVEAU4: "Niveau 4", DEVELOPPEUR: "Développeur" };
  if (role === "DEVELOPPEUR") return NOMS_STANDARD.DEVELOPPEUR;
  const { prisma } = require("./prisma");
  const parametre = await prisma.parametre.findUnique({ where: { cle: `nom_role_${role}` } });
  return parametre?.valeur || NOMS_STANDARD[role] || role;
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  creerJetonSession,
  verifierJeton,
  obtenirSession,
  estAutorise,
  estGerantOuDev,
  estNiveauMaxOuDev,
  NIVEAU_ROLE,
  ROLES_VALIDES,
  niveauRole,
  aAccesSection,
  nomAffichageRole,
  DEFAUTS_INITIAUX_ROLE,
};
