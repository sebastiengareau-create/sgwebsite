// Signature électronique des documents de l'immobilier (module Immobilier) :
// bail de logement, avis de modification (réponse signée), ou tout document
// PDF déposé (annexe, règlement, état des lieux…).
//
//   1. Le gestionnaire demande la signature d'un document à un ou plusieurs
//      locataires du bail (et, au besoin, au locateur) : une SignatureImmo
//      par signataire, avec un lien secret /signature/<jeton> et l'empreinte
//      SHA-256 du document. Chaque locataire reçoit le lien par courriel (le
//      PDF joint) ; le lien apparaît aussi dans son portail.
//   2. Le signataire lit le document, inscrit son nom, signe du doigt et
//      consent à la signature électronique — ou refuse, avec un mot. Pour un
//      avis de modification, il choisit sa réponse (accepte, refuse, quitte)
//      et la signe : la réponse est consignée au bail.
//   3. Quand tous ont signé, la version signée est produite : le document
//      généré par l'appli est reproduit à l'identique (instantané gardé à sa
//      génération) avec les signatures dans leurs cases, suivi du certificat
//      de signature ; un document déposé reçoit un certificat de signature
//      séparé, qui l'identifie par son empreinte. L'empreinte SHA-256 de la
//      version signée est conservée (empreinteSignee) ; une copie signée est
//      envoyée par courriel à chaque locataire signataire, avec cette empreinte.
//   Pour un bail qui mentionne la remise du règlement de l'immeuble, chaque
//   locataire atteste en signant l'avoir reçu (reglementRecuLe).
//   Un document envoyé à la signature ne peut plus être supprimé
//   (verrouSignature).
//
// Même principe que l'approbation des soumissions (lib/approbationSoumission.js).
import crypto from "crypto";
import { prisma } from "./prisma";
import { notifier } from "./notifications";
import { immobilierActif, revivreInstantane, lienPortailLocataire } from "./immobilier";
import { REPONSES_AVIS, libelle, etatSignatures, adresseLogement } from "./immobilierCalculs";

export const TAILLE_MAX_SIGNATURE = 300 * 1024; // caractères de la data URL

const adressePublique = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
export const lienSignature = (jeton) => `${adressePublique()}/signature/${jeton}`;
export const empreinteDe = (donnees) => crypto.createHash("sha256").update(Buffer.from(donnees)).digest("hex");
const nouveauJeton = () => crypto.randomBytes(24).toString("base64url");
const courrielValide = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c || "");

// Manière de répondre selon le document : "AVIS" (avis de modification :
// accepte, refuse ou quitte) ou "SIGNATURE" (signer ou refuser)
export const modeReponse = (doc) => (doc?.genre === "AVIS_MODIFICATION" ? "AVIS" : "SIGNATURE");

// Document de bail (formulaire officiel, aide-mémoire ou bail déposé) : le
// locataire y atteste en signant avoir reçu le règlement de l'immeuble,
// quand le bail en mentionne la remise (section E)
const estBail = (doc) => doc?.categorie === "BAIL_TAL" || doc?.genre === "BAIL_LOGEMENT" || (doc?.categorie === "BAIL" && !doc?.genre);

// Date de remise du règlement de l'immeuble à attester par ce signataire,
// ou null si la case ne s'applique pas
export async function reglementAAttester(demande, doc) {
  if (demande.role !== "LOCATAIRE" || modeReponse(doc) !== "SIGNATURE" || !estBail(doc)) return null;
  const bailId = await bailDuDocument(doc);
  if (!bailId) return null;
  const bail = await prisma.bailImmo.findUnique({ where: { id: bailId }, select: { reglementRemisLe: true } });
  return bail?.reglementRemisLe || null;
}

