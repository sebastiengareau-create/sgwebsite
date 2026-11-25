// Bail de logement sur le formulaire obligatoire : le formulaire de la Régie
// du logement (8 pages, papier légal), gardé vierge dans
// lib/modeles/bail-logement.pdf, sur lequel on écrit les données du bail
// aux endroits prévus (sections A à H). Les signatures électroniques (lib/
// signatureImmo.js) se placent dans les cases de la section H, et le
// certificat de signature est ajouté à la fin.
//
// Positions en points PDF, origine en bas à gauche, relevées sur le
// formulaire (612 × 1008). Une autre version du formulaire demandera un
// autre gabarit et d'autres positions.

import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { servicesListe, dureeMois } from "./immobilierCalculs";

// Version du formulaire : celles mises en vente avant le 1er janvier 2026
// restent valides jusqu'au 31 décembre 2026 (TAL)
export const FORMULAIRE_BAIL = {
  fichier: "lib/modeles/bail-logement.pdf",
  version: "formulaire de la Régie du logement",
  valideJusquau: "2026-12-31",
};

const ENCRE = rgb(0.05, 0.1, 0.35);

export { separerAdresse } from "./adresseImmo";
import { separerAdresse } from "./adresseImmo";

// Date → ["01", "07", "2027"] (dates enregistrées à midi UTC)
export function casesDate(d) {
  if (!d) return ["", "", ""];
  const x = new Date(d);
  const deux = (n) => String(n).padStart(2, "0");
  return [deux(x.getUTCDate()), deux(x.getUTCMonth() + 1), String(x.getUTCFullYear())];
}

// Jour au Québec d'un instant (signature reçue) → date à midi UTC
function jourQuebec(instant) {
  const [a, m, j] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date(instant)).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12));
}

const montant = (n) => (n == null ? "" : Number(n).toFixed(2));

// Texte que la police standard sait écrire (WinAnsi)
function ecrivable(police, texte) {
  let s = "";
  for (const c of String(texte ?? "").replace(/[\r\t]/g, " ")) {
    try {
      police.encodeText(c);
      s += c;
    } catch {
      s += c === "\n" ? "\n" : "?";
    }
  }
  return s;
}

// Coupe un texte en lignes d'au plus `largeur` points
function couper(police, texte, taille, largeur) {
  const lignes = [];
  for (const para of String(texte || "").split("\n")) {
    let ligne = "";
    for (const mot of para.split(/\s+/).filter(Boolean)) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, taille) <= largeur) ligne = essai;
      else {
        if (ligne) lignes.push(ligne);
        ligne = mot;
      }
    }
    lignes.push(ligne);
  }
  return lignes.filter((l, i, t) => l || (i > 0 && i < t.length - 1));
}

