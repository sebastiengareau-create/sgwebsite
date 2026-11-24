// Envoi par courriel aux locataires (module Immobilier) : un document du
// bail (avis, rappel, état des lieux…), le relevé de compte ou le reçu d'un
// paiement, en PDF joint, avec le même en-tête que les autres courriels de
// l'appli (lib/courrielDocuments.js). Un courriel par locataire — chacun
// reçoit le lien de son propre portail. Chaque envoi est consigné
// (EnvoiImmo) : c'est la preuve d'envoi montrée sur la fiche du bail.

import { prisma } from "./prisma";
import { obtenirInfosEntreprise } from "./config";
import { envoyerDocumentPdf, courrielConfigure, courrielValide } from "./courrielDocuments";
import { bailComplet, lienPortailLocataire } from "./immobilier";
import { recuLoyer, releveCompte } from "./pdfImmobilier";
import { adresseLogement, etatCompte, dateLisible, argent } from "./immobilierCalculs";

export { courrielConfigure };

// Locataires du bail qui ont un courriel valide
export const destinataires = (bail) => bail.locataires.filter((l) => courrielValide(l.courriel));

function corps(l, entreprise, lignes) {
  return [
    `Bonjour ${l.nom},`,
    "",
    ...lignes.flatMap((x, i) => (i === 0 ? [x] : ["", x])),
    ...(l.jetonPortail ? ["", "Vous pouvez aussi consulter vos documents et votre compte dans votre espace locataire :", lienPortailLocataire(l.jetonPortail)] : []),
    "",
    "Pour toute question, répondez simplement à ce courriel" + (entreprise.telephone ? ` ou appelez au ${entreprise.telephone}.` : "."),
    "",
    entreprise.personneResponsable || entreprise.nomEntreprise,
    ...(entreprise.personneResponsable ? [entreprise.nomEntreprise] : []),
  ].join("\n");
}

// Envoie à chaque locataire, consigne l'envoi → { envoyes, echecs, sansCourriel }
async function envoyerAuxLocataires(bail, { type, sujet, lignes, pdf, nomFichier, documentId = null, paiementId = null, envoyePar }) {
  if (!courrielConfigure()) return { erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY)." };
  const cibles = destinataires(bail);
  const sansCourriel = bail.locataires.filter((l) => !courrielValide(l.courriel)).map((l) => l.nom);
  if (cibles.length === 0) return { erreur: "Aucun locataire de ce bail n'a de courriel valide." };
  const entreprise = await obtenirInfosEntreprise();
  const envoyes = [];
  const echecs = [];
  for (const [i, l] of cibles.entries()) {
    if (i > 0) await new Promise((ok) => setTimeout(ok, 600)); // limite de Resend : 2 envois par seconde
    try {
      await envoyerDocumentPdf({ a: l.courriel, sujet, texte: corps(l, entreprise, lignes), entreprise, pdf, nomFichier });
      envoyes.push(l.courriel);
    } catch (e) {
      echecs.push({ a: l.courriel, erreur: String(e.message || e).slice(0, 300) });
    }
  }
  await prisma.envoiImmo.create({
    data: {
      type, sujet, bailId: bail.id, documentId, paiementId, envoyePar,
      destinataires: [...envoyes, ...echecs.map((x) => x.a)].join(", "),
      erreur: echecs.length ? echecs.map((x) => `${x.a} : ${x.erreur}`).join(" ; ") : null,
    },
  });
  return { envoyes: envoyes.length, echecs, sansCourriel };
}

// Texte du courriel selon le document envoyé
function lignesDocument(doc, bail) {
  const t = doc.titre.toLowerCase();
  if (/avis de modification/.test(t)) {
    return [
      `Vous trouverez ci-joint un avis de modification de votre bail du logement situé au ${adresseLogement(bail.logement)}.`,
      "Vous avez un mois à compter de sa réception pour nous faire part de votre décision (accepter, refuser la modification ou quitter le logement à la fin du bail). Sans réponse dans ce délai, vous êtes réputé accepter la modification.",
      ...(bail.locataires.some((l) => l.jetonPortail) ? ["Vous pouvez répondre directement dans votre espace locataire, ou par écrit."] : []),
    ];
  }
  if (/mise en demeure/.test(t)) return ["Vous trouverez ci-joint une mise en demeure concernant votre loyer. Une copie vous est aussi envoyée par la poste."];
  if (/rappel/.test(t)) return [`Vous trouverez ci-joint un rappel concernant le loyer du logement situé au ${adresseLogement(bail.logement)}.`];
  if (/acc[eè]s au logement/.test(t)) return ["Vous trouverez ci-joint un avis d'accès à votre logement. Si la date ou l'heure ne vous conviennent pas, communiquez avec nous."];
  return [`Vous trouverez ci-joint le document suivant : ${doc.titre}.`];
}