// Un document qui a été envoyé à la signature reste au dossier : on ne
// peut le supprimer (ni l'immeuble qui le porte) — c'est la preuve.
// → { erreur } ou null
export async function verrouSignature(where) {
  const docs = await prisma.documentImmo.findMany({ where, select: { titre: true, signeLe: true, signatures: { select: { statut: true } } } });
  for (const d of docs) {
    if (d.signeLe || d.signatures.some((s) => s.statut === "SIGNE")) return { erreur: `« ${d.titre} » a été signé électroniquement : il reste au dossier, avec ses signatures et son certificat.` };
    if (d.signatures.some((s) => s.statut === "EN_ATTENTE")) return { erreur: `« ${d.titre} » attend des signatures : annule d'abord la demande de signature.` };
  }
  return null;
}

// Adresse IP et navigateur de la requête (preuve de la signature)
export function origineRequete(request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || null;
  return { ip: ip ? ip.slice(0, 60) : null, navigateur: (request.headers.get("user-agent") || "").slice(0, 300) || null };
}

// Bail du document : le sien, ou celui du locataire auquel il est adressé
async function bailDuDocument(doc) {
  if (doc.bailId) return doc.bailId;
  if (!doc.locataireId) return null;
  const b = await prisma.bailImmo.findFirst({ where: { locataires: { some: { id: doc.locataireId } } }, orderBy: [{ statut: "asc" }, { dateDebut: "desc" }], select: { id: true } });
  return b?.id || null;
}

// ---------- Demande ----------

// Crée les demandes de signature d'un document. options : { locataireIds,
// locateur (le locateur signe aussi), envoyer (courriel aux locataires),
// message, creePar } → { demandes, envoi } ou { erreur }
export async function demanderSignatures(documentId, { locataireIds = [], locateur = false, envoyer = true, message = "", creePar = null } = {}) {
  const doc = await prisma.documentImmo.findUnique({
    where: { id: documentId },
    include: { signatures: true, bail: { include: { locataires: true } }, locataire: true },
  });
  if (!doc) return { erreur: "Document introuvable." };
  if (doc.typeMime !== "application/pdf") return { erreur: "Seul un document PDF peut se faire signer en ligne." };
  if (doc.signatures.some((s) => s.statut === "EN_ATTENTE")) return { erreur: "Une demande de signature est déjà en cours pour ce document : annule-la d'abord." };
  if (doc.signeLe) return { erreur: "Ce document est déjà signé." };
  const permis = doc.bail ? doc.bail.locataires : doc.locataire ? [doc.locataire] : [];
  const ids = new Set((Array.isArray(locataireIds) ? locataireIds : []).filter((id) => permis.some((l) => l.id === id)));
  const vises = permis.filter((l) => ids.has(l.id));
  const mode = modeReponse(doc);
  if (vises.length === 0) return { erreur: "Choisis au moins un locataire signataire." };
  if (mode === "AVIS" && locateur) locateur = false; // l'avis est déjà signé par le locateur
  const { obtenirInfosEntreprise } = await import("./config");
  const entreprise = await obtenirInfosEntreprise();
  const empreinte = empreinteDe(doc.donnees);
  const note = String(message || "").trim().slice(0, 1000) || null;
  const lignes = [
    ...(locateur ? [{ role: "LOCATEUR", nom: entreprise.personneResponsable || entreprise.nomEntreprise, courriel: courrielValide(entreprise.courriel) ? entreprise.courriel : null }] : []),
    ...vises.map((l) => ({ role: "LOCATAIRE", locataireId: l.id, nom: l.nom, courriel: courrielValide(l.courriel) ? l.courriel : null })),
  ];
  // Nouvelle ronde (après un refus, par exemple) : les réponses de la ronde
  // précédente ne comptent plus — le document est signé de nouveau au complet
  await prisma.signatureImmo.updateMany({ where: { documentId: doc.id, statut: { in: ["REFUSE", "SIGNE"] } }, data: { statut: "ANNULE" } });
  const demandes = [];
  for (const [ordre, x] of lignes.entries()) {
    demandes.push(await prisma.signatureImmo.create({ data: { ...x, documentId: doc.id, ordre, jeton: nouveauJeton(), empreinte, message: note, creePar } }));
  }
  // Le document se montre au locataire dans son portail
  if (!doc.visibleLocataire) await prisma.documentImmo.update({ where: { id: doc.id }, data: { visibleLocataire: true } });
  const envoi = envoyer ? await envoyerDemandes(demandes.filter((d) => d.role === "LOCATAIRE").map((d) => d.id), creePar) : null;
  return { demandes: demandes.map((d) => d.id), envoi };
}

