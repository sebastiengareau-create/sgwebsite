// Relevé d'emploi en PDF : copie de travail du relevé préparé dans
// kontrolshop (lib/releveEmploi.js), pour les dossiers de l'employeur ou
// pour le vérifier avant de le téléverser. Ce n'est pas le relevé
// officiel : celui-là est transmis à Service Canada par RE Web, et
// l'employé le consulte dans Mon dossier Service Canada.
import PDFDocument from "pdfkit";
import { formaterNas } from "./nas";
import { RAISONS, CODES_RAPPEL, CODES_VACANCES, CODES_AUTRES_SOMMES, LIBELLES_PERIODE, periodesDePaie } from "./releveEmploiCalculs";

const NOIR = "#111111";
const GRIS = "#555555";
const PALE = "#888888";
const TRAIT = "#cccccc";
const MARGE = 40;
const LARGEUR = 612 - 2 * MARGE;
const texte = (t) => String(t ?? "").replace(/−/g, "-");
const argent = (n) => Number(n || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" }).replace(/ | /g, " ");
const DATE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const COURT = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const date = (s) => (s ? DATE.format(new Date(`${s}T12:00:00Z`)) : "—");
const court = (s) => (s ? COURT.format(new Date(`${s}T12:00:00Z`)) : "");

function titreSection(doc, t) {
  doc.moveDown(0.6);
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(NOIR).text(texte(t), MARGE, y);
  doc.moveTo(MARGE, doc.y + 2).lineTo(MARGE + LARGEUR, doc.y + 2).lineWidth(0.5).stroke(TRAIT);
  doc.moveDown(0.4);
}

// Lignes « case · libellé · valeur » sur deux colonnes
function champs(doc, lignes) {
  const colonne = LARGEUR / 2;
  for (let i = 0; i < lignes.length; i += 2) {
    const y = doc.y;
    let bas = y;
    [lignes[i], lignes[i + 1]].forEach((l, c) => {
      if (!l) return;
      const [cas, libelle, valeur] = l;
      const x = MARGE + c * colonne;
      doc.font("Helvetica-Bold").fontSize(7).fillColor(PALE).text(cas || "", x, y, { width: 28 });
      doc.font("Helvetica").fontSize(7).fillColor(GRIS).text(texte(libelle), x + 28, y, { width: colonne - 36 });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(NOIR).text(texte(valeur || "—"), x + 28, doc.y + 1, { width: colonne - 36 });
      bas = Math.max(bas, doc.y);
    });
    doc.y = bas + 6;
  }
}

function verifierPage(doc, hauteur) {
  if (doc.y + hauteur > 792 - MARGE - 20) doc.addPage();
}

// releve : forme du formulaire (versFormulaire) ; employe, employeur :
// partiesDuReleve ; entreprise : obtenirInfosEntreprise ; erreurs : verifier
export async function pdfReleveEmploi({ releve: r, employe, employeur, entreprise, erreurs = [] }) {
  const doc = new PDFDocument({ size: "LETTER", margin: MARGE, bufferPages: true, info: { Title: `Relevé d'emploi — ${employe.nomFamille}, ${employe.prenom}`, Producer: "kontrolshop" } });
  const morceaux = [];
  const fin = new Promise((resolve) => {
    doc.on("data", (m) => morceaux.push(m));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
  });

  // En-tête
  doc.font("Helvetica-Bold").fontSize(12).fillColor(NOIR).text(texte(entreprise.nomEntreprise), MARGE, MARGE, { width: 300 });
  doc.font("Helvetica").fontSize(8.5).fillColor(GRIS)
    .text(texte([entreprise.adresseLigne1, [entreprise.ville, entreprise.province, entreprise.codePostal].filter(Boolean).join(" ")].filter(Boolean).join("\n")), { width: 300 });
  const statut = r.statut === "TRANSMIS"
    ? `Transmis à RE Web${r.numeroSerie ? ` — no ${r.numeroSerie}` : ""}${r.transmisLe ? `, le ${COURT.format(new Date(r.transmisLe))}` : ""}`
    : "Brouillon — pas encore transmis";
  doc.font("Helvetica-Bold").fontSize(15).fillColor(NOIR).text("Relevé d'emploi", MARGE + 300, MARGE, { width: LARGEUR - 300, align: "right" });
  doc.font("Helvetica").fontSize(8.5).fillColor(GRIS).text("Copie de travail", { width: LARGEUR - 300, align: "right" }).text(texte(statut), { width: LARGEUR - 300, align: "right" });
  doc.y = Math.max(doc.y, MARGE + 46);
  doc.moveDown(0.5);
  doc.rect(MARGE, doc.y, LARGEUR, 30).fill("#f3f3f1");
  doc.font("Helvetica").fontSize(7.5).fillColor(GRIS).text(
    "Ce document n'est pas le relevé d'emploi officiel. Le relevé officiel est transmis à Service Canada par RE Web ; l'employé le consulte dans Mon dossier Service Canada. Confidentiel : contient le numéro d'assurance sociale.",
    MARGE + 8, doc.y + 6, { width: LARGEUR - 16 },
  );
  doc.y += 8;

  if (erreurs.length > 0) {
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#b3261e").text("À corriger avant la transmission :", MARGE);
    doc.font("Helvetica").fontSize(8.5);
    for (const e of erreurs) doc.text(`• ${texte(e)}`, MARGE + 8, doc.y, { width: LARGEUR - 8 });
  }

  titreSection(doc, "Employeur");
  champs(doc, [
    ["B5", "Numéro d'entreprise (compte RP)", employeur.bn],
    ["", "Nom", employeur.nom],
    ["B16", "Personne à joindre", [employeur.contactPrenom, employeur.contactNom].filter(Boolean).join(" ")],
    ["", "Téléphone", employeur.indicatif ? `${employeur.indicatif} ${employeur.telephone7.slice(0, 3)}-${employeur.telephone7.slice(3)}${employeur.poste ? ` poste ${employeur.poste}` : ""}` : ""],
  ]);

  titreSection(doc, "Employé");
  champs(doc, [
    ["B9", "Nom", `${employe.nomFamille}, ${employe.prenom}`],
    ["B8", "Numéro d'assurance sociale", employe.nas ? formaterNas(employe.nas) : ""],
    ["", "Adresse", [employe.adresse, [employe.ville, employe.province, employe.codePostal].filter(Boolean).join(" ")].filter(Boolean).join(", ")],
    ["B3", "Numéro d'employé", employe.numeroEmploye],
    ["B13", "Profession", r.profession],
  ]);

  titreSection(doc, "Emploi et raison");
  const rappel = `${CODES_RAPPEL[r.rappel] || r.rappel}${r.rappel === "Y" && r.dateRappel ? ` : ${date(r.dateRappel)}` : ""}`;
  champs(doc, [
    ["B10", "Premier jour de travail", date(r.premierJour)],
    ["B11", "Dernier jour payé", date(r.dernierJourPaye)],
    ["B12", "Fin de la dernière période de paie", date(r.finDernierePeriode)],
    ["B6", "Périodes de paie", LIBELLES_PERIODE[r.typePeriode] || r.typePeriode],
    ["B16", "Raison du relevé", r.raison ? `${r.raison} — ${RAISONS[r.raison] || ""}` : "À choisir"],
    ["B14", "Retour prévu", rappel],
  ]);

  // Heures et gains par période
  titreSection(doc, "Heures et gains assurables");
  champs(doc, [
    ["B15A", "Total des heures assurables", String(r.heuresAssurables ?? "")],
    ["", "Total des gains assurables déclarés", argent(r.gainsParPeriode.reduce((s, g) => s + (Number(g) || 0), 0))],
  ]);
  const periodes = /^\d{4}-\d{2}-\d{2}$/.test(r.finDernierePeriode || "") ? periodesDePaie(r.typePeriode, r.finDernierePeriode, null) : [];
  const gains = r.gainsParPeriode.map((g) => Number(g) || 0);
  doc.font("Helvetica").fontSize(7.5).fillColor(GRIS).text("B15C — Gains assurables par période de paie, la plus récente d'abord", MARGE);
  doc.moveDown(0.3);
  const colonnes = 3;
  const largeurCol = LARGEUR / colonnes;
  const parColonne = Math.ceil(gains.length / colonnes);
  verifierPage(doc, parColonne * 11 + 10);
  const yDebut = doc.y;
  gains.forEach((g, i) => {
    const c = Math.floor(i / parColonne);
    const ligne = i % parColonne;
    const x = MARGE + c * largeurCol;
    const y = yDebut + ligne * 11;
    const p = periodes[i];
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(PALE).text(`${i + 1}.`, x, y, { width: 16 });
    doc.font("Helvetica").fontSize(7.5).fillColor(GRIS).text(p ? `${court(p.debut)} – ${court(p.fin)}` : "", x + 16, y, { width: largeurCol - 80, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(g > 0 ? NOIR : PALE).text(argent(g), x + largeurCol - 66, y, { width: 58, align: "right", lineBreak: false });
  });
  doc.y = yDebut + parColonne * 11 + 4;

  // Sommes versées au départ
  const v = r.vacances;
  const feries = r.joursFeries || [];
  const autres = r.autresSommes || [];
  if ((v && v.code) || feries.length || autres.length || r.commentaires) {
    verifierPage(doc, 80);
    titreSection(doc, "Sommes versées au départ et commentaires");
    const lignes = [];
    if (v && v.code) lignes.push(["B17A", "Paie de vacances", `${CODES_VACANCES[v.code] || v.code}${v.code !== "1" ? ` : ${argent(v.montant)}` : ""}`]);
    feries.forEach((f) => lignes.push(["B17B", "Jour férié", `${date(f.date)} : ${argent(f.montant)}`]));
    autres.forEach((a) => {
      const code = CODES_AUTRES_SOMMES[a.code];
      lignes.push(["B17C", "Autre somme", `${a.code} — ${code?.libelle || ""}${code && !code.assurable ? " (non assurable)" : ""} : ${argent(a.montant)}`]);
    });
    if (r.commentaires) lignes.push(["B18", "Commentaires", r.commentaires]);
    champs(doc, lignes);
  }

  // Pied de page
  const pages = doc.bufferedPageRange();
  const prepare = DATE.format(new Date());
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // le pied est sous la marge : sans ça, pdfkit ajouterait une page
    doc.font("Helvetica").fontSize(7).fillColor(PALE).text(
      `Copie de travail préparée avec kontrolshop le ${prepare} · page ${i + 1} de ${pages.count}`,
      MARGE, 792 - MARGE + 8, { width: LARGEUR, align: "center", lineBreak: false },
    );
  }
  doc.end();
  return fin;
}
