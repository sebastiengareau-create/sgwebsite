const CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
const CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;
const REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI;
const ENVIRONNEMENT = process.env.QUICKBOOKS_ENVIRONMENT || "sandbox";

const URL_AUTORISATION = "https://appcenter.intuit.com/connect/oauth2";
const URL_JETONS = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// L'adresse de base de l'API change selon qu'on est en test (Sandbox) ou
// en vrai compte client (Production)
function urlBaseApi() {
  return ENVIRONNEMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

// Étape 1 : construit le lien vers lequel envoyer le gérant pour qu'il
// autorise la connexion depuis son compte QuickBooks
function urlConnexion(etat) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    state: etat,
  });
  return `${URL_AUTORISATION}?${params.toString()}`;
}

// Étape 2 : échange le code reçu après autorisation contre de vrais jetons d'accès
async function echangerCodeContreJetons(code) {
  const identifiants = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(URL_JETONS, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${identifiants}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error(`Échange de jetons échoué (${res.status}) : ${await res.text()}`);
  return res.json(); // { access_token, refresh_token, expires_in, ... }
}

// Renouvelle l'accès une fois qu'il expire (les jetons QuickBooks expirent après 1h)
async function rafraichirJetons(refreshToken) {
  const identifiants = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(URL_JETONS, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${identifiants}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Rafraîchissement des jetons échoué (${res.status}) : ${await res.text()}`);
  return res.json();
}

module.exports = { urlConnexion, echangerCodeContreJetons, rafraichirJetons, urlBaseApi };