// Courriel de demande : le lien de signature, le PDF joint. Consigné au
// journal des envois du bail. → { envoyes, echecs, sansCourriel }
export async function envoyerDemandes(ids, envoyePar, { relance = false } = {}) {
  const { courrielConfigure, envoyerDocumentPdf } = await import("./courrielDocuments");
  const demandes = await prisma.signatureImmo.findMany({ where: { id: { in: ids }, statut: "EN_ATTENTE" }, include: { document: true, locataire: true }, orderBy: { ordre: "asc" } });
  const sansCourriel = demandes.filter((d) => !courrielValide(d.courriel)).map((d) => d.nom);
  const cibles = demandes.filter((d) => courrielValide(d.courriel));
  if (cibles.length === 0) return { envoyes: 0, echecs: [], sansCourriel };
  if (!courrielConfigure()) return { erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY) : transmets le lien toi-même.", sansCourriel };
  const { obtenirInfosEntreprise } = await import("./config");
  const entreprise = await obtenirInfosEntreprise();
  const doc = cibles[0].document;
  const bailId = await bailDuDocument(doc);
  const bail = bailId ? await prisma.bailImmo.findUnique({ where: { id: bailId }, include: { logement: { include: { immeuble: true } } } }) : null;
  const avis = modeReponse(doc) === "AVIS";
  const sujet = `${relance ? "Rappel — " : ""}${avis ? "Votre réponse à l'avis de modification du bail" : `Document à signer : ${doc.titre}`}`;
  const envoyes = [];
  const echecs = [];
  for (const [i, d] of cibles.entries()) {
    if (i > 0) await new Promise((ok) => setTimeout(ok, 600)); // limite de Resend : 2 envois par seconde
    const texte = [
      `Bonjour ${d.nom},`,
      "",
      avis
        ? `Vous trouverez ci-joint l'avis de modification de votre bail${bail ? ` du logement situé au ${adresseLogement(bail.logement)}` : ""}. Vous pouvez y répondre (accepter, refuser la modification ou quitter le logement à la fin du bail) et signer votre réponse en ligne :`
        : `Vous trouverez ci-joint le document « ${doc.titre} »${bail ? ` concernant le logement situé au ${adresseLogement(bail.logement)}` : ""}. Vous pouvez le lire et le signer en ligne, sur votre téléphone ou votre ordinateur :`,
      "",
      lienSignature(d.jeton),
      ...(d.message ? ["", d.message] : []),
      "",
      "Ce lien vous est personnel : ne le partagez pas. Votre signature électronique a la même valeur que votre signature à la main ; une copie signée vous sera envoyée.",
      ...(avis ? ["", "Vous avez un mois à compter de la réception de l'avis pour répondre. Sans réponse dans ce délai, vous êtes réputé accepter la modification."] : []),
      ...(d.locataire?.jetonPortail ? ["", "Le document est aussi dans votre espace locataire :", lienPortailLocataire(d.locataire.jetonPortail)] : []),
      "",
      "Pour toute question, répondez simplement à ce courriel" + (entreprise.telephone ? ` ou appelez au ${entreprise.telephone}.` : "."),
      "",
      entreprise.personneResponsable || entreprise.nomEntreprise,
      ...(entreprise.personneResponsable ? [entreprise.nomEntreprise] : []),
    ].join("\n");
    try {
      await envoyerDocumentPdf({ a: d.courriel, sujet, texte, entreprise, pdf: Buffer.from(doc.donnees), nomFichier: doc.nom });
      envoyes.push(d);
    } catch (e) {
      echecs.push({ a: d.courriel, erreur: String(e.message || e).slice(0, 300) });
    }
  }
  if (envoyes.length) {
    await prisma.signatureImmo.updateMany({ where: { id: { in: envoyes.map((d) => d.id) } }, data: { envoyeLe: new Date(), ...(relance ? { relances: { increment: 1 } } : {}) } });
  }
  await prisma.envoiImmo.create({
    data: {
      type: "SIGNATURE", sujet, bailId, documentId: doc.id, envoyePar,
      destinataires: [...envoyes.map((d) => d.courriel), ...echecs.map((x) => x.a)].join(", "),
      erreur: echecs.length ? echecs.map((x) => `${x.a} : ${x.erreur}`).join(" ; ") : null,
    },
  });
  return { envoyes: envoyes.length, echecs, sansCourriel };
}

