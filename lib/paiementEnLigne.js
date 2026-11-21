// Paiement en ligne (module « module_paiement_en_ligne », inactif par
// défaut ; Administrateur → Modules), avec Stripe.
//
// Chaque installation a son propre compte Stripe : sa clé secrète
// (STRIPE_SECRET_KEY) et le secret de son avis de paiement
// (STRIPE_WEBHOOK_SECRET) sont des variables de son projet Railway. Le client
// paie sur la page de paiement de Stripe (Checkout) : aucune donnée de carte
// ne passe par kontrolshop.
//
// Trois façons de payer :
//  - le solde d'une facture, depuis sa page publique /payer/<jeton> (lien
//    dans le courriel de la facture, ou par texto) ;
//  - un dépôt après l'approbation en ligne d'une soumission ;
//  - un dépôt après l'approbation en ligne des travaux d'une inspection.
// Le dépôt demandé est un pourcentage du total approuvé (Paramètres →
// Paiement en ligne ; vide : pas de dépôt).
//
// Quand Stripe confirme le paiement (/api/stripe/webhook, avis signé), il est
// inscrit comme au comptoir (lib/paiementsFactures.js, lib/depots.js) —
// mode « carte de crédit », référence « Stripe pi_… » — dans le compte de
// trésorerie « Paiements en ligne (Stripe) ». Les frais de Stripe passent en
// dépense (5290, frais bancaires). L'atelier en est avisé. Un paiement qui
// ne peut pas s'inscrire tout seul (ex. facture payée entretemps au
// comptoir) reste « à traiter », visible dans Paramètres.
import crypto from "crypto";
import { prisma } from "./prisma";
import { lireParametre, lireParametres } from "./parametres";
import { notifier } from "./notifications";
import { enregistrerPaiements, soldeFacture } from "./paiementsFactures";
import { enregistrerDepots } from "./depots";
import { moduleComptabiliteActif, assurerPlanComptable, creerManquants, enregistrerEcriture } from "./comptabilite";
import { tachesRetenues, totauxTaches } from "./approbationCalculs";
import { pointsRecommandes, totauxRecommandes } from "./grillesInspection";
import { argent } from "./format";

export const CLE_MODULE_PAIEMENT = "module_paiement_en_ligne";
export const CLE_DEPOT_POURCENT = "paiement_depot_pourcent";
export const AUTEUR_PAIEMENT = "Paiement en ligne (Stripe)";
const COMPTE_STRIPE = "1020";
const COMPTE_FRAIS = "5290"; // Frais bancaires et professionnels
const arrondir = (n) => Math.round(n * 100) / 100;