// Un document du bail (ou adressé à un locataire de ce bail), en PDF joint.
// Le document devient visible dans le portail du locataire.
export async function envoyerDocument(documentId, envoyePar) {
  const doc = await prisma.documentImmo.findUnique({ where: { id: documentId } });
  if (!doc) return { erreur: "Document introuvable." };
  let bailId = doc.bailId;
  if (!bailId && doc.locataireId) {
    bailId = (await prisma.bailImmo.findFirst({ where: { locataires: { some: { id: doc.locataireId } } }, orderBy: [{ statut: "asc" }, { dateDebut: "desc" }], select: { id: true } }))?.id;
  }
  if (!bailId) return { erreur: "Ce document n'est rattaché à aucun bail ni locataire." };
  const bail = await bailComplet(bailId);
  // Document propre à un locataire : à lui seulement
  if (doc.locataireId && !doc.bailId) bail.locataires = bail.locataires.filter((l) => l.id === doc.locataireId);
  const r = await envoyerAuxLocataires(bail, {
    type: "DOCUMENT", sujet: doc.titre, lignes: lignesDocument(doc, bail), pdf: Buffer.from(doc.donnees), nomFichier: doc.nom,
    documentId: doc.id, envoyePar,
  });
  if (!r.erreur && r.envoyes > 0 && !doc.visibleLocataire) await prisma.documentImmo.update({ where: { id: doc.id }, data: { visibleLocataire: true } });
  return r;
}

// Relevé de compte des 12 derniers mois. rappel : courriel de rappel d'un
// loyer en retard (type RAPPEL — envoi automatique, lib/immobilierAuto.js)
export async function envoyerReleve(bailId, envoyePar, { rappel = false } = {}) {
  const bail = await bailComplet(bailId);
  if (!bail) return { erreur: "Bail introuvable." };
  const entreprise = await obtenirInfosEntreprise();
  const pdf = await releveCompte(bail, entreprise);
  const compte = etatCompte(bail);
  const solde = compte.solde;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const adresse = adresseLogement(bail.logement);
  if (rappel) {
    if (compte.enRetard <= 0.005) return { erreur: "Ce bail n'a aucun montant en retard." };
    return envoyerAuxLocataires(bail, {
      type: "RAPPEL", sujet: `Rappel — loyer en retard de ${argent(compte.enRetard)}`, pdf, nomFichier: `Releve-de-compte-${aujourdhui}.pdf`, envoyePar,
      lignes: [
        `Sauf erreur de notre part, le compte de votre logement au ${adresse} présente un montant en retard de ${argent(compte.enRetard)}, dû depuis le ${dateLisible(compte.depuis)}. Le relevé de compte est joint à ce courriel.`,
        "Merci de régler ce montant dès que possible. Si vous éprouvez des difficultés, communiquez avec nous : une entente de paiement est possible.",
        "Si votre paiement a été fait entre-temps, veuillez ne pas tenir compte de ce rappel.",
      ],
    });
  }
  return envoyerAuxLocataires(bail, {
    type: "RELEVE", sujet: compte.enRetard > 0.005 ? `Relevé de compte — ${argent(compte.enRetard)} en retard` : solde > 0.005 ? `Relevé de compte — solde de ${argent(solde)}` : "Relevé de compte", pdf, nomFichier: `Releve-de-compte-${aujourdhui}.pdf`, envoyePar,
    lignes: [
      `Vous trouverez ci-joint le relevé de compte de votre logement au ${adresse}.`,
      compte.enRetard > 0.005
        ? `Montant en retard à ce jour : ${argent(compte.enRetard)}${compte.aRecevoir > 0.005 ? ` (plus ${argent(compte.aRecevoir)} à venir)` : ""}. Si votre paiement a été fait entre-temps, veuillez ne pas en tenir compte.`
        : solde > 0.005 ? `Solde de votre compte : ${argent(solde)}, à payer à l'échéance.` : "Votre compte est à jour. Merci !",
    ],
  });
}

// Reçu d'un paiement
export async function envoyerRecu(paiementId, envoyePar) {
  const paiement = await prisma.paiementImmo.findUnique({ where: { id: paiementId } });
  if (!paiement) return { erreur: "Paiement introuvable." };
  const bail = await bailComplet(paiement.bailId);
  const entreprise = await obtenirInfosEntreprise();
  const pdf = await recuLoyer(bail, entreprise, paiement);
  return envoyerAuxLocataires(bail, {
    type: "RECU", sujet: `Reçu de loyer — ${argent(paiement.montant)} reçu le ${dateLisible(paiement.date)}`, pdf,
    nomFichier: `Recu-loyer-${paiement.date.toISOString().slice(0, 10)}.pdf`, paiementId: paiement.id, envoyePar,
    lignes: [`Nous avons bien reçu votre paiement de ${argent(paiement.montant)} le ${dateLisible(paiement.date)}. Votre reçu est joint à ce courriel.`],
  });
}

// Relevé de compte à tous les baux qui ont un montant en retard (échéance
// passée — pas un loyer inscrit d'avance) → { envoyes, baux, ignores }
export async function envoyerRelevesRetards(envoyePar) {
  if (!courrielConfigure()) return { erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY)." };
  const { comptesDesBaux } = await import("./immobilier");
  const comptes = await comptesDesBaux();
  const ids = Object.entries(comptes).filter(([, c]) => c.enRetard > 0.005).map(([id]) => id);
  let envoyes = 0;
  let baux = 0;
  const ignores = [];
  for (const id of ids) {
    const r = await envoyerReleve(id, envoyePar);
    if (r.erreur) { ignores.push(r.erreur); continue; }
    baux += r.envoyes > 0 ? 1 : 0;
    envoyes += r.envoyes;
    await new Promise((ok) => setTimeout(ok, 600)); // limite de Resend : 2 envois par seconde
  }
  return { envoyes, baux, ignores: ignores.length };
}