// Annule une demande encore en attente
export async function annulerDemande(id) {
  const d = await prisma.signatureImmo.findUnique({ where: { id } });
  if (!d) return { erreur: "Demande introuvable." };
  if (d.statut !== "EN_ATTENTE") return { erreur: "Cette demande a déjà reçu une réponse." };
  await prisma.signatureImmo.update({ where: { id }, data: { statut: "ANNULE" } });
  await finaliser(d.documentId); // les autres ont peut-être tous signé
  return { ok: true };
}

// ---------- Réponse du signataire ----------

// Demande d'un lien de signature, si le module est actif → ou null
export async function signatureParJeton(jeton) {
  if (!jeton || typeof jeton !== "string" || jeton.length < 20) return null;
  if (!(await immobilierActif())) return null;
  return prisma.signatureImmo.findUnique({ where: { jeton }, include: { document: { include: { signatures: { orderBy: { ordre: "asc" } } } } } });
}

// Réponse reçue par le lien : { action: "SIGNER" | "REFUSER", nom,
// signature, consentement, reponseAvis, note } → { ok } ou { erreur, status }
export async function repondre(jeton, corps, origine) {
  const d = await signatureParJeton(jeton);
  if (!d) return { erreur: "Ce lien n'est plus valide.", status: 404 };
  if (d.statut !== "EN_ATTENTE") return { erreur: d.statut === "ANNULE" ? "Cette demande a été annulée." : "Vous avez déjà répondu.", status: 409 };
  if (empreinteDe(d.document.donnees) !== d.empreinte) return { erreur: "Le document a changé depuis la demande : communiquez avec votre propriétaire.", status: 409 };
  const avis = modeReponse(d.document) === "AVIS";
  const note = String(corps.note || "").trim().slice(0, 1000) || null;
  const maintenant = new Date();

  if (corps.action === "REFUSER" && !avis) {
    await prisma.signatureImmo.update({ where: { id: d.id }, data: { statut: "REFUSE", reponduLe: maintenant, note, ...origine } });
    await notifier("DEMANDE_IMMO", { titre: `Signature refusée — ${d.nom}`, corps: `« ${d.document.titre} »${note ? ` : ${note}` : ""}`, url: await urlDocument(d.document), tag: `signature-immo-${d.documentId}` });
    return { ok: true };
  }
  if (corps.action !== "SIGNER") return { erreur: "Réponse invalide.", status: 400 };
  const nom = String(corps.nom || "").trim().slice(0, 120);
  const signature = String(corps.signature || "");
  if (!nom) return { erreur: "Entrez votre nom.", status: 400 };
  if (!signature.startsWith("data:image/png;base64,") || signature.length > TAILLE_MAX_SIGNATURE) return { erreur: "Signez dans la case.", status: 400 };
  if (!corps.consentement) return { erreur: "Cochez la case de consentement à la signature électronique.", status: 400 };
  const reponseAvis = avis ? corps.reponseAvis : null;
  if (avis && !REPONSES_AVIS.some((r) => r.code === reponseAvis)) return { erreur: "Choisissez votre réponse à l'avis.", status: 400 };
  const reglement = await reglementAAttester(d, d.document);
  if (reglement && !corps.reglementRecu) return { erreur: "Cochez la case confirmant que vous avez reçu le règlement de l'immeuble.", status: 400 };

  await prisma.signatureImmo.update({ where: { id: d.id }, data: { statut: "SIGNE", reponduLe: maintenant, signataireNom: nom, signature, reponseAvis, note, reglementRecuLe: reglement ? maintenant : null, ...origine } });
  if (avis) await consignerReponseAvis(d.document, { reponse: reponseAvis, nom, signature, ip: origine.ip, quand: maintenant, via: "lien de signature" });
  await notifier("DEMANDE_IMMO", {
    titre: avis ? `Réponse à l'avis — ${nom}` : `Document signé — ${nom}`,
    corps: avis ? `${libelle(REPONSES_AVIS, reponseAvis)} (réponse signée en ligne)` : `« ${d.document.titre} »`,
    url: await urlDocument(d.document), tag: `signature-immo-${d.documentId}`,
  });
  await finaliser(d.documentId);
  return { ok: true };
}