// Données du bail pour le formulaire (pures, vérifiées par les tests)
// → { locateur, locataires, logement, … }
export function donneesFormulaire(bail, entreprise = {}, v = {}) {
  const l = bail.logement || {};
  const i = l.immeuble || {};
  const services = new Set(servicesListe(bail.services));
  const [noLocateur, rueLocateur] = separerAdresse(entreprise.adresseLigne1);
  const [noLogement, rueLogement] = separerAdresse(l.adresseCivique || i.adresse);
  const loyerAncien = bail.loyerAncien ?? v.loyerAncienCalcule ?? null;
  const autres = [
    services.has("INTERNET") ? "Internet compris dans le loyer." : null,
    bail.fumeur === "INTERDIT" ? "Interdit de fumer (tabac et cannabis) dans le logement et les aires communes." : null,
    bail.fumeur === "BALCON" ? "Interdit de fumer dans le logement ; permis sur le balcon ou le terrain." : null,
    bail.fumeur === "PERMIS" ? "Permis de fumer dans le logement." : null,
    bail.assuranceResponsabilite ? "Le locataire détient une assurance responsabilité civile pendant toute la durée du bail et en fournit la preuve sur demande." : null,
    bail.conditions,
  ].filter(Boolean).join("\n");
  return {
    // Fiche du locateur (lib/locateurImmo.js, v.locateur), sinon l'entreprise
    locateurs: v.locateur?.locateurs?.length ? v.locateur.locateurs.slice(0, 2) : [{
      nom: entreprise.nomEntreprise || "",
      no: noLocateur,
      rue: rueLocateur,
      app: "",
      ville: entreprise.ville || "",
      codePostal: entreprise.codePostal || "",
      telephone: entreprise.telephone || "",
      telephone2: "",
      courriel: entreprise.courriel || "",
    }],
    representant: v.locateur ? v.locateur.representant || "" : entreprise.personneResponsable || "",
    locataires: (bail.locataires || []).map((x) => {
      const [no, rue] = separerAdresse(x.adresse);
      return { id: x.id, nom: x.nom || "", no, rue, app: x.appartement || "", ville: x.ville || "", codePostal: x.codePostal || "", telephone: x.telephone || "", telephone2: x.telephone2 || "", courriel: x.courriel || "" };
    }),
    logement: {
      no: noLogement,
      rue: rueLogement,
      app: l.adresseCivique ? "" : l.numero || "",
      ville: i.ville || "",
      codePostal: i.codePostal || "",
      pieces: l.pieces || "",
    },
    habitationSeulement: !bail.usageMixte,
    // Copropriété divise : « Non » pour un plex ou un multilogement locatif ;
    // à cocher à la main sinon
    copropriete: ["PLEX", "MULTILOGEMENT", "MIXTE"].includes(i.type) ? false : null,
    // Stationnement : places et emplacements inscrits au bail ; sinon le
    // service « Stationnement » coche le stationnement extérieur
    stationnementExterieur: bail.stationnementExterieur || (services.has("STATIONNEMENT") && !bail.stationnementInterieur ? null : 0),
    stationnementExterieurEmplacement: bail.stationnementExterieurEmplacement || "",
    stationnementInterieur: bail.stationnementInterieur || 0,
    stationnementInterieurEmplacement: bail.stationnementInterieurEmplacement || "",
    stationnement: services.has("STATIONNEMENT") || Boolean(bail.stationnementExterieur || bail.stationnementInterieur),
    rangement: services.has("RANGEMENT"),
    accessoires: bail.accessoires || "",
    meuble: services.has("MEUBLE"),
    electromenagers: services.has("ELECTROMENAGERS"),
    laveuseSecheuse: services.has("LAVEUSE_SECHEUSE"),
    debut: bail.dateDebut,
    fin: bail.dateFin || null,
    duree: bail.dateFin ? `${dureeMois(bail)} mois` : "",
    loyer: bail.loyer,
    premierTerme: bail.premierPaiementLe || bail.dateDebut,
    jourPaiement: bail.jourPaiement || 1,
    modePaiement: bail.modePaiement || "",
    chequesPostdates: Boolean(bail.chequesPostdates),
    lieuPaiement: bail.lieuPaiement || "",
    reglementRemisLe: bail.reglementRemisLe || null,
    travaux: bail.travauxPromis || "",
    chauffage: bail.chauffage || "",
    chauffageLocateur: services.has("CHAUFFAGE"),
    electriciteLocateur: services.has("ELECTRICITE"),
    eauChaudeLocateur: services.has("EAU_CHAUDE"),
    deneigementLocateur: services.has("DENEIGEMENT"),
    animaux: bail.animaux || "",
    autres,
    immeubleNeuf: Boolean(bail.immeubleNeuf),
    anneeConstruction: i.anneeConstruction || null,
    loyerAncien: bail.immeubleNeuf ? null : loyerAncien,
    caution: bail.caution || "",
  };
}