export const stripeConfigure = () => !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
export const modeTestStripe = () => String(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");

// Module actif et Stripe configuré
export async function paiementEnLigneActif() {
  return stripeConfigure() && (await lireParametre(CLE_MODULE_PAIEMENT)) === "actif";
}

// Pourcentage du dépôt demandé en ligne (1 à 100), ou null : pas de dépôt
export async function lirePourcentDepot() {
  const n = Number(String((await lireParametre(CLE_DEPOT_POURCENT)) ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}

function adressePublique() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

// ---------- Stripe ----------

// Paramètres en formulaire, à la façon de Stripe : line_items[0][quantity]=1
function encoder(objet, prefixe = "", sortie = new URLSearchParams()) {
  for (const [cle, valeur] of Object.entries(objet)) {
    if (valeur == null) continue;
    const nom = prefixe ? `${prefixe}[${cle}]` : cle;
    if (typeof valeur === "object") encoder(valeur, nom, sortie);
    else sortie.append(nom, String(valeur));
  }
  return sortie;
}

async function appelStripe(methode, chemin, parametres) {
  const base = (process.env.STRIPE_API_URL || "https://api.stripe.com").replace(/\/+$/, "");
  const res = await fetch(`${base}/v1/${chemin}`, {
    method: methode,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: parametres ? encoder(parametres) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Stripe a refusé la demande (${res.status}).`);
  return data;
}

// Avis de Stripe authentique : en-tête « t=…,v1=… », signature HMAC-SHA256 de
// « t.corps » avec le secret de l'avis, envoyée il y a au plus 5 minutes
export function signatureStripeValide(corps, entete, secret = process.env.STRIPE_WEBHOOK_SECRET, maintenant = Date.now()) {
  if (!entete || !secret) return false;
  const morceaux = String(entete).split(",").map((m) => m.split("="));
  const t = Number(morceaux.find(([k]) => k === "t")?.[1]);
  const signatures = morceaux.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !signatures.length || Math.abs(maintenant / 1000 - t) > 300) return false;
  const attendue = Buffer.from(crypto.createHmac("sha256", secret).update(`${t}.${corps}`).digest("hex"));
  return signatures.some((s) => {
    const recue = Buffer.from(String(s));
    return recue.length === attendue.length && crypto.timingSafeEqual(recue, attendue);
  });
}

// Ouvre une page de paiement Stripe → adresse de la page. type : "FACTURE",
// "DEPOT_SOUMISSION" ou "DEPOT_BON" ; refs : { factureId?, soumissionId?,
// bonId?, inspectionId? } ; retour : page publique où revenir.
async function ouvrirPaiement({ type, montant, description, courriel, retour, refs }) {
  if (!(await paiementEnLigneActif())) throw new Error("Le paiement en ligne n'est pas offert pour le moment.");
  const cents = Math.round(montant * 100);
  if (!(cents >= 50)) throw new Error("Montant trop petit pour un paiement en ligne.");
  const session = await appelStripe("POST", "checkout/sessions", {
    mode: "payment",
    locale: "fr-CA",
    customer_email: courriel || undefined,
    line_items: [{ quantity: 1, price_data: { currency: "cad", unit_amount: cents, product_data: { name: description.slice(0, 200) } } }],
    success_url: `${retour}?paiement=reussi`,
    cancel_url: `${retour}?paiement=annule`,
    metadata: { kontrolshop: "1", type },
    payment_intent_data: { description: description.slice(0, 200) },
  });
  await prisma.paiementEnLigne.create({ data: { sessionId: session.id, type, montant: cents / 100, ...refs } });
  return session.url;
}

// ---------- Montants ----------

// Facture par son lien de paiement (créé au premier besoin ailleurs)
export async function factureParJeton(jeton) {
  return jeton
    ? prisma.facture.findUnique({
        where: { jetonPaiement: jeton },
        include: { bon: { select: { id: true, numero: true, clientNomAffiche: true, client: { select: { nom: true, courriel: true } }, vehicule: true } } },
      })
    : null;
}

// Lien de paiement d'une facture, créé au premier besoin
export async function assurerLienPaiement(factureId) {
  const f = await prisma.facture.findUnique({ where: { id: factureId }, select: { jetonPaiement: true } });
  if (!f) return null;
  if (f.jetonPaiement) return `${adressePublique()}/payer/${f.jetonPaiement}`;
  const jeton = crypto.randomBytes(24).toString("base64url");
  await prisma.facture.update({ where: { id: factureId }, data: { jetonPaiement: jeton } });
  return `${adressePublique()}/payer/${jeton}`;
}

const nomClient = (bon) => (bon?.clientNomAffiche || "").trim() || bon?.client?.nom || "";

async function taux() {
  const dict = await lireParametres(["taux_horaire_client", "tps_taux", "tvq_taux"]);
  return { tauxHoraire: Number(dict.taux_horaire_client || 195), tpsTaux: Number(dict.tps_taux || 5), tvqTaux: Number(dict.tvq_taux || 9.975) };
}

// Dépôt demandé sur une soumission approuvée en ligne → { montant, total }
// ou null (pas de dépôt réglé, pas approuvée, ou déjà versé)
export async function depotSoumission(soumission, pourcent) {
  if (!pourcent || soumission.reponseClient !== "APPROUVEE" || soumission.statut === "FACTUREE") return null;
  const total = totauxTaches(tachesRetenues(soumission), await taux()).total;
  const dejaVerse = (soumission.depots || []).reduce((s, d) => s + d.montant, 0);
  const montant = arrondir(total * pourcent / 100 - dejaVerse);
  return montant >= 1 ? { montant, total: arrondir(total) } : null;
}

// Dépôt demandé sur les travaux approuvés d'une inspection → { montant,
// total } ou null. Seuls les travaux avec un prix comptent.
export async function depotInspection(inspection, depotsDuBon, pourcent) {
  if (!pourcent || inspection.reponseClient !== "APPROUVEE") return null;
  const approuves = pointsRecommandes(inspection.points).filter((p) => p.approbation === "APPROUVE" && p.prixEstime != null);
  const { tpsTaux, tvqTaux } = await taux();
  const total = totauxRecommandes(approuves, { tpsTaux, tvqTaux }).total;
  const dejaVerse = depotsDuBon.reduce((s, d) => s + d.montant, 0);
  const montant = arrondir(total * pourcent / 100 - dejaVerse);
  return montant >= 1 ? { montant, total: arrondir(total) } : null;
}

// ---------- Ouvrir un paiement depuis une page publique ----------

export async function payerFacture(jeton) {
  const f = await factureParJeton(jeton);
  if (!f) throw new Error("Ce lien n'est plus valide.");
  const solde = soldeFacture(f);
  if (solde <= 0) throw new Error("Cette facture est déjà payée.");
  return ouvrirPaiement({
    type: "FACTURE", montant: solde, courriel: f.bon.client.courriel,
    description: `Facture ${f.numero} — ${nomClient(f.bon)}`,
    retour: `${adressePublique()}/payer/${jeton}`, refs: { factureId: f.id, bonId: f.bonId },
  });
}

export async function payerDepotSoumission(jeton) {
  const s = jeton
    ? await prisma.soumission.findUnique({
        where: { jetonClient: jeton },
        include: { client: { select: { courriel: true } }, depots: { select: { montant: true } }, taches: { include: { pieces: true } } },
      })
    : null;
  if (!s) throw new Error("Ce lien n'est plus valide.");
  const depot = await depotSoumission(s, await lirePourcentDepot());
  if (!depot) throw new Error("Aucun dépôt à verser sur cette soumission.");
  return ouvrirPaiement({
    type: "DEPOT_SOUMISSION", montant: depot.montant, courriel: s.client?.courriel,
    description: `Dépôt — soumission ${s.numero} — ${s.clientNom}`,
    retour: `${adressePublique()}/soumission/${jeton}`, refs: { soumissionId: s.id, bonId: s.bonId },
  });
}

export async function payerDepotInspection(jeton) {
  const i = jeton
    ? await prisma.inspection.findUnique({
        where: { jetonClient: jeton },
        include: { points: true, bon: { select: { id: true, numero: true, clientNomAffiche: true, client: { select: { nom: true, courriel: true } }, depots: { select: { montant: true } } } } },
      })
    : null;
  if (!i) throw new Error("Ce lien n'est plus valide.");
  const depot = await depotInspection(i, i.bon.depots, await lirePourcentDepot());
  if (!depot) throw new Error("Aucun dépôt à verser sur ces travaux.");
  return ouvrirPaiement({
    type: "DEPOT_BON", montant: depot.montant, courriel: i.bon.client.courriel,
    description: `Dépôt — travaux du bon ${i.bon.numero} — ${nomClient(i.bon)}`,
    retour: `${adressePublique()}/inspection/${jeton}`, refs: { bonId: i.bon.id, inspectionId: i.id },
  });
}

// ---------- Avis de Stripe ----------

// Compte de trésorerie « Paiements en ligne (Stripe) » (GL 1020), créé au
// premier paiement → son id
async function assurerCompteStripe() {
  await assurerPlanComptable();
  await creerManquants("compte", "numero", [{ numero: COMPTE_STRIPE, nom: "Stripe — paiements en ligne", type: "ACTIF" }]);
  const compte = await prisma.compte.findUnique({ where: { numero: COMPTE_STRIPE }, select: { id: true } });
  await creerManquants("compteTresorerie", "compteId", [{ nom: "Paiements en ligne (Stripe)", categorie: "BANQUE", compteId: compte.id, ordre: 3 }]);
  return (await prisma.compteTresorerie.findUnique({ where: { compteId: compte.id }, select: { id: true } })).id;
}

// Frais de Stripe d'un paiement (en $), ou null si on ne peut pas les lire
async function fraisStripe(paymentIntentId) {
  try {
    const pi = await appelStripe("GET", `payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge.balance_transaction`);
    const fee = pi?.latest_charge?.balance_transaction?.fee;
    return Number.isFinite(fee) ? fee / 100 : null;
  } catch {
    return null;
  }
}

// Inscrit le paiement confirmé → { paiementFactureId?, depotId?, libelle, url }
async function inscrire(p, ligne) {
  if (p.type === "FACTURE") {
    const r = await enregistrerPaiements(p.factureId, [ligne], { creePar: AUTEUR_PAIEMENT, excedentEnCredit: true });
    const f = r.facture;
    return { paiementFactureId: r.paiements[0]?.id || null, libelle: `facture ${f.numero}`, url: `/bons/${f.bonId}` };
  }
  // Dépôt : sur la soumission (et son bon, si elle est déjà acceptée) ou sur
  // le bon. Le bon a été facturé entretemps ? Le dépôt paie sa facture.
  const cible = p.type === "DEPOT_SOUMISSION" ? { soumissionId: p.soumissionId } : { bonId: p.bonId };
  try {
    const r = await enregistrerDepots(cible, [ligne], { creePar: AUTEUR_PAIEMENT });
    const d = r.depots[0];
    return {
      depotId: d.id,
      libelle: d.bon ? `bon #${d.bon.numero}` : `soumission #${d.soumission?.numero}`,
      url: d.bonId ? `/bons/${d.bonId}` : "/secretaire/operations/soumissions",
    };
  } catch (e) {
    const bonId = p.bonId || (await prisma.soumission.findUnique({ where: { id: p.soumissionId || "" }, select: { bonId: true } }))?.bonId;
    const facture = bonId ? await prisma.facture.findUnique({ where: { bonId } }) : null;
    if (!facture || facture.statut !== "IMPAYEE") throw e;
    const r = await enregistrerPaiements(facture.id, [ligne], { creePar: AUTEUR_PAIEMENT, excedentEnCredit: true });
    return { paiementFactureId: r.paiements[0]?.id || null, libelle: `facture ${facture.numero} (dépôt reçu après la facture)`, url: `/bons/${facture.bonId}` };
  }
}

// Traite un avis de Stripe déjà vérifié. Lance une erreur seulement pour un
// problème passager (Stripe renverra l'avis) ; un paiement qui ne s'inscrit
// pas tout seul est noté « à traiter ».
export async function traiterAvisStripe(evenement) {
  const session = evenement?.data?.object;
  if (!session?.id || !["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired"].includes(evenement.type)) return { ignore: true };
  const p = await prisma.paiementEnLigne.findUnique({ where: { sessionId: session.id } });
  if (!p) return { ignore: true }; // pas une page ouverte par kontrolshop
  if (evenement.type === "checkout.session.expired") {
    if (p.statut === "OUVERT") await prisma.paiementEnLigne.update({ where: { id: p.id }, data: { statut: "EXPIRE" } });
    return { expire: true };
  }
  if (session.payment_status !== "paid" || p.statut !== "OUVERT") return { deja: p.statut !== "OUVERT" };

  // Réservé avant d'inscrire : deux avis simultanés n'inscrivent qu'une fois
  const { count } = await prisma.paiementEnLigne.updateMany({ where: { id: p.id, statut: "OUVERT" }, data: { statut: "PAYE", payeLe: new Date() } });
  if (!count) return { deja: true };
  const montant = arrondir((session.amount_total ?? p.montant * 100) / 100);
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
  const frais = paymentIntentId ? await fraisStripe(paymentIntentId) : null;

  let resultat;
  try {
    const compteTresorerieId = await assurerCompteStripe();
    resultat = await inscrire(p, { montant, modePaiement: "CARTE_CREDIT", compteTresorerieId, reference: `Stripe ${paymentIntentId || session.id}` });
  } catch (e) {
    await prisma.paiementEnLigne.update({ where: { id: p.id }, data: { statut: "A_TRAITER", paymentIntentId, fraisStripe: frais, erreur: String(e.message || e).slice(0, 500) } });
    await notifier("PAIEMENT_EN_LIGNE", {
      titre: `Paiement en ligne à traiter : ${argent(montant)}`,
      corps: `Reçu par Stripe, mais pas inscrit tout seul : ${e.message}`,
      url: "/gerant/parametres#paiement-en-ligne",
    });
    return { aTraiter: true };
  }
  await prisma.paiementEnLigne.update({
    where: { id: p.id },
    data: { paymentIntentId, fraisStripe: frais, paiementFactureId: resultat.paiementFactureId || null, depotId: resultat.depotId || null },
  });

  // Frais de Stripe : dépense, payée à même le compte Stripe
  if (frais > 0 && (await moduleComptabiliteActif())) {
    const description = `Frais Stripe — paiement en ligne de ${argent(montant)} (${resultat.libelle})`;
    await enregistrerEcriture({
      date: new Date(), description, source: "FRAIS_STRIPE", sourceId: p.id, creePar: AUTEUR_PAIEMENT,
      lignes: [{ compteNumero: COMPTE_FRAIS, debit: frais, description }, { compteNumero: COMPTE_STRIPE, credit: frais, description }],
    }).catch((e) => console.error("Frais Stripe non comptabilisés :", e.message));
  }
  await notifier("PAIEMENT_EN_LIGNE", {
    titre: `Paiement en ligne reçu : ${argent(montant)}`,
    corps: `${p.type === "FACTURE" ? "Paiement" : "Dépôt"} — ${resultat.libelle}`,
    url: resultat.url,
    tag: `paiement-${p.id}`,
  });
  return { inscrit: true };
}