async function urlDocument(doc) {
  const bailId = await bailDuDocument(doc);
  return bailId ? `/immobilier/baux/${bailId}` : "/immobilier/documents";
}

// Réponse à l'avis de modification consignée au bail (la première reçue ;
// une réponse différente d'un colocataire s'ajoute aux notes)
async function consignerReponseAvis(doc, { reponse, nom, signature, ip, quand, via }) {
  const bailId = await bailDuDocument(doc);
  if (!bailId) return;
  const bail = await prisma.bailImmo.findUnique({ where: { id: bailId } });
  const jour = new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeZone: "America/Toronto" }).format(quand);
  const note = `Réponse à l'avis de modification signée par ${nom} (${via}) le ${jour} : ${libelle(REPONSES_AVIS, reponse).toLowerCase()}.`;
  const notes = [bail.notes, note].filter(Boolean).join("\n");
  if (bail.reponseAvis && bail.reponseAvisLe) {
    await prisma.bailImmo.update({ where: { id: bail.id }, data: { notes } });
    return;
  }
  await prisma.bailImmo.update({
    where: { id: bail.id },
    data: { reponseAvis: reponse, reponseAvisLe: quand, reponseAvisPar: nom, reponseAvisSignature: signature, reponseAvisIp: ip, notes },
  });
}

// Réponse à l'avis donnée et signée dans le portail du locataire (sans lien
// de signature). La demande de signature en attente de ce locataire pour
// l'avis de ce bail, s'il y en a une, est remplie du même coup.
export async function repondreAvisPortail({ locataire, bail, reponse, nom, signature, origine }) {
  const quand = new Date();
  const doc = { bailId: bail.id };
  await consignerReponseAvis(doc, { reponse, nom, signature, ip: origine.ip, quand, via: "espace locataire" });
  const enAttente = await prisma.signatureImmo.findMany({
    where: { locataireId: locataire.id, statut: "EN_ATTENTE", document: { bailId: bail.id, genre: "AVIS_MODIFICATION" } },
    select: { id: true, documentId: true },
  });
  for (const d of enAttente) {
    await prisma.signatureImmo.update({ where: { id: d.id }, data: { statut: "SIGNE", reponduLe: quand, signataireNom: nom, signature, reponseAvis: reponse, ...origine } });
    await finaliser(d.documentId);
  }
}

// ---------- Version signée ----------

