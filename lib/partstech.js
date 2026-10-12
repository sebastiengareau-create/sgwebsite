// PartsTech (agrégateur de fournisseurs de pièces) : recherche « punchout »
// depuis une commande de pièces en brouillon.
//
// 1. « 🔌 Chercher dans PartsTech » ouvre une session (ouvrirSession) : la
//    page PartsTech s'ouvre, l'employé compare les prix et le stock chez les
//    fournisseurs branchés au compte du garage.
// 2. « Submit Quote » chez PartsTech : PartsTech envoie le panier à
//    /api/partstech/panier/<jeton> (adresse publique, jeton secret propre à
//    la session), qui le stocke seulement (lirePanier). « Buy Now » n'est pas
//    offert : la commande se passe comme d'habitude, depuis l'appli.
// 3. De retour dans la commande, l'employé associe chaque fournisseur
//    PartsTech à un fournisseur de l'appli et ajoute le panier : la commande
//    ouverte pour son fournisseur, le brouillon des autres.
//
// Identifiants (POST /oauth/access, accès « user ») :
// - partenaire (l'éditeur du logiciel, entente avec PartsTech) : variables
//   PARTSTECH_PARTNER_ID et PARTSTECH_PARTNER_KEY du projet Railway ;
// - utilisateur (le compte PartsTech du garage) : Paramètres → PartsTech.
// PARTSTECH_API_URL : https://api.beta.partstech.com pour les essais.
// Référence : https://api-docs.partstech.com (spécification OpenAPI).
const { prisma } = require("./prisma");

const URL_API = (process.env.PARTSTECH_API_URL || "https://api.partstech.com").replace(/\/+$/, "");
const CLE_UTILISATEUR = "partstech_utilisateur";
const CLE_CLE = "partstech_cle";
// Un panier reçu plus tard que ça n'est plus accepté
const DUREE_SESSION_MS = 24 * 60 * 60 * 1000;

function partenaire() {
  const id = process.env.PARTSTECH_PARTNER_ID;
  const key = process.env.PARTSTECH_PARTNER_KEY;
  return id && key ? { id, key } : null;
}

// → { partenaire: bool, utilisateur: string, cleEnregistree: bool, actif: bool }
async function lireConfig() {
  const params = await prisma.parametre.findMany({ where: { cle: { in: [CLE_UTILISATEUR, CLE_CLE] } } });
  const dict = Object.fromEntries(params.map((p) => [p.cle, p.valeur]));
  const config = {
    partenaire: !!partenaire(),
    utilisateur: dict[CLE_UTILISATEUR] || "",
    cleEnregistree: !!dict[CLE_CLE],
  };
  return { ...config, actif: config.partenaire && !!config.utilisateur && config.cleEnregistree };
}

async function appeler(chemin, corps, jeton) {
  let res;
  try {
    res = await fetch(`${URL_API}${chemin}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(jeton && { Authorization: `Bearer ${jeton}` }) },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("PartsTech ne répond pas — réessaie dans un moment.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || `erreur ${res.status}`;
    if (res.status === 401) throw new Error(`PartsTech refuse les identifiants (${message}). Vérifie Paramètres → PartsTech.`);
    throw new Error(`PartsTech : ${message}`);
  }
  return data;
}

// Jeton d'accès « user » (valide 60 minutes) — un par session ouverte
async function jetonAcces() {
  const p = partenaire();
  if (!p) throw new Error("PartsTech n'est pas configuré pour cette installation (identifiants partenaire manquants).");
  const params = await prisma.parametre.findMany({ where: { cle: { in: [CLE_UTILISATEUR, CLE_CLE] } } });
  const dict = Object.fromEntries(params.map((x) => [x.cle, x.valeur]));
  if (!dict[CLE_UTILISATEUR] || !dict[CLE_CLE]) throw new Error("Entre l'utilisateur et la clé API PartsTech du garage dans Paramètres → PartsTech.");
  const data = await appeler("/oauth/access", {
    accessType: "user",
    credentials: { user: { id: dict[CLE_UTILISATEUR], key: dict[CLE_CLE] }, partner: p },
  });
  if (!data.accessToken) throw new Error("PartsTech n'a pas donné de jeton d'accès.");
  return data.accessToken;
}

// Ouvre une session de recherche → { sessionId, redirectUrl }. Sans véhicule,
// PartsTech ne cherche que par numéro de pièce (facultatif) ; sinon
// l'employé choisit le véhicule et cherche sur sa page. Sans callbackOrderUrl,
// PartsTech retire le bouton « Buy Now » : seul « Submit Quote » reste.
async function ouvrirSession({ numeroPiece, poNumber, callbackUrl, returnUrl }) {
  const jeton = await jetonAcces();
  const numero = String(numeroPiece || "").trim();
  const data = await appeler("/punchout/quote/create", {
    ...(numero && { searchParams: { partNumber: [numero] } }),
    urls: { callbackUrl, returnUrl },
    settings: { poNumber: poNumber || null },
  }, jeton);
  if (!data.redirectUrl) throw new Error("PartsTech n'a pas donné d'adresse de session.");
  return { sessionId: data.sessionId || null, redirectUrl: data.redirectUrl };
}

const texte = (v, max) => String(v ?? "").trim().slice(0, max);
const montant = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null);

// Panier reçu de PartsTech (callback « Submit Quote ») → forme gardée en
// base, regroupée par fournisseur PartsTech :
// { fournisseurs: [{ partstechId, nom, magasin, pieces: [{ numero, nom,
//   marque, qte, cout, liste, detail, consigne }] }] }
// cout : ce que le garage paie (sans consigne) ; detail : prix de vente
// calculé par PartsTech selon la majoration du garage, s'il y en a une.
function lirePanier(corps) {
  const fournisseurs = [];
  for (const commande of Array.isArray(corps?.orders) ? corps.orders.slice(0, 50) : []) {
    const pieces = (Array.isArray(commande?.parts) ? commande.parts.slice(0, 200) : [])
      .map((p) => ({
        numero: texte(p?.partNumber, 60),
        nom: texte(p?.partName, 150),
        qte: Number.isInteger(p?.quantity) && p.quantity > 0 ? Math.min(p.quantity, 999) : 1,
        cout: montant(p?.price?.cost) ?? montant(p?.price?.price),
        liste: montant(p?.price?.list),
        detail: montant(p?.price?.retail),
        consigne: montant(p?.price?.core) || 0,
      }))
      .filter((p) => p.numero);
    if (!pieces.length) continue;
    const id = Number.isInteger(commande?.supplier?.id) ? commande.supplier.id : null;
    const groupe = fournisseurs.find((f) => f.partstechId === id && id !== null);
    if (groupe) groupe.pieces.push(...pieces);
    else fournisseurs.push({ partstechId: id, nom: texte(commande?.supplier?.name, 100) || "Fournisseur PartsTech", magasin: texte(commande?.store?.name, 100), pieces });
  }
  return { fournisseurs };
}

module.exports = { CLE_UTILISATEUR, CLE_CLE, DUREE_SESSION_MS, lireConfig, jetonAcces, ouvrirSession, lirePanier };