// Remplit le formulaire → Buffer du PDF. v : { dateAvis, lieu, signatures,
// certificat, loyerAncienCalcule }
export async function bailFormulaire(bail, entreprise, v = {}) {
  const gabarit = await readFile(path.join(process.cwd(), FORMULAIRE_BAIL.fichier));
  const pdf = await PDFDocument.load(gabarit);
  const police = await pdf.embedFont(StandardFonts.Helvetica);
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [p1, p2, p3] = pdf.getPages();
  const d = donneesFormulaire(bail, entreprise, v);

  // Texte sur une ligne, réduit au besoin pour tenir dans `largeur`
  const ecrire = (page, texte, x, y, { taille = 10, largeur = 250, f = police } = {}) => {
    const s = ecrivable(f, texte).replace(/\n/g, " ").trim();
    if (!s) return;
    let t = taille;
    while (t > 6 && f.widthOfTextAtSize(s, t) > largeur) t -= 0.5;
    page.drawText(s, { x, y, size: t, font: f, color: ENCRE });
  };
  // Paragraphe sur plusieurs lignes → texte qui n'a pas tenu
  const paragraphe = (page, texte, x, y, { taille = 9, largeur = 340, lignes = 2, interligne = 11 } = {}) => {
    const toutes = couper(police, ecrivable(police, texte), taille, largeur);
    toutes.slice(0, lignes).forEach((l, n) => page.drawText(l, { x, y: y - n * interligne, size: taille, font: police, color: ENCRE }));
    return toutes.slice(lignes).join(" ");
  };
  // Case à cocher : (x, y) de la case imprimée sur le formulaire
  // (la case imprimée va d'environ x + 0,6 à x + 7,8, et de y − 1,7 à y + 5,5) : un X
  const cocher = (page, x, y) => {
    const trait = { thickness: 1.2, color: ENCRE };
    page.drawLine({ start: { x: x + 1.7, y: y - 0.6 }, end: { x: x + 6.7, y: y + 4.4 }, ...trait });
    page.drawLine({ start: { x: x + 1.7, y: y + 4.4 }, end: { x: x + 6.7, y: y - 0.6 }, ...trait });
  };
  const date = (page, dt, [xj, xm, xa], y) => {
    const [j, m, a] = casesDate(dt);
    ecrire(page, j, xj, y);
    ecrire(page, m, xm, y);
    ecrire(page, a, xa, y);
  };
  const annexe = [];

  // ---------- A — Le locateur et les locataires ----------
  const blocA = (page, x, y, p) => {
    ecrire(page, p.nom, x, y, { largeur: 255 });
    ecrire(page, p.no, x, y - 20, { largeur: 30 });
    ecrire(page, p.rue, x + 34, y - 20, { largeur: p.app ? 175 : 220 });
    ecrire(page, p.app, x + 214, y - 20, { largeur: 42 });
    ecrire(page, p.ville, x, y - 40, { largeur: 190 });
    ecrire(page, p.codePostal, x + 197, y - 40, { largeur: 60 });
    ecrire(page, p.telephone, x, y - 60, { largeur: 120 });
    ecrire(page, p.telephone2, x + 133, y - 60, { largeur: 120 });
    ecrire(page, p.courriel, x, y - 80, { largeur: 255 });
  };
  const [locateur1, locateur2] = d.locateurs;
  if (locateur1) blocA(p1, 35.4, 790.7, locateur1);
  if (locateur2) blocA(p1, 35.4, 685.7, locateur2);
  ecrire(p1, d.representant, 140, 579, { largeur: 150 });
  const [loc1, loc2, ...autresLocataires] = d.locataires;
  if (loc1) blocA(p1, 314.4, 790.7, loc1);
  if (loc2) blocA(p1, 314.4, 685.7, loc2);

  // ---------- B — Le logement ----------
  ecrire(p1, d.logement.no, 78.9, 510.7, { largeur: 70 });
  ecrire(p1, d.logement.rue, 152.1, 510.7, { largeur: 330 });
  ecrire(p1, d.logement.app, 535, 510.7, { largeur: 45 });
  ecrire(p1, d.logement.ville, 35.4, 490.6, { largeur: 340 });
  ecrire(p1, d.logement.codePostal, 389.8, 490.6, { largeur: 90 });
  ecrire(p1, d.logement.pieces, 492.8, 490.6, { largeur: 80 });
  cocher(p1, d.habitationSeulement ? 255 : 295, 463);
  if (d.copropriete === false) cocher(p1, 317, 408);
  // Stationnement extérieur (y 392) et intérieur (y 376) : nombre de places, emplacement(s)
  const stationnement = (y, places, emplacement) => {
    cocher(p1, 33, y);
    if (places) ecrire(p1, String(places), 252, y, { largeur: 38 });
    ecrire(p1, emplacement, 385, y, { largeur: 192, taille: 9 });
  };
  if (d.stationnementExterieur !== 0) stationnement(392, d.stationnementExterieur, d.stationnementExterieurEmplacement);
  if (d.stationnementInterieur) stationnement(376, d.stationnementInterieur, d.stationnementInterieurEmplacement);
  if (d.rangement) cocher(p1, 33, 360);
  if (d.accessoires) ecrire(p1, d.accessoires, 190, 338, { largeur: 385, taille: 9 });
  cocher(p1, d.meuble ? 219 : 259, 318);
  if (d.electromenagers) {
    cocher(p1, 33, 280); // cuisinière
    cocher(p1, 33, 227); // réfrigérateur
  }
  if (d.laveuseSecheuse) {
    cocher(p1, 135, 297);
    cocher(p1, 135, 280);
  }

  // ---------- C — Durée ----------
  if (d.fin) {
    ecrire(p1, d.duree, 124.4, 118.9, { largeur: 160 });
    date(p1, d.debut, [62.8, 91.3, 112.4], 96.7);
    date(p1, d.fin, [172.2, 203.4, 224.5], 96.7);
  } else {
    date(p1, d.debut, [402, 430, 451], 96.7);
  }

  // ---------- D — Loyer ----------
  ecrire(p2, montant(d.loyer), 146.8, 970.9, { largeur: 60 });
  cocher(p2, 212, 969);
  ecrire(p2, "0.00", 168.4, 956.8, { largeur: 40 });
  cocher(p2, 211, 955);
  ecrire(p2, montant(d.loyer), 146.6, 943, { largeur: 60 });
  cocher(p2, 212, 941);
  cocher(p2, 359, 894); // aucun programme de subvention inscrit au bail
  date(p2, d.premierTerme, [131.2, 162.9, 183.9], 834.6);
  if (d.jourPaiement === 1) cocher(p2, 208, 799);
  else ecrire(p2, `le ${d.jourPaiement} de chaque mois`, 70, 784, { largeur: 230 });
  const modes = { COMPTANT: [258, 745], CHEQUE: [34, 731], VIREMENT: [109, 731], PREAUTORISE: [258, 731], AUTRE: [258, 731] };
  if (modes[d.modePaiement]) cocher(p2, ...modes[d.modePaiement]);
  if (d.modePaiement === "PREAUTORISE") ecrire(p2, "prélèvement préautorisé", 296, 730, { largeur: 100, taille: 8.5 });
  cocher(p2, d.chequesPostdates ? 34 : 73, 698);
  ecrire(p2, d.lieuPaiement, 140, 660, { largeur: 255 });

  // ---------- E — Services et conditions ----------
  if (d.reglementRemisLe) date(p2, d.reglementRemisLe, [78.5, 109.7, 130.8], 591);
  if (d.travaux) {
    // 1re ligne après « Avant la délivrance du logement », 2e sur la ligne suivante
    const [premiere = "", ...suite] = couper(police, ecrivable(police, d.travaux), 9, 225);
    p2.drawText(premiere, { x: 170, y: 478.5, size: 9, font: police, color: ENCRE });
    const reste = paragraphe(p2, suite.join(" "), 35, 463, { largeur: 360, lignes: 1 });
    if (reste) annexe.push(["Section E — Travaux et réparations (suite)", reste]);
  }
  const chauffages = { ELECTRICITE: 40, GAZ: 103, MAZOUT: 146 };
  if (chauffages[d.chauffage]) cocher(p2, chauffages[d.chauffage], 217);
  const parQui = (locateur, y, gauche = true) => cocher(p2, gauche ? (locateur ? 216 : 266) : (locateur ? 504 : 554), y);
  parQui(d.chauffageLocateur, 234);
  parQui(d.electriciteLocateur, 187);
  parQui(d.eauChaudeLocateur, 157);
  if (d.deneigementLocateur) for (const y of [202, 187, 172, 157]) parQui(true, y, false);
  if (d.animaux) {
    cocher(p2, d.animaux === "INTERDITS" ? 279 : 243, 103);
    if (d.animaux === "CONDITIONS") ecrire(p2, "selon les conditions du bail et du règlement", 330, 103, { largeur: 245, taille: 8.5 });
  }
  if (d.autres) {
    const reste = paragraphe(p2, d.autres, 35, 71.5, { largeur: 540, lignes: 2, interligne: 12, taille: 8.5 });
    if (reste) annexe.push(["Section E — Autres services, conditions et restrictions (suite)", reste]);
  }

  // ---------- F — Immeuble neuf ----------
  if (d.immeubleNeuf) {
    cocher(p3, 33, 928);
    if (d.anneeConstruction) ecrire(p3, String(d.anneeConstruction), 268, 911);
  }

  // ---------- G — Avis au nouveau locataire ----------
  if (!d.immeubleNeuf && d.loyerAncien != null) {
    ecrire(p3, montant(d.loyerAncien), 92, 727, { largeur: 70 });
    cocher(p3, 33, 710);
  }

  // ---------- H — Signatures ----------
  const signees = (v.signatures || []).filter((s) => s.statut === "SIGNE");
  const signature = (role, locataireId) => signees.find((s) => s.role === role && (role === "LOCATEUR" || s.locataireId === locataireId));
  const image = async (page, s, x, y, largeur, hauteur) => {
    const m = /^data:image\/png;base64,(.+)$/.exec(s?.signature || "");
    if (!m) return;
    try {
      const png = await pdf.embedPng(Buffer.from(m[1], "base64"));
      const echelle = Math.min(largeur / png.width, hauteur / png.height);
      page.drawImage(png, { x, y, width: png.width * echelle, height: png.height * echelle });
    } catch { /* image illisible : la case reste à signer */ }
  };
  const caseSignature = async (page, s, x, y, xDates, largeur = 175) => {
    if (!s) return;
    await image(page, s, x, y + 2, largeur, 24);
    date(page, jourQuebec(s.reponduLe), xDates, y + 6);
  };
  const locateur = signature("LOCATEUR");
  await caseSignature(p3, locateur, 35, 514, [225, 253, 274]);
  if (loc1) await caseSignature(p3, signature("LOCATAIRE", loc1.id), 306, 514, [503, 531, 552]);
  if (loc2) await caseSignature(p3, signature("LOCATAIRE", loc2.id), 306, 487, [503, 531, 552]);
  // Avis de la section G : signé par le locateur
  if (!d.immeubleNeuf && d.loyerAncien != null && locateur) await caseSignature(p3, locateur, 35, 568, [244, 270, 292], 190);
  // Autres signataires : locataires suivants, puis la caution
  const autresSignataires = [
    ...autresLocataires.map((x) => ({ nom: x.nom, qualite: "Locataire", s: signature("LOCATAIRE", x.id) })),
    ...(d.caution ? [{ nom: d.caution.split(/[,·]/)[0].trim(), qualite: "Caution" }] : []),
  ];
  for (const [n, a] of autresSignataires.slice(0, 2).entries()) {
    const y = n === 0 ? 399 : 345;
    ecrire(p3, a.nom, 35, y, { largeur: 160 });
    ecrire(p3, a.qualite, 455, y, { largeur: 110 });
    if (a.s) await image(p3, a.s, 205, y - 3, 230, 22);
  }
  if (signees.length) {
    p3.drawText(ecrivable(police, "Signé électroniquement — voir le certificat de signature à la fin du document."), { x: 35, y: 469, size: 7.5, font: police, color: ENCRE });
  }

  // ---------- Annexe (texte qui n'a pas tenu dans les cases) ----------
  if (annexe.length) {
    const page = pdf.insertPage(3, [612, 1008]);
    let y = 950;
    page.drawText(ecrivable(gras, "Annexe au bail de logement"), { x: 40, y, size: 14, font: gras });
    y -= 30;
    for (const [titre, texte] of annexe) {
      page.drawText(ecrivable(gras, titre), { x: 40, y, size: 10.5, font: gras });
      y -= 16;
      for (const l of couper(police, ecrivable(police, texte), 10, 530)) {
        page.drawText(l, { x: 40, y, size: 10, font: police, color: ENCRE });
        y -= 13;
        if (y < 60) break;
      }
      y -= 12;
    }
  }

  // ---------- Certificat de signature ----------
  if (v.certificat) {
    const { pagesCertificatSeules } = await import("./pdfImmobilier");
    const cert = await PDFDocument.load(await pagesCertificatSeules(entreprise, v.certificat));
    const indices = cert.getPageIndices().slice(1); // la 1re page du document pdfkit est vide
    for (const page of await pdf.copyPages(cert, indices)) pdf.addPage(page);
  }

  pdf.setTitle(`Bail de logement — ${d.locataires.map((x) => x.nom).join(", ")}`);
  pdf.setProducer("Gestion immobilière");
  return Buffer.from(await pdf.save());
}