// Quand toutes les demandes actives sont signées : produit la version signée,
// avise le gestionnaire et envoie une copie à chaque locataire signataire.
export async function finaliser(documentId) {
  const doc = await prisma.documentImmo.findUnique({ where: { id: documentId }, include: { signatures: { orderBy: { ordre: "asc" } } } });
  if (!doc || doc.signeLe) return null;
  const etat = etatSignatures(doc.signatures);
  if (etat?.code !== "SIGNE") return null;
  const signees = doc.signatures.filter((s) => s.statut === "SIGNE");
  const { obtenirInfosEntreprise } = await import("./config");
  const entreprise = await obtenirInfosEntreprise();
  const { TYPES_DOCUMENTS_GENERES, certificatSignature } = await import("./pdfImmobilier");
  const finaliseLe = new Date();
  const certificat = { titre: doc.titre, documentId: doc.id, empreinte: signees[0].empreinte, signatures: signees, finaliseLe };
  const def = doc.genre && TYPES_DOCUMENTS_GENERES[doc.genre];
  let pdf;
  if (def?.signature && doc.instantane) {
    const { bail, entreprise: entrepriseAlors, valeurs } = revivreInstantane(doc.instantane);
    pdf = await def.fonction(bail, entrepriseAlors, { ...valeurs, signatures: signees, certificat });
  } else {
    pdf = await certificatSignature(entreprise, certificat);
  }
  // Empreinte de la version signée : conservée et transmise aux signataires,
  // elle permet de vérifier plus tard que la copie n'a pas été modifiée
  const empreinteSignee = empreinteDe(pdf);
  await prisma.documentImmo.update({ where: { id: doc.id }, data: { donneesSignees: pdf, signeLe: finaliseLe, empreinteSignee } });
  await notifier("DEMANDE_IMMO", { titre: `Signatures complètes — ${doc.titre}`, corps: signees.map((s) => s.signataireNom || s.nom).join(", "), url: await urlDocument(doc), tag: `signature-immo-${doc.id}` });
  await envoyerCopieSignee({ ...doc, empreinteSignee }, pdf, entreprise, signees).catch((e) => console.error("Copie signée non envoyée :", e.message || e));
  return pdf;
}

const nomFichierSigne = (doc) => `${doc.nom.replace(/\.pdf$/i, "")}-${doc.instantane ? "signe" : "certificat-signature"}.pdf`;

// Copie signée à chaque locataire signataire qui a un courriel (preuve, et
// exemplaire du bail à remettre au locataire)
async function envoyerCopieSignee(doc, pdf, entreprise, signees) {
  const { courrielConfigure, envoyerDocumentPdf } = await import("./courrielDocuments");
  if (!courrielConfigure()) return;
  const cibles = signees.filter((s) => s.role === "LOCATAIRE" && courrielValide(s.courriel));
  if (cibles.length === 0) return;
  const sujet = `Copie signée : ${doc.titre}`;
  const envoyes = [];
  const echecs = [];
  for (const [i, s] of cibles.entries()) {
    if (i > 0) await new Promise((ok) => setTimeout(ok, 600));
    const texte = [
      `Bonjour ${s.nom},`, "",
      `Toutes les signatures ont été reçues pour « ${doc.titre} ». Vous trouverez ci-joint ${doc.instantane ? "la copie signée, avec son certificat de signature" : "le certificat de signature, qui accompagne le document que vous avez signé"}. Conservez-la avec vos documents.`,
      "", `Empreinte SHA-256 de ${doc.instantane ? "la copie signée" : "ce certificat"} : ${doc.empreinteSignee}`,
      "Elle identifie le fichier joint : toute modification de celui-ci la changerait.",
      "", entreprise.personneResponsable || entreprise.nomEntreprise, ...(entreprise.personneResponsable ? [entreprise.nomEntreprise] : []),
    ].join("\n");
    try {
      await envoyerDocumentPdf({ a: s.courriel, sujet, texte, entreprise, pdf, nomFichier: nomFichierSigne(doc) });
      envoyes.push(s.courriel);
    } catch (e) {
      echecs.push({ a: s.courriel, erreur: String(e.message || e).slice(0, 300) });
    }
  }
  await prisma.envoiImmo.create({
    data: {
      type: "SIGNATURE", sujet, bailId: await bailDuDocument(doc), documentId: doc.id, envoyePar: "Envoi automatique",
      destinataires: [...envoyes, ...echecs.map((x) => x.a)].join(", "), erreur: echecs.length ? echecs.map((x) => `${x.a} : ${x.erreur}`).join(" ; ") : null,
    },
  });
}

// Fichier à servir pour un document : la version signée quand on la demande
// (?version=signee), sinon l'original. → { nom, typeMime, taille, donnees }
export function versionDocument(doc, request) {
  const signee = new URL(request.url).searchParams.get("version") === "signee";
  if (!signee || !doc.donneesSignees) return doc;
  const donnees = Buffer.from(doc.donneesSignees);
  return { nom: nomFichierSigne(doc), typeMime: "application/pdf", taille: donnees.length, donnees };
}


