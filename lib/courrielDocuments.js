// Envoi par courriel des lettres de la section Documents (une à la fois,
// ou groupé à plusieurs clients), avec Resend comme les factures.
// Chaque courriel à un client porte au bas un lien de désabonnement : la
// loi canadienne anti-pourriel (LCAP) l'exige pour un message commercial,
// avec le nom et l'adresse de l'expéditeur.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { image } from "./client";

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const TAILLE_LOT = 100; // maximum de Resend par envoi groupé
const CID_LOGO = "logo-entreprise";

function adressePublique() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

// Logo de l'en-tête, joint au courriel (affiché sans « charger les
// images »). null : pas de fichier de logo.
function pieceJointeLogo() {
  const chemin = path.join(process.cwd(), "public", image("logo.png"));
  if (!fs.existsSync(chemin)) return null;
  return { filename: "logo.png", content: fs.readFileSync(chemin).toString("base64"), contentType: "image/png", inlineContentId: CID_LOGO };
}

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
  return `${adressePublique()}/desabonnement?c=${encodeURIComponent(clientId)}&t=${jetonDesabonnement(clientId)}`;
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

  // En-tête comme la lettre imprimée : logo, nom, adresse et téléphone
  const logo = pieceJointeLogo();
  const lignesEntete = [entreprise.adresseLigne1, entreprise.adresseLigne2, [entreprise.telephone, entreprise.courriel].filter(Boolean).join(" · ")].filter(Boolean);
  const html = `<div style="font-family:Arial,sans-serif;color:#17150f;max-width:640px;margin:0 auto">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-bottom:2px solid #17150f;margin-bottom:20px"><tr>
${logo ? `<td style="width:62px;padding:0 12px 10px 0;vertical-align:middle"><img src="cid:${CID_LOGO}" alt="${echapper(entreprise.nomEntreprise)}" width="50" height="50" style="display:block;width:50px;height:50px;object-fit:contain"></td>` : ""}
<td style="padding-bottom:10px;vertical-align:middle"><div style="font-size:18px;font-weight:700">${echapper(entreprise.nomEntreprise)}</div>
${lignesEntete.length ? `<div style="font-size:12px;color:#666;line-height:1.4;margin-top:3px">${lignesEntete.map(echapper).join("<br>")}</div>` : ""}</td>
</tr></table>
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
    ...(logo ? { attachments: [logo] } : {}),
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
      // L'envoi groupé de Resend refuse les pièces jointes : le logo y est
      // une image de l'appli (adresse publique APP_URL)
      const groupe = lot.map(({ attachments, ...c }) => ({ ...c, html: c.html.replace(`cid:${CID_LOGO}`, `${adressePublique()}${image("logo.png")}`) }));
      const { error } = lot.length === 1 ? await resend.emails.send(lot[0]) : await resend.batch.send(groupe);
      if (error) throw new Error(error.message || JSON.stringify(error));
      envoyes += lot.length;
    } catch (e) {
      echecs.push(...lot.map((c) => ({ a: c.to, erreur: e.message })));
    }
  }
  return { envoyes, echecs };
}
