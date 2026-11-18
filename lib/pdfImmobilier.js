// Documents de gestion locative du module Immobilier, générés en PDF à partir
// d'un bail : avis de modification, avis de reprise, avis d'accès au
// logement, rappel de retard, mise en demeure, état des lieux, fiche de bail
// et reçu de loyer.
//
// Ce sont des lettres rédigées par le propriétaire avec les mentions que le
// Code civil du Québec exige — pas des copies de formulaires officiels. Le
// bail lui-même reste le formulaire obligatoire du Tribunal administratif du
// logement (TAL) : la fiche de bail sert seulement à le remplir.
//
// Toutes les fonctions reçoivent le bail complet (logement.immeuble,
// locataires, charges, paiements), l'entreprise (obtenirInfosEntreprise) et
// les valeurs propres au document ; elles retournent un Buffer.

import PDFDocument from "pdfkit";
import { argentPdf } from "./format";
import {
  adresseLogement, nomsLocataires, servicesLisibles, dureeMois, soldeBail, libelle, MODES_PAIEMENT, periodeLisible, hausseLisible, ajouterMois,
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

// Coupon-réponse du locataire (avis de modification, avis de reprise)
function coupon(doc, bail, entreprise, choix, { titre: t, note }) {
  if (doc.y > 560) doc.addPage();
  doc.moveDown(0.6);
  doc.strokeColor(GRIS).lineWidth(0.5).dash(4, { space: 3 }).moveTo(MARGE, doc.y).lineTo(MARGE + LARGEUR, doc.y).stroke().undash();
  doc.moveDown(0.8);
  paragraphe(doc, t, { gras: true, taille: 11.5 });
  paragraphe(doc, `À : ${entreprise.nomEntreprise}${entreprise.adresseLigne1 ? `, ${entreprise.adresseLigne1}` : ""}`, { taille: 9.5, couleur: GRIS, espace: 0.2 });
  paragraphe(doc, `Logement : ${adresseLogement(bail.logement)}`, { taille: 9.5, couleur: GRIS });
  for (const c of choix) {
    const y = doc.y + 1;
    doc.rect(MARGE, y, 9, 9).lineWidth(0.8).strokeColor(NOIR).stroke();
    doc.font("Helvetica").fontSize(10).fillColor(NOIR).text(pdfTexte(c), MARGE + 18, y - 1, { width: LARGEUR - 18 });
    doc.moveDown(0.5);
  }
  if (note) paragraphe(doc, note, { taille: 8.5, couleur: GRIS });
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
  coupon(doc, bail, entreprise, [
    `J'accepte la modification du bail (nouveau loyer de ${argent(nouveau)} par mois à compter du ${date(debut)}).`,
    "Je refuse la modification et je demeure dans le logement.",
    `Je quitterai le logement à la fin du bail, le ${date(bail.dateFin)}.`,
  ], { titre: "Réponse du locataire", note: "À retourner au locateur dans le mois suivant la réception de l'avis." });
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
    ["Conditions particulières", bail.notes],
  ]);
  paragraphe(doc, "À ne pas oublier au formulaire : le loyer le plus bas payé au cours des 12 mois précédant le début du bail (section G), sauf pour un immeuble construit depuis 5 ans ou moins, ainsi que le règlement de l'immeuble remis au locataire, s'il y en a un.", { taille: 9, couleur: GRIS });
  piedPage(doc, "Fiche interne — le bail signé se dépose dans les documents du bail.");
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
};

export { recuLoyer, impayes };
