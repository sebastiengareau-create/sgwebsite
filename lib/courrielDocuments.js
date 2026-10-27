// Envoi par courriel des lettres de la section Documents (une à la fois,
// ou groupé à plusieurs clients), avec Resend comme les factures.
// Chaque courriel à un client porte au bas un lien de désabonnement : la
// loi canadienne anti-pourriel (LCAP) l'exige pour un message commercial,
// avec le nom et l'adresse de l'expéditeur.
import crypto from "crypto";

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const TAILLE_LOT = 100; // maximum de Resend par envoi groupé

export function courrielConfigure() {
  return !!process.env.RESEND_API_KEY;
}

export function courrielValide(adresse) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse || "");
}

// Jeton du lien de désabonnement : prouve que le lien vient bien d'un de
// nos courriels, sans compte ni connexion
export function jetonDesabonnement(clientId) {
  return crypto.createHmac("sha256", SECRET).update(`desabonnement:${clientId}`).digest("hex").slice(0, 32);
}
export function jetonDesabonnementValide(clientId, jeton) {
  const attendu = Buffer.from(jetonDesabonnement(clientId));
  const recu = Buffer.from(String(jeton || ""));
  return recu.length === attendu.length && crypto.timingSafeEqual(recu, attendu);
}
function lienDesabonnement(clientId) {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/desabonnement?c=${encodeURIComponent(clientId)}&t=${jetonDesabonnement(clientId)}`;
}

function echapper(texte) {
  return String(texte).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Un courriel prêt pour Resend. clientId : destinataire client — ajoute le
// pied de page (coordonnées + désabonnement) ; absent pour un employé.
export function preparerCourriel({ a, sujet, texte, entreprise, clientId = null }) {
  const coordonnees = [entreprise.nomEntreprise, entreprise.adresseLigne1, entreprise.adresseLigne2, entreprise.telephone].filter(Boolean).join(" · ");
  const lien = clientId ? lienDesabonnement(clientId) : null;
  const pied = lien ? `\n\n—\n${coordonnees}\nPour ne plus recevoir nos promotions par courriel : ${lien}` : "";

  const html = `<div style="font-family:Arial,sans-serif;color:#17150f;max-width:640px;margin:0 auto">
<div style="font-size:18px;font-weight:700;border-bottom:2px solid #17150f;padding-bottom:10px;margin-bottom:20px">${echapper(entreprise.nomEntreprise)}</div>
<div style="white-space:pre-wrap;font-size:14px;line-height:1.6">${echapper(texte)}</div>
${lien ? `<div style="margin-top:32px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#777;line-height:1.5">${echapper(coordonnees)}<br><a href="${echapper(lien)}" style="color:#777">Ne plus recevoir nos promotions par courriel</a></div>` : ""}
</div>`;

  return {
    from: `${entreprise.nomEntreprise} <${process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"}>`,
    to: a,
    // Les réponses vont à l'entreprise, pas à l'adresse d'envoi technique
    ...(courrielValide(entreprise.courriel) ? { replyTo: entreprise.courriel } : {}),
    subject: sujet,
    text: texte + pied,
    html,
    ...(lien ? { headers: { "List-Unsubscribe": `<${lien}>` } } : {}),
  };
}

// Envoie les courriels par lots de 100. Retourne { envoyes, echecs:
// [{ a, erreur }] } — un lot refusé compte en échec pour tous ses courriels.
export async function envoyerCourriels(courriels) {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  let envoyes = 0;
  const echecs = [];
  for (let i = 0; i < courriels.length; i += TAILLE_LOT) {
    const lot = courriels.slice(i, i + TAILLE_LOT);
    if (i > 0) await new Promise((r) => setTimeout(r, 600)); // limite de Resend : 2 envois par seconde
    try {
      const { error } = lot.length === 1 ? await resend.emails.send(lot[0]) : await resend.batch.send(lot);
      if (error) throw new Error(error.message || JSON.stringify(error));
      envoyes += lot.length;
    } catch (e) {
      echecs.push(...lot.map((c) => ({ a: c.to, erreur: e.message })));
    }
  }
  return { envoyes, echecs };
}
