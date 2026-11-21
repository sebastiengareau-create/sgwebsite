// Documents de gestion locative du module Immobilier, générés en PDF à partir
// d'un bail : bail de logement complet, avis de modification, avis de
// reprise, avis d'accès au logement, rappel de retard, mise en demeure, état
// des lieux, fiche de bail et reçu de loyer — et le certificat de signature
// électronique (lib/signatureImmo.js).
//
// Ce sont des documents rédigés par le propriétaire avec les mentions que le
// Code civil du Québec exige — pas des copies de formulaires officiels. Le
// bail de logement reprend une à une les sections du formulaire obligatoire
// du Tribunal administratif du logement (TAL) ; la fiche de bail sert à
// remplir le formulaire officiel quand on l'utilise.
//
// Toutes les fonctions reçoivent le bail complet (logement.immeuble,
// locataires, charges, paiements), l'entreprise (obtenirInfosEntreprise) et
// les valeurs propres au document ; elles retournent un Buffer. Les
// documents à faire signer acceptent aussi v.signatures (réponses reçues :
// la signature s'imprime dans sa case) et v.certificat (pages du certificat
// de signature ajoutées à la fin) : c'est ainsi qu'on produit la version
// signée, à partir de l'instantané gardé à la génération.

import PDFDocument from "pdfkit";
import { argentPdf } from "./format";
import {
  releveBail, adresseLogement, nomsLocataires, servicesLisibles, servicesListe, dureeMois, soldeBail, libelle, MODES_PAIEMENT, periodeLisible, hausseLisible, ajouterMois,
  SERVICES_BAIL, CHAUFFAGES, ANIMAUX, FUMEUR, REPONSES_AVIS, STATUTS_SIGNATURE,
} from "./immobilierCalculs";

const NOIR = "#17150f";
const GRIS = "#666666";
const MARGE = 58;
const LARGEUR = 612 - MARGE * 2;
const JOUR = 86400000;

const date = (d) => new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(d)).replace(/^1 /, "1er ");
const argent = (n) => argentPdf(n);
const lendemain = (d) => new Date(new Date(d).getTime() + JOUR);
const jour = (n) => (Number(n) === 1 ? "1er" : String(n));
const pdfTexte = (t) => String(t ?? "").replace(/−/g, "-").replace(/→/g, "à").replace(/≈/g, "env.");
const dateHeure = (d) => new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(new Date(d)).replace(/^1 /, "1er ");

// Image d'une signature (data URL PNG) dans une case ; rien si elle est illisible
function imageSignature(doc, dataUrl, x, y, largeur, hauteur) {
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl || "");
  if (!m) return false;
  try {
    doc.image(Buffer.from(m[1], "base64"), x, y, { fit: [largeur, hauteur], valign: "bottom" });
    return true;
  } catch {
    return false;
  }
}

function nouveauDoc() {
  const doc = new PDFDocument({ size: "LETTER", margin: MARGE, bufferPages: true, info: { Producer: "Gestion immobilière" } });
  const morceaux = [];
  const fini = new Promise((resolve, reject) => {
    doc.on("data", (m) => morceaux.push(m));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);
  });
  return { doc, fini };
}

// En-tête : le locateur (l'entreprise) à gauche, le lieu et la date à droite
function enTete(doc, entreprise, { lieuDate }) {
  doc.fillColor(NOIR).font("Helvetica-Bold").fontSize(12).text(pdfTexte(entreprise.nomEntreprise), MARGE, MARGE, { width: 300 });
  doc.font("Helvetica").fontSize(9).fillColor(GRIS);
  const ville = [entreprise.ville, entreprise.province, entreprise.codePostal].filter(Boolean).join(" ");
  for (const l of [entreprise.adresseLigne1, ville || entreprise.adresseLigne2, entreprise.telephone, entreprise.courriel]) if (l) doc.text(pdfTexte(l), { width: 300 });
  const bas = doc.y;
  doc.fillColor(NOIR).fontSize(10).text(pdfTexte(lieuDate), MARGE + 300, MARGE, { width: LARGEUR - 300, align: "right" });
  doc.y = Math.max(bas, doc.y) + 22;
  doc.x = MARGE;
}

function destinataires(doc, bail, { mention } = {}) {
  if (mention) doc.font("Helvetica-Bold").fontSize(9).fillColor(GRIS).text(mention.toUpperCase());
  doc.font("Helvetica-Bold").fontSize(11).fillColor(NOIR).text(pdfTexte(bail.locataires.map((l) => l.nom).join(", ")));
  doc.font("Helvetica").fontSize(10).text(pdfTexte(adresseLogement(bail.logement)));
  doc.moveDown(1.4);
}

function titre(doc, texte, sousTitre) {
  doc.font("Helvetica-Bold").fontSize(15).fillColor(NOIR).text(pdfTexte(texte), { align: "left" });
  if (sousTitre) doc.font("Helvetica").fontSize(9).fillColor(GRIS).text(pdfTexte(sousTitre));
  doc.moveDown(1);
}

function paragraphe(doc, texte, { gras = false, taille = 10.5, couleur = NOIR, espace = 0.6 } = {}) {
  doc.font(gras ? "Helvetica-Bold" : "Helvetica").fontSize(taille).fillColor(couleur).text(pdfTexte(texte), MARGE, doc.y, { width: LARGEUR, align: "left", lineGap: 2 });
  doc.moveDown(espace);
}

// Tableau à deux colonnes : [libellé, valeur]
function lignes(doc, paires, { largeurLibelle = 190 } = {}) {
  for (const [l, v] of paires) {
    if (v == null || v === "") continue;
    const y = doc.y;
    doc.font("Helvetica").fontSize(10).fillColor(GRIS).text(pdfTexte(l), MARGE, y, { width: largeurLibelle });
    const h1 = doc.y;
    doc.font("Helvetica-Bold").fillColor(NOIR).text(pdfTexte(v), MARGE + largeurLibelle, y, { width: LARGEUR - largeurLibelle });
    doc.y = Math.max(h1, doc.y) + 3;
  }
  doc.x = MARGE;
  doc.moveDown(0.6);
}

function signature(doc, entreprise, { libelle = "Le locateur" } = {}) {
  if (doc.y > 640) doc.addPage();
  doc.moveDown(1.5);
  const y = doc.y + 28;
  doc.strokeColor(NOIR).lineWidth(0.6).moveTo(MARGE, y).lineTo(MARGE + 220, y).stroke();
  doc.font("Helvetica").fontSize(9).fillColor(GRIS).text(pdfTexte(`${libelle} — ${entreprise.personneResponsable || entreprise.nomEntreprise}`), MARGE, y + 4, { width: 300 });
  if (entreprise.personneResponsable) doc.text(pdfTexte(`pour ${entreprise.nomEntreprise}`), { width: 300 });
  doc.moveDown(1);
}

function piedPage(doc, texte) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bas = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(7.5).fillColor(GRIS).text(pdfTexte(texte), MARGE, 792 - 36, { width: LARGEUR, align: "center" });
    doc.page.margins.bottom = bas;
  }
}

function lieuDate(entreprise, d) {
  return `${entreprise.ville ? `${entreprise.ville}, le ` : "Le "}${date(d)}`;
}

// Coupon-réponse du locataire (avis de modification, avis de reprise).
// reponses : réponses signées en ligne [{ choix (rang), signataireNom,
// signature, reponduLe }] — la case cochée et la signature s'impriment.
function coupon(doc, bail, entreprise, choix, { titre: t, note, reponses = [] }) {
  if (doc.y > 560) doc.addPage();
  doc.moveDown(0.6);
  doc.strokeColor(GRIS).lineWidth(0.5).dash(4, { space: 3 }).moveTo(MARGE, doc.y).lineTo(MARGE + LARGEUR, doc.y).stroke().undash();
  doc.moveDown(0.8);
  paragraphe(doc, t, { gras: true, taille: 11.5 });
  paragraphe(doc, `À : ${entreprise.nomEntreprise}${entreprise.adresseLigne1 ? `, ${entreprise.adresseLigne1}` : ""}`, { taille: 9.5, couleur: GRIS, espace: 0.2 });
  paragraphe(doc, `Logement : ${adresseLogement(bail.logement)}`, { taille: 9.5, couleur: GRIS });
  const cochees = new Set(reponses.map((r) => r.choix));
  choix.forEach((c, i) => {
    const y = doc.y + 1;
    doc.rect(MARGE, y, 9, 9).lineWidth(0.8).strokeColor(NOIR).stroke();
    if (cochees.has(i)) doc.moveTo(MARGE + 1.5, y + 1.5).lineTo(MARGE + 7.5, y + 7.5).moveTo(MARGE + 7.5, y + 1.5).lineTo(MARGE + 1.5, y + 7.5).lineWidth(1.2).stroke();
    doc.font(cochees.has(i) ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(NOIR).text(pdfTexte(c), MARGE + 18, y - 1, { width: LARGEUR - 18 });
    doc.moveDown(0.5);
  });
  if (note) paragraphe(doc, note, { taille: 8.5, couleur: GRIS });
  if (reponses.length > 0) {
    doc.moveDown(0.6);
    for (const r of reponses) {
      if (doc.y > 792 - 140) doc.addPage();
      const y = doc.y + 4;
      imageSignature(doc, r.signature, MARGE, y, 200, 46);
      doc.strokeColor(NOIR).lineWidth(0.6).moveTo(MARGE, y + 50).lineTo(MARGE + 220, y + 50).stroke();
      doc.font("Helvetica").fontSize(8.5).fillColor(GRIS).text(pdfTexte(`${r.signataireNom} — signé électroniquement`), MARGE, y + 54, { width: 240 });
      doc.font("Helvetica").fontSize(10).fillColor(NOIR).text(pdfTexte(dateHeure(r.reponduLe)), MARGE + 280, y + 36, { width: LARGEUR - 280 });
      doc.font("Helvetica").fontSize(8.5).fillColor(GRIS).text("Date", MARGE + 280, y + 54);
      doc.x = MARGE;
      doc.y = y + 76;
    }
    return;
  }
  doc.moveDown(1.2);
  const y = doc.y + 16;
  doc.strokeColor(NOIR).lineWidth(0.6).moveTo(MARGE, y).lineTo(MARGE + 220, y).stroke();
  doc.moveTo(MARGE + 280, y).lineTo(MARGE + LARGEUR, y).stroke();
  doc.font("Helvetica").fontSize(8.5).fillColor(GRIS).text("Signature du locataire", MARGE, y + 4);
  doc.text("Date", MARGE + 280, y + 4);
}

// ---------- Documents ----------

// Avis de modification du bail (art. 1942 et suivants C.c.Q.)
// v : { nouveauLoyer, dateAvis, duree (mois, défaut = même durée), autresModifications }
async function avisModification(bail, entreprise, v) {
  const { doc, fini } = nouveauDoc();
  const debut = lendemain(bail.dateFin);
  const duree = Number(v.duree) || dureeMois(bail) || 12;
  const finNouveau = new Date(ajouterMois(debut, duree).getTime() - JOUR);
  const nouveau = Number(v.nouveauLoyer);
  enTete(doc, entreprise, { lieuDate: lieuDate(entreprise, v.dateAvis) });
  destinataires(doc, bail, { mention: "Locataire(s)" });
  titre(doc, "Avis de modification du bail", "Avis du locateur — articles 1942 et suivants du Code civil du Québec");
  paragraphe(doc, `Madame, Monsieur,`);
  paragraphe(doc, `Votre bail du logement situé au ${adresseLogement(bail.logement)} se termine le ${date(bail.dateFin)}. Je vous avise que je désire le reconduire en y apportant la ou les modifications suivantes, à compter du ${date(debut)} :`);
  lignes(doc, [
    ["Loyer actuel", `${argent(bail.loyer)} par mois`],
    ["Nouveau loyer", `${argent(nouveau)} par mois`],
    ["Augmentation", hausseLisible(bail.loyer, nouveau).replace("−", "-")],
    ["Durée du bail reconduit", `${duree} mois, du ${date(debut)} au ${date(finNouveau)}`],
    ["Autre(s) modification(s)", v.autresModifications || "Aucune — les autres conditions du bail demeurent les mêmes."],
  ]);
  paragraphe(doc, "Vous avez un mois à compter de la réception du présent avis pour m'aviser par écrit de votre décision :", { gras: true });
  paragraphe(doc, "• accepter la modification : le bail est reconduit aux nouvelles conditions ;\n• refuser la modification : vous pouvez demeurer dans le logement. Je pourrai alors, dans le mois suivant la réception de votre refus, demander au Tribunal administratif du logement (TAL) de fixer le loyer ou de statuer sur la modification ;\n• quitter le logement à la fin du bail.");
  paragraphe(doc, "Si vous ne répondez pas dans ce délai d'un mois, vous êtes réputé avoir accepté la modification.", { gras: true });
  paragraphe(doc, "Vous pouvez utiliser le coupon-réponse ci-dessous. Pour toute question, n'hésitez pas à communiquer avec moi.");
  signature(doc, entreprise);
  const ordreReponses = ["ACCEPTE", "REFUSE", "QUITTE"];
  const reponses = (v.signatures || []).filter((x) => x.statut === "SIGNE" && x.reponseAvis).map((x) => ({ ...x, choix: ordreReponses.indexOf(x.reponseAvis) }));
  coupon(doc, bail, entreprise, [
    `J'accepte la modification du bail (nouveau loyer de ${argent(nouveau)} par mois à compter du ${date(debut)}).`,
    "Je refuse la modification et je demeure dans le logement.",
    `Je quitterai le logement à la fin du bail, le ${date(bail.dateFin)}.`,
  ], { titre: "Réponse du locataire", note: reponses.length ? "Réponse donnée et signée en ligne — voir le certificat de signature joint." : "À retourner au locateur dans le mois suivant la réception de l'avis.", reponses });
  if (v.certificat) pagesCertificat(doc, entreprise, v.certificat);
  piedPage(doc, "Avis à conserver avec votre bail. Renseignements : Tribunal administratif du logement — tal.gouv.qc.ca");
  doc.end();
  return fini;
}

// Avis de reprise du logement (art. 1957 et suivants C.c.Q.)
// v : { dateAvis, dateReprise, beneficiaire, lien }
async function avisReprise(bail, entreprise, v) {
  const { doc, fini } = nouveauDoc();
  enTete(doc, entreprise, { lieuDate: lieuDate(entreprise, v.dateAvis) });
  destinataires(doc, bail, { mention: "Locataire(s)" });
  titre(doc, "Avis de reprise du logement", "Avis du locateur — articles 1957 et suivants du Code civil du Québec");
  paragraphe(doc, "Madame, Monsieur,");
  paragraphe(doc, `Je vous avise que j'entends reprendre le logement que vous occupez au ${adresseLogement(bail.logement)}, pour l'habiter ou y loger la personne suivante :`);
  lignes(doc, [
    ["Bénéficiaire de la reprise", v.beneficiaire],
    ["Lien avec le locateur", v.lien],
    ["Date de la reprise", date(v.dateReprise)],
  ]);
  paragraphe(doc, "Vous avez un mois à compter de la réception du présent avis pour m'aviser si vous avez l'intention de vous conformer à l'avis.", { gras: true });
  paragraphe(doc, "Si vous ne répondez pas dans ce délai, vous êtes réputé avoir refusé de quitter le logement. Je devrai alors demander au Tribunal administratif du logement (TAL) l'autorisation de reprendre le logement.");
  paragraphe(doc, "La loi prévoit une indemnité pour vos frais de déménagement. Certains locataires aînés à faible revenu qui occupent le logement depuis longtemps sont protégés contre la reprise. Renseignez-vous auprès du TAL.");
  signature(doc, entreprise);
  coupon(doc, bail, entreprise, [
    `Je quitterai le logement à la date de la reprise, le ${date(v.dateReprise)}.`,
    "Je refuse de quitter le logement.",
  ], { titre: "Réponse du locataire", note: "À retourner au locateur dans le mois suivant la réception de l'avis. Sans réponse, vous êtes réputé avoir refusé de quitter." });
  piedPage(doc, "Avis à conserver avec votre bail. Renseignements : Tribunal administratif du logement — tal.gouv.qc.ca");
  doc.end();
  return fini;
}

const MOTIFS_ACCES = {
  VERIFICATION: "vérifier l'état du logement",
  TRAVAUX: "effectuer des travaux",
  VISITE_ACHETEUR: "faire visiter le logement à un acheteur éventuel",
  VISITE_LOCATAIRE: "faire visiter le logement à un locataire éventuel",
};

// Avis d'accès au logement (art. 1931 et suivants C.c.Q.) — préavis de 24 heures
// v : { dateAvis, dateAcces, heure, motif, details }
async function avisAcces(bail, entreprise, v) {
  const { doc, fini } = nouveauDoc();
  enTete(doc, entreprise, { lieuDate: lieuDate(entreprise, v.dateAvis) });
  destinataires(doc, bail, { mention: "Locataire(s)" });
  titre(doc, "Avis d'accès au logement", "Préavis de 24 heures — articles 1931 et suivants du Code civil du Québec");
  paragraphe(doc, "Madame, Monsieur,");
  paragraphe(doc, `Je vous avise que je devrai accéder à votre logement afin de ${MOTIFS_ACCES[v.motif] || "vérifier l'état du logement"} :`);
  lignes(doc, [
    ["Date", date(v.dateAcces)],
    ["Heure prévue", v.heure],
    ["Précisions", v.details],
  ]);
  if (v.motif === "VISITE_ACHETEUR" || v.motif === "VISITE_LOCATAIRE") {
    paragraphe(doc, "Les visites ont lieu entre 9 h et 21 h. Vous pouvez exiger que le locateur ou son représentant soit présent.");
  }
  paragraphe(doc, "Si la date ou l'heure ne vous conviennent pas, communiquez avec moi pour en convenir d'une autre. Merci de votre collaboration.");
  signature(doc, entreprise);
  piedPage(doc, `${entreprise.nomEntreprise}${entreprise.telephone ? ` — ${entreprise.telephone}` : ""}`);
  doc.end();
  return fini;
}

// Charges impayées, des plus anciennes aux plus récentes, qui expliquent le solde
function impayes(bail) {
  let reste = soldeBail(bail);
  const out = [];
  for (const c of [...bail.charges].sort((a, b) => new Date(b.date) - new Date(a.date))) {
    if (reste <= 0.005) break;
    if (c.montant <= 0) continue;
    const part = Math.min(c.montant, reste);
    out.unshift({ libelle: c.description || (c.periode ? `Loyer — ${periodeLisible(c.periode)}` : "Montant dû"), date: c.date, montant: part, partiel: part < c.montant });
    reste = Math.round((reste - part) * 100) / 100;
  }
  return out;
}

function tableauImpayes(doc, bail) {
  const liste = impayes(bail);
  for (const l of liste) {
    const y = doc.y;
    doc.font("Helvetica").fontSize(10).fillColor(NOIR).text(pdfTexte(`${l.libelle}${l.partiel ? " (solde)" : ""}`), MARGE + 10, y, { width: 300 });
    doc.text(`dû le ${date(l.date)}`, MARGE + 310, y, { width: 110 });
    doc.text(argent(l.montant), MARGE + 420, y, { width: LARGEUR - 420, align: "right" });
    doc.y = Math.max(doc.y, y + 14);
  }
  doc.moveTo(MARGE, doc.y + 2).lineTo(MARGE + LARGEUR, doc.y + 2).lineWidth(0.6).strokeColor(NOIR).stroke();
  const y = doc.y + 6;
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(NOIR).text("Total dû", MARGE + 10, y, { width: 300 });
  doc.text(argent(soldeBail(bail)), MARGE + 420, y, { width: LARGEUR - 420, align: "right" });
  doc.x = MARGE;
  doc.moveDown(1.2);
}

// Rappel amiable de loyer en retard. v : { dateAvis, delaiJours }
async function rappelRetard(bail, entreprise, v) {
  const { doc, fini } = nouveauDoc();
  enTete(doc, entreprise, { lieuDate: lieuDate(entreprise, v.dateAvis) });
  destinataires(doc, bail, { mention: "Locataire(s)" });
  titre(doc, "Rappel — loyer en retard");
  paragraphe(doc, "Madame, Monsieur,");
  paragraphe(doc, `Sauf erreur de notre part, les montants suivants demeurent impayés pour le logement situé au ${adresseLogement(bail.logement)} :`);
  tableauImpayes(doc, bail);
  paragraphe(doc, `Nous vous demandons de régulariser la situation d'ici ${v.delaiJours || 10} jours. Si vous éprouvez des difficultés, communiquez avec nous rapidement : une entente de paiement est possible.`);
  paragraphe(doc, "Si votre paiement a été fait entre-temps, veuillez ne pas tenir compte du présent rappel.");
  signature(doc, entreprise);
  piedPage(doc, `${entreprise.nomEntreprise}${entreprise.telephone ? ` — ${entreprise.telephone}` : ""}${entreprise.courriel ? ` — ${entreprise.courriel}` : ""}`);
  doc.end();
  return fini;
}

// Mise en demeure de payer le loyer. v : { dateAvis, delaiJours }
async function miseEnDemeure(bail, entreprise, v) {
  const { doc, fini } = nouveauDoc();
  enTete(doc, entreprise, { lieuDate: lieuDate(entreprise, v.dateAvis) });
  paragraphe(doc, "PAR COURRIER RECOMMANDÉ OU POSTE CERTIFIÉE", { gras: true, taille: 9, couleur: GRIS, espace: 0.8 });
  destinataires(doc, bail, { mention: "Locataire(s)" });
  titre(doc, "Mise en demeure");
  paragraphe(doc, "Madame, Monsieur,");
  paragraphe(doc, `En vertu du bail du logement situé au ${adresseLogement(bail.logement)}, vous devez payer votre loyer de ${argent(bail.loyer)} le ${jour(bail.jourPaiement)} de chaque mois. Malgré nos rappels, les sommes suivantes demeurent impayées :`);
  tableauImpayes(doc, bail);
  paragraphe(doc, `Par la présente, nous vous mettons en demeure de payer la somme de ${argent(soldeBail(bail))} dans les ${v.delaiJours || 10} jours de la réception de cette lettre.`, { gras: true });
  paragraphe(doc, "À défaut, nous nous adresserons au Tribunal administratif du logement, sans autre avis ni délai, afin d'obtenir le recouvrement des sommes dues avec les intérêts et l'indemnité additionnelle prévus par la loi, ainsi que, le retard dépassant trois semaines, la résiliation du bail et votre expulsion (article 1971 du Code civil du Québec).");
  paragraphe(doc, "Veuillez agir en conséquence.");
  signature(doc, entreprise);
  piedPage(doc, "Conservez une preuve de l'envoi et de la réception de cette mise en demeure.");
  doc.end();
  return fini;
}

const PIECES = ["Entrée", "Cuisine", "Salon", "Salle à manger", "Chambre 1", "Chambre 2", "Chambre 3", "Salle de bain", "Salle de lavage", "Balcon / galerie", "Rangement / casier"];
const ELEMENTS = ["Murs et plafonds", "Planchers", "Portes et serrures", "Fenêtres et moustiquaires", "Prises, interrupteurs, luminaires", "Plomberie (robinets, évier, toilette)", "Électroménagers fournis", "Détecteur de fumée"];

// État des lieux (entrée ou sortie) : grille à remplir sur place.
// v : { moment: "ENTREE" | "SORTIE", dateVisite }
async function etatDesLieux(bail, entreprise, v) {
  const { doc, fini } = nouveauDoc();
  const sortie = v.moment === "SORTIE";
  enTete(doc, entreprise, { lieuDate: lieuDate(entreprise, v.dateVisite) });
  titre(doc, `État des lieux — ${sortie ? "sortie" : "entrée"}`, "À remplir ensemble, sur place ; chaque partie garde un exemplaire signé.");
  lignes(doc, [
    ["Logement", adresseLogement(bail.logement)],
    ["Pièces", bail.logement.pieces],
    ["Locataire(s)", nomsLocataires(bail)],
    ["Bail", `du ${date(bail.dateDebut)}${bail.dateFin ? ` au ${date(bail.dateFin)}` : " (durée indéterminée)"}`],
    ["Date de la visite", date(v.dateVisite)],
  ]);
  // Grille : pièce / élément / bon / à réparer / remarques
  const cols = [{ t: "Pièce", w: 120 }, { t: "Bon", w: 34 }, { t: "Usé", w: 34 }, { t: "À réparer", w: 52 }, { t: "Remarques (photos, dommages, réparations à faire)", w: LARGEUR - 240 }];
  const ligneGrille = (valeurs, { gras = false, h = 22 } = {}) => {
    if (doc.y + h > 792 - 60) doc.addPage();
    const y = doc.y;
    let x = MARGE;
    cols.forEach((c, i) => {
      doc.rect(x, y, c.w, h).lineWidth(0.5).strokeColor("#999999").stroke();
      if (valeurs[i]) doc.font(gras ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(NOIR).text(pdfTexte(valeurs[i]), x + 4, y + 6, { width: c.w - 8, height: h - 6 });
      x += c.w;
    });
    doc.y = y + h;
    doc.x = MARGE;
  };
  ligneGrille(cols.map((c) => c.t), { gras: true, h: 20 });
  for (const p of PIECES) ligneGrille([p]);
  doc.moveDown(0.8);
  paragraphe(doc, "Éléments à vérifier dans chaque pièce : " + ELEMENTS.join(" · ") + ".", { taille: 8.5, couleur: GRIS });
  if (doc.y > 560) doc.addPage();
  paragraphe(doc, "Compteurs et clés", { gras: true });
  lignes(doc, [
    ["Relevé du compteur d'électricité", "______________________"],
    ["Clés de porte remises", "______"],
    ["Clés de boîte aux lettres / casier", "______"],
    ["Télécommandes, cartes d'accès", "______"],
  ], { largeurLibelle: 230 });
  if (sortie) paragraphe(doc, "Adresse où joindre le locataire après son départ : ____________________________________________", { taille: 10 });
  doc.moveDown(1);
  const y = doc.y + 24;
  doc.strokeColor(NOIR).lineWidth(0.6).moveTo(MARGE, y).lineTo(MARGE + 210, y).stroke();
  doc.moveTo(MARGE + LARGEUR - 210, y).lineTo(MARGE + LARGEUR, y).stroke();
  doc.font("Helvetica").fontSize(8.5).fillColor(GRIS).text("Le locateur", MARGE, y + 4);
  doc.text("Le ou les locataires", MARGE + LARGEUR - 210, y + 4);
  piedPage(doc, `État des lieux — ${adresseLogement(bail.logement)}`);
  doc.end();
  return fini;
}

// Fiche de bail : tout ce qu'il faut pour remplir le formulaire obligatoire du TAL
async function ficheBail(bail, entreprise, v) {
  const { doc, fini } = nouveauDoc();
  enTete(doc, entreprise, { lieuDate: lieuDate(entreprise, v.dateAvis) });
  titre(doc, "Fiche de bail", "Renseignements pour remplir le formulaire de bail obligatoire du Tribunal administratif du logement");
  paragraphe(doc, "Ce document ne remplace pas le bail. Le bail d'un logement doit être fait sur le formulaire obligatoire du TAL ; le locateur en remet un exemplaire au locataire dans les 10 jours de sa conclusion.", { taille: 9, couleur: GRIS, espace: 1 });
  paragraphe(doc, "Parties", { gras: true, taille: 11.5 });
  lignes(doc, [
    ["Locateur", entreprise.nomEntreprise],
    ["Adresse du locateur", [entreprise.adresseLigne1, [entreprise.ville, entreprise.province, entreprise.codePostal].filter(Boolean).join(" ")].filter(Boolean).join(", ")],
    ["Téléphone / courriel", [entreprise.telephone, entreprise.courriel].filter(Boolean).join(" · ")],
    ...bail.locataires.map((l, i) => [`Locataire ${bail.locataires.length > 1 ? i + 1 : ""}`.trim(), [l.nom, l.telephone, l.courriel].filter(Boolean).join(" · ")]),
  ]);
  paragraphe(doc, "Logement", { gras: true, taille: 11.5 });
  lignes(doc, [
    ["Adresse", adresseLogement(bail.logement)],
    ["Nombre de pièces", bail.logement.pieces],
    ["Superficie", bail.logement.superficie ? `${String(bail.logement.superficie).replace(".", ",")} pi²` : null],
  ]);
  paragraphe(doc, "Durée et loyer", { gras: true, taille: 11.5 });
  const duree = dureeMois(bail);
  lignes(doc, [
    ["Durée", bail.dateFin ? `${duree ? `${duree} mois, ` : ""}du ${date(bail.dateDebut)} au ${date(bail.dateFin)}` : `Durée indéterminée, à compter du ${date(bail.dateDebut)}`],
    ["Loyer", `${argent(bail.loyer)} par mois`],
    ["Payable le", `${jour(bail.jourPaiement)} de chaque mois`],
    ["Services et conditions inclus", servicesLisibles(bail.services) || "Aucun"],
    ["Accessoires et dépendances", bail.accessoires],
    ["Conditions particulières", bail.conditions],
    ["Loyer le plus bas des 12 derniers mois (G)", bail.loyerAncien != null ? argent(bail.loyerAncien) : null],
    ["Notes internes", bail.notes],
  ]);
  paragraphe(doc, "À ne pas oublier au formulaire : le loyer le plus bas payé au cours des 12 mois précédant le début du bail (section G), sauf pour un immeuble construit depuis 5 ans ou moins, ainsi que le règlement de l'immeuble remis au locataire, s'il y en a un.", { taille: 9, couleur: GRIS });
  piedPage(doc, "Fiche interne — le bail signé se dépose dans les documents du bail.");
  doc.end();
  return fini;
}

// ---------- Bail de logement ----------

// Titre de section du bail : « A  Entre les soussignés »
function sectionBail(doc, lettre, texte) {
  if (doc.y > 792 - 150) doc.addPage();
  doc.moveDown(0.5);
  const y = doc.y;
  doc.rect(MARGE, y, LARGEUR, 20).fillColor("#EDEAE2").fill();
  doc.font("Helvetica-Bold").fontSize(11).fillColor(NOIR).text(lettre, MARGE + 8, y + 5, { width: 20 });
  doc.text(pdfTexte(texte), MARGE + 30, y + 5, { width: LARGEUR - 40 });
  doc.y = y + 28;
  doc.x = MARGE;
}

// Case à cocher avec son libellé
function caseCochee(doc, coche, texte, { x = MARGE, largeur = LARGEUR } = {}) {
  const y = doc.y + 1;
  doc.rect(x, y, 9, 9).lineWidth(0.8).strokeColor(NOIR).stroke();
  if (coche) doc.moveTo(x + 1.5, y + 1.5).lineTo(x + 7.5, y + 7.5).moveTo(x + 7.5, y + 1.5).lineTo(x + 1.5, y + 7.5).lineWidth(1.2).stroke();
  doc.font("Helvetica").fontSize(10).fillColor(NOIR).text(pdfTexte(texte), x + 16, y - 1, { width: largeur - 16, lineGap: 1.5 });
  doc.moveDown(0.35);
}

// Case de signature d'une partie : signature reçue en ligne, ou ligne à signer
function caseSignatureBail(doc, x, y, largeur, { qualite, nom, recue }) {
  if (recue) imageSignature(doc, recue.signature, x, y, largeur - 10, 44);
  doc.strokeColor(NOIR).lineWidth(0.6).moveTo(x, y + 48).lineTo(x + largeur - 10, y + 48).stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(NOIR).text(pdfTexte(nom), x, y + 52, { width: largeur - 10 });
  doc.font("Helvetica").fontSize(8.5).fillColor(GRIS).text(pdfTexte(recue ? `${qualite} — signé électroniquement le ${dateHeure(recue.reponduLe)}` : `${qualite} — date : ____________________`), x, doc.y, { width: largeur - 10 });
  return doc.y;
}

// Bail de logement complet : les sections A à H du formulaire obligatoire du
// TAL, remplies avec la fiche du bail, avec une case de signature pour le
// locateur et chaque locataire (et la caution). v : { dateAvis, lieu,
// signatures, certificat }
async function bailLogement(bail, entreprise, v) {
  const { doc, fini } = nouveauDoc();
  const l = bail.logement;
  const services = new Set(servicesListe(bail.services));
  const duree = dureeMois(bail);
  const adresseLocateur = [entreprise.adresseLigne1, [entreprise.ville, entreprise.province, entreprise.codePostal].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  doc.font("Helvetica-Bold").fontSize(18).fillColor(NOIR).text("BAIL DE LOGEMENT", MARGE, MARGE, { width: LARGEUR, align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor(GRIS).text(pdfTexte("Bail d'un logement au Québec — reprend les sections du formulaire de bail obligatoire du Tribunal administratif du logement (TAL)"), { width: LARGEUR, align: "center" });
  doc.moveDown(0.8);

  sectionBail(doc, "A", "Entre les soussignés");
  paragraphe(doc, "Le locateur", { gras: true, taille: 10, espace: 0.2 });
  lignes(doc, [
    ["Nom", entreprise.nomEntreprise],
    ["Représenté par", entreprise.personneResponsable],
    ["Adresse", adresseLocateur],
    ["Téléphone / courriel", [entreprise.telephone, entreprise.courriel].filter(Boolean).join(" · ")],
  ], { largeurLibelle: 150 });
  paragraphe(doc, bail.locataires.length > 1 ? "Les locataires" : "Le locataire", { gras: true, taille: 10, espace: 0.2 });
  lignes(doc, bail.locataires.map((x, i) => [bail.locataires.length > 1 ? `Locataire ${i + 1}` : "Nom", [x.nom, x.telephone, x.courriel].filter(Boolean).join(" · ")]), { largeurLibelle: 150 });
  if (bail.caution) lignes(doc, [["Caution", bail.caution]], { largeurLibelle: 150 });
  if (bail.locataires.length > 1) paragraphe(doc, "Les locataires sont tenus solidairement aux obligations du bail seulement si une clause le prévoit à la section E.", { taille: 8.5, couleur: GRIS });

  sectionBail(doc, "B", "Description et destination du logement loué, des accessoires et dépendances");
  lignes(doc, [
    ["Adresse du logement", adresseLogement(l)],
    ["Nombre de pièces", l.pieces],
    ["Étage", l.etage],
    ["Superficie", l.superficie ? `${String(l.superficie).replace(".", ",")} pi²` : null],
    ["Accessoires et dépendances", [bail.accessoires, services.has("STATIONNEMENT") && !/stationnement/i.test(bail.accessoires || "") ? "stationnement" : null, services.has("RANGEMENT") && !/(rangement|casier|remise)/i.test(bail.accessoires || "") ? "espace de rangement" : null].filter(Boolean).join(", ") || "Aucun"],
  ], { largeurLibelle: 170 });
  caseCochee(doc, !bail.usageMixte, "Le logement est loué à des fins d'habitation seulement.");
  caseCochee(doc, bail.usageMixte, "Le logement est loué à des fins d'habitation et aussi d'usage professionnel ou commercial (au plus le tiers de la superficie).");
  caseCochee(doc, services.has("MEUBLE"), "Le logement est loué meublé (meubles et électroménagers indiqués à la section E).");
  doc.moveDown(0.3);

  sectionBail(doc, "C", "Durée du bail");
  if (bail.dateFin) {
    caseCochee(doc, true, `Bail à durée fixe de ${duree ? `${duree} mois` : "durée fixe"}, du ${date(bail.dateDebut)} au ${date(bail.dateFin)}.`);
    paragraphe(doc, "À la fin du bail, celui-ci se reconduit de plein droit aux mêmes conditions et pour la même durée (au plus 12 mois), sauf avis de modification ou de non-reconduction donné dans les délais prévus par la loi (art. 1941 et suivants C.c.Q.).", { taille: 9, couleur: GRIS });
  } else {
    caseCochee(doc, true, `Bail à durée indéterminée, à compter du ${date(bail.dateDebut)}.`);
  }

  sectionBail(doc, "D", "Loyer");
  lignes(doc, [
    ["Loyer", `${argent(bail.loyer)} par mois`],
    ["Payable le", `${jour(bail.jourPaiement)} jour de chaque mois`],
    ["Premier paiement", bail.premierPaiementLe ? date(bail.premierPaiementLe) : `${date(bail.dateDebut)} (premier mois du bail)`],
    ["Mode de paiement", bail.modePaiement ? libelle(MODES_PAIEMENT, bail.modePaiement) : null],
    ["Lieu du paiement", bail.lieuPaiement],
  ], { largeurLibelle: 170 });
  caseCochee(doc, bail.chequesPostdates, "Le locataire accepte de remettre des chèques postdatés.");
  paragraphe(doc, "Le locateur ne peut exiger d'avance que le paiement du premier mois de loyer, ni aucune autre somme (dépôt de garantie, clés…), ni la remise de chèques postdatés (art. 1904 C.c.Q.).", { taille: 9, couleur: GRIS });

  sectionBail(doc, "E", "Services et conditions");
  paragraphe(doc, "Règlement de l'immeuble", { gras: true, taille: 10, espace: 0.2 });
  caseCochee(doc, Boolean(bail.reglementRemisLe), bail.reglementRemisLe ? `Un exemplaire du règlement de l'immeuble a été remis au locataire le ${date(bail.reglementRemisLe)}, avant la conclusion du bail ; il fait partie du bail.` : "Un exemplaire du règlement de l'immeuble a été remis au locataire avant la conclusion du bail.");
  caseCochee(doc, !bail.reglementRemisLe, "Il n'y a pas de règlement d'immeuble remis au locataire.");
  doc.moveDown(0.3);
  paragraphe(doc, "Travaux et réparations", { gras: true, taille: 10, espace: 0.2 });
  paragraphe(doc, bail.travauxPromis ? `Le locateur s'engage à faire les travaux suivants : ${bail.travauxPromis}` : "Aucun travail ni réparation n'est prévu avant la délivrance du logement ou pendant le bail.", { taille: 10 });
  paragraphe(doc, "Services compris dans le loyer", { gras: true, taille: 10, espace: 0.3 });
  const colonnes = 2;
  const largeurColonne = LARGEUR / colonnes;
  const liste = SERVICES_BAIL.filter((x) => x.code !== "MEUBLE");
  for (let i = 0; i < liste.length; i += colonnes) {
    const y = doc.y;
    let bas = y;
    for (let j = 0; j < colonnes && i + j < liste.length; j++) {
      const svc = liste[i + j];
      doc.y = y;
      caseCochee(doc, services.has(svc.code), `${svc.label} — ${services.has(svc.code) ? "compris (à la charge du locateur)" : "à la charge du locataire"}`, { x: MARGE + j * largeurColonne, largeur: largeurColonne - 8 });
      bas = Math.max(bas, doc.y);
    }
    doc.y = bas;
  }
  doc.x = MARGE;
  doc.moveDown(0.4);
  lignes(doc, [
    ["Chauffage du logement", bail.chauffage ? libelle(CHAUFFAGES, bail.chauffage) : null],
    ["Animaux", bail.animaux ? libelle(ANIMAUX, bail.animaux) : null],
    ["Usage du tabac et du cannabis", bail.fumeur ? libelle(FUMEUR, bail.fumeur) : null],
    ["Assurance", bail.assuranceResponsabilite ? "Le locataire s'engage à détenir une assurance responsabilité civile pendant toute la durée du bail et à en fournir la preuve sur demande." : null],
  ], { largeurLibelle: 170 });
  paragraphe(doc, "Autres services, conditions et restrictions", { gras: true, taille: 10, espace: 0.2 });
  paragraphe(doc, bail.conditions || "Aucune.", { taille: 10 });

  sectionBail(doc, "F", "Restrictions au droit à la fixation du loyer et à la modification du bail");
  if (bail.immeubleNeuf) {
    caseCochee(doc, true, "Le logement est situé dans un immeuble construit, ou dont l'utilisation a été changée à des fins locatives, depuis 5 ans ou moins.");
    paragraphe(doc, "Pendant ces 5 ans, le locataire ne peut pas faire fixer le loyer ni modifier une autre condition du bail par le Tribunal administratif du logement. S'il refuse une modification proposée par le locateur, il doit quitter le logement à la fin du bail.", { taille: 9.5 });
    lignes(doc, [["Hausse de loyer maximale pendant ces 5 ans", bail.hausseMaximaleF || "____________________"]], { largeurLibelle: 240 });
  } else {
    caseCochee(doc, false, "Le logement est situé dans un immeuble construit, ou dont l'utilisation a été changée à des fins locatives, depuis 5 ans ou moins.");
    paragraphe(doc, "Ne s'applique pas : le locataire conserve son droit de faire fixer le loyer par le Tribunal administratif du logement.", { taille: 9.5, couleur: GRIS });
  }

  sectionBail(doc, "G", "Avis au nouveau locataire");
  if (bail.immeubleNeuf) {
    paragraphe(doc, "Ne s'applique pas : immeuble visé à la section F.", { taille: 9.5, couleur: GRIS });
  } else {
    paragraphe(doc, `Le locateur avise le nouveau locataire que le loyer le plus bas payé au cours des 12 mois précédant le début du bail, ou le loyer fixé par le Tribunal au cours de cette période, était de ${bail.loyerAncien != null ? `${argent(bail.loyerAncien)} par mois` : "__________ $ par mois"}.`, { taille: 10 });
    if (bail.loyerAncienNote) paragraphe(doc, bail.loyerAncienNote, { taille: 9.5 });
    paragraphe(doc, "Si le loyer convenu est plus élevé, le locataire peut demander au Tribunal administratif du logement de le fixer, dans les 10 jours de la conclusion du bail (dans les 2 mois du début du bail s'il n'a pas reçu cet avis ; dans les 2 mois où il découvre qu'une fausse déclaration a été faite).", { taille: 9, couleur: GRIS });
  }

  if (doc.y > 792 - 260) doc.addPage(); // le titre reste avec les premières cases de signature
  sectionBail(doc, "H", "Signatures");
  paragraphe(doc, `Signé${v.lieu ? ` à ${v.lieu}` : entreprise.ville ? ` à ${entreprise.ville}` : ""}, le ${date(v.dateAvis)}. Les parties peuvent signer ce bail électroniquement ; la signature électronique a la même valeur que la signature manuscrite.`, { taille: 10 });
  const recues = v.signatures || [];
  const recue = (role, locataireId) => recues.find((x) => x.statut === "SIGNE" && x.role === role && (role === "LOCATEUR" || x.locataireId === locataireId));
  const parties = [
    { qualite: "Le locateur", nom: entreprise.personneResponsable ? `${entreprise.personneResponsable}, pour ${entreprise.nomEntreprise}` : entreprise.nomEntreprise, recue: recue("LOCATEUR") },
    ...bail.locataires.map((x) => ({ qualite: "Locataire", nom: x.nom, recue: recue("LOCATAIRE", x.id) })),
    ...(bail.caution ? [{ qualite: "Caution", nom: bail.caution.split(/[,·]/)[0] }] : []),
  ];
  const largeurCase = LARGEUR / 2;
  for (let i = 0; i < parties.length; i += 2) {
    if (doc.y > 792 - 160) doc.addPage();
    const y = doc.y + 6;
    let bas = y;
    for (let j = 0; j < 2 && i + j < parties.length; j++) bas = Math.max(bas, caseSignatureBail(doc, MARGE + j * largeurCase, y, largeurCase, parties[i + j]));
    doc.x = MARGE;
    doc.y = bas + 14;
  }
  paragraphe(doc, "Le locateur doit remettre un exemplaire du bail au locataire dans les 10 jours de sa conclusion (art. 1895 C.c.Q.).", { taille: 9, couleur: GRIS });

  // Rappels de la loi
  if (doc.y > 792 - 230) doc.addPage();
  doc.moveDown(0.6);
  paragraphe(doc, "Rappel de quelques règles (Code civil du Québec)", { gras: true, taille: 10.5, espace: 0.3 });
  paragraphe(doc, [
    "• Le locateur délivre le logement en bon état d'habitabilité, de réparation et de propreté, et en assure la jouissance paisible pendant le bail.",
    "• Le locataire paie le loyer à la date convenue, utilise le logement avec prudence et diligence, le garde en bon état de propreté et fait les menues réparations d'entretien.",
    "• Le locateur peut visiter le logement, y faire des travaux ou le faire visiter à un locataire ou un acheteur éventuel après un préavis de 24 heures, entre 9 h et 21 h, sauf urgence.",
    "• Le locataire peut sous-louer le logement ou céder le bail en avisant le locateur ; celui-ci ne peut refuser sans un motif sérieux.",
    "• Pour modifier le loyer ou une autre condition au renouvellement, le locateur envoie un avis de modification dans les délais prévus ; le locataire a un mois pour répondre.",
    "• Renseignements : Tribunal administratif du logement — tal.gouv.qc.ca.",
  ].join("\n"), { taille: 9 });

  if (v.certificat) pagesCertificat(doc, entreprise, v.certificat);
  piedPage(doc, `Bail de logement — ${adresseLogement(l)}`);
  doc.end();
  return fini;
}

// ---------- Certificat de signature électronique ----------

const navigateurCourt = (ua) => {
  const s = String(ua || "");
  const appareil = /iPhone|iPad/.test(s) ? "iPhone/iPad" : /Android/.test(s) ? "Android" : /Windows/.test(s) ? "Windows" : /Mac OS X|Macintosh/.test(s) ? "Mac" : /Linux/.test(s) ? "Linux" : "";
  const nav = /Edg\//.test(s) ? "Edge" : /Firefox\//.test(s) ? "Firefox" : /Chrome\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : "";
  return [nav, appareil].filter(Boolean).join(" sur ") || s.slice(0, 60);
};

// Pages du certificat de signature, ajoutées au document en cours.
// c : { titre, documentId, empreinte, signatures: [SignatureImmo], finaliseLe }
function pagesCertificat(doc, entreprise, c) {
  doc.addPage();
  doc.font("Helvetica-Bold").fontSize(15).fillColor(NOIR).text("Certificat de signature électronique", MARGE, MARGE, { width: LARGEUR });
  doc.font("Helvetica").fontSize(9).fillColor(GRIS).text(pdfTexte(`${entreprise.nomEntreprise} — produit le ${dateHeure(c.finaliseLe || new Date())}`));
  doc.moveDown(1);
  lignes(doc, [
    ["Document", c.titre],
    ["Référence", c.documentId],
    ["Empreinte SHA-256 du document signé", c.empreinte],
  ], { largeurLibelle: 200 });
  paragraphe(doc, "Chaque signataire a reçu un lien personnel et secret, a ouvert le document, a déclaré l'avoir lu et a consenti à le signer électroniquement en traçant sa signature et en inscrivant son nom. L'empreinte SHA-256 identifie le document présenté : toute modification du fichier la changerait.", { taille: 9, couleur: GRIS, espace: 1 });
  for (const sig of c.signatures) {
    if (doc.y > 792 - 190) doc.addPage();
    const y0 = doc.y;
    doc.rect(MARGE, y0, LARGEUR, 1).fillColor("#cccccc").fill();
    doc.y = y0 + 8;
    paragraphe(doc, `${sig.role === "LOCATEUR" ? "Locateur" : "Locataire"} — ${sig.nom}`, { gras: true, taille: 10.5, espace: 0.3 });
    lignes(doc, [
      ["État", libelle(STATUTS_SIGNATURE, sig.statut)],
      ["Réponse", sig.reponseAvis ? libelle(REPONSES_AVIS, sig.reponseAvis) : null],
      ["Nom inscrit en signant", sig.signataireNom],
      ["Lien envoyé à", sig.courriel],
      ["Demande faite le", sig.demandeLe ? dateHeure(sig.demandeLe) : null],
      ["Document ouvert le", sig.vuLe ? dateHeure(sig.vuLe) : null],
      [sig.statut === "REFUSE" ? "Refusé le" : "Signé le", sig.reponduLe ? dateHeure(sig.reponduLe) : null],
      ["Adresse IP", sig.ip],
      ["Navigateur", sig.navigateur ? navigateurCourt(sig.navigateur) : null],
      ["Message", sig.note],
    ], { largeurLibelle: 160 });
    if (sig.signature) {
      const y = doc.y;
      imageSignature(doc, sig.signature, MARGE + 160, y, 200, 50);
      doc.y = y + 58;
    }
    doc.x = MARGE;
  }
}

// Certificat de signature seul (document déposé, qu'on ne peut pas
// reproduire) : il accompagne le fichier d'origine, que l'empreinte identifie
async function certificatSignature(entreprise, c) {
  const { doc, fini } = nouveauDoc();
  enTete(doc, entreprise, { lieuDate: lieuDate(entreprise, c.finaliseLe || new Date()) });
  doc.font("Helvetica").fontSize(9).fillColor(GRIS).text(pdfTexte("Ce certificat accompagne le fichier d'origine du document, conservé tel quel ; l'empreinte SHA-256 ci-dessous l'identifie."), MARGE, doc.y, { width: LARGEUR });
  pagesCertificat(doc, entreprise, c);
  piedPage(doc, `Certificat de signature — ${c.titre}`);
  doc.end();
  return fini;
}

// Reçu d'un paiement de loyer. paiement : { id, date, montant, mode, reference }
async function recuLoyer(bail, entreprise, paiement) {
  const { doc, fini } = nouveauDoc();
  enTete(doc, entreprise, { lieuDate: lieuDate(entreprise, paiement.date) });
  titre(doc, "Reçu de loyer", `Reçu n° R-${new Date(paiement.date).getUTCFullYear()}-${paiement.id.slice(-6).toUpperCase()}`);
  // Solde du compte après ce paiement
  const avant = (x) => new Date(x.date) <= new Date(paiement.date);
  const anterieur = (p) => new Date(p.date) < new Date(paiement.date) || (avant(p) && new Date(p.creeLe) <= new Date(paiement.creeLe));
  const solde = soldeBail({ charges: bail.charges.filter(avant), paiements: bail.paiements.filter(anterieur) });
  lignes(doc, [
    ["Reçu de", nomsLocataires(bail)],
    ["Montant", argent(paiement.montant)],
    ["Date du paiement", date(paiement.date)],
    ["Mode de paiement", paiement.mode ? libelle(MODES_PAIEMENT, paiement.mode) : null],
    ["Référence", paiement.reference],
    ["Pour le logement", adresseLogement(bail.logement)],
    ["Loyer mensuel", argent(bail.loyer)],
    ["Solde du compte après ce paiement", solde > 0.005 ? `${argent(solde)} dû` : solde < -0.005 ? `${argent(-solde)} payé d'avance` : "0,00 $ — compte à jour"],
  ], { largeurLibelle: 210 });
  signature(doc, entreprise, { libelle: "Reçu par" });
  piedPage(doc, `${entreprise.nomEntreprise} — reçu à conserver`);
  doc.end();
  return fini;
}

// locataire : le document lui est adressé → montré dans son portail
export const TYPES_DOCUMENTS_GENERES = {
  AVIS_MODIFICATION: { label: "Avis de modification du bail", categorie: "AVIS", locataire: true, fonction: avisModification },
  AVIS_REPRISE: { label: "Avis de reprise du logement", categorie: "AVIS", locataire: true, fonction: avisReprise },
  AVIS_ACCES: { label: "Avis d'accès au logement (24 h)", categorie: "AVIS", locataire: true, fonction: avisAcces },
  RAPPEL_RETARD: { label: "Rappel de loyer en retard", categorie: "AVIS", locataire: true, fonction: rappelRetard },
  MISE_EN_DEMEURE: { label: "Mise en demeure", categorie: "AVIS", locataire: true, fonction: miseEnDemeure },
  ETAT_LIEUX: { label: "État des lieux", categorie: "ETAT_LIEUX", locataire: true, fonction: etatDesLieux },
  FICHE_BAIL: { label: "Fiche de bail", categorie: "BAIL", fonction: ficheBail },
  // signature : se fait signer en ligne (lib/signatureImmo.js) — PARTIES :
  // le locateur et chaque locataire signent ; AVIS : chaque locataire répond
  // (accepte, refuse, quitte) et signe sa réponse
  BAIL_LOGEMENT: { label: "Bail de logement", categorie: "BAIL", locataire: true, signature: "PARTIES", fonction: bailLogement },
};
TYPES_DOCUMENTS_GENERES.AVIS_MODIFICATION.signature = "AVIS";

// Relevé de compte d'un bail : les mouvements des 12 derniers mois (solde
// reporté avant), le solde à ce jour. v : { dateAvis, mois (défaut 12) }
async function releveCompte(bail, entreprise, v = {}) {
  const { doc, fini } = nouveauDoc();
  const auj = v.dateAvis ? new Date(v.dateAvis) : new Date();
  const depuis = ajouterMois(auj, -(v.mois || 12));
  const toutes = releveBail(bail);
  const anterieures = toutes.filter((l) => new Date(l.date) < depuis);
  const lignesPeriode = toutes.filter((l) => new Date(l.date) >= depuis && new Date(l.date) <= auj);
  const report = anterieures.length ? anterieures.at(-1).solde : 0;
  const solde = lignesPeriode.length ? lignesPeriode.at(-1).solde : report;
  enTete(doc, entreprise, { lieuDate: lieuDate(entreprise, auj) });
  destinataires(doc, bail, { mention: "Locataire(s)" });
  titre(doc, "Relevé de compte", `Du ${date(depuis)} au ${date(auj)} · loyer de ${argent(bail.loyer)} par mois`);
  const cols = [{ t: "Date", w: 108, a: "left" }, { t: "Détail", w: LARGEUR - 108 - 85 - 85, a: "left" }, { t: "Montant", w: 85, a: "right" }, { t: "Solde", w: 85, a: "right" }];
  const ligne = (valeurs, { gras = false, gris = false } = {}) => {
    if (doc.y > 792 - 90) doc.addPage();
    const y = doc.y;
    let x = MARGE;
    let bas = y;
    cols.forEach((c, i) => {
      doc.font(gras ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fillColor(gris ? GRIS : NOIR).text(pdfTexte(valeurs[i] ?? ""), x, y, { width: c.w - 6, align: c.a });
      bas = Math.max(bas, doc.y);
      x += c.w;
    });
    doc.y = bas + 4;
    doc.x = MARGE;
  };
  ligne(cols.map((c) => c.t.toUpperCase()), { gras: true, gris: true });
  doc.moveTo(MARGE, doc.y).lineTo(MARGE + LARGEUR, doc.y).lineWidth(0.6).strokeColor(NOIR).stroke();
  doc.y += 5;
  ligne([date(depuis), "Solde reporté", "", argent(report)], { gris: true });
  for (const l of lignesPeriode) ligne([date(l.date), l.genre === "paiement" ? `Paiement reçu${l.libelle && l.libelle !== "Paiement" ? ` (${l.libelle})` : ""}` : l.libelle, argent(l.montant), argent(l.solde)]);
  doc.moveTo(MARGE, doc.y).lineTo(MARGE + LARGEUR, doc.y).lineWidth(0.6).strokeColor(NOIR).stroke();
  doc.y += 6;
  ligne(["", solde > 0.005 ? "Solde dû à ce jour" : solde < -0.005 ? "Payé d'avance à ce jour" : "Solde à ce jour", "", argent(Math.abs(solde))], { gras: true });
  doc.moveDown(1);
  if (solde > 0.005) paragraphe(doc, `Merci de régler le solde de ${argent(solde)}. Si votre paiement a été fait entre-temps, veuillez ne pas en tenir compte.`);
  else paragraphe(doc, "Votre compte est à jour. Merci !");
  piedPage(doc, `${entreprise.nomEntreprise}${entreprise.telephone ? ` — ${entreprise.telephone}` : ""}${entreprise.courriel ? ` — ${entreprise.courriel}` : ""}`);
  doc.end();
  return fini;
}

export { recuLoyer, impayes, releveCompte, certificatSignature };
