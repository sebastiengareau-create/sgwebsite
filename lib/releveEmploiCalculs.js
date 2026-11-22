// Relevé d'emploi (RE) : codes, périodes de paie, vérifications et fichier
// XML pour RE Web (format « W-2.0 » de Service Canada, annexe D des
// exigences de RE Web). Sans dépendance au serveur : le formulaire s'en
// sert aussi dans le navigateur. Le calcul à partir des paies est dans
// lib/releveEmploi.js.
//
// Les cases portent leur numéro du relevé : B10 premier jour, B11 dernier
// jour payé, B12 fin de la dernière période de paie, B15A heures
// assurables, B15C gains assurables par période (la plus récente d'abord),
// B16 raison et personne à joindre, B17 sommes versées au départ.

export const TYPES_PERIODE = { HEBDOMADAIRE: "W", BIHEBDOMADAIRE: "B", BIMENSUEL: "S", MENSUEL: "M" };
export const LIBELLES_PERIODE = { W: "Hebdomadaire", B: "Aux deux semaines", S: "Deux fois par mois", M: "Mensuelle" };
// Nombre de périodes à déclarer au plus (tableaux 15A.1 et 15C.1)
export const MAX_PERIODES = { W: 53, B: 27, S: 25, M: 13 };

// B16 — raison du relevé (tableau 16.1)
export const RAISONS = {
  A00: "Manque de travail / fin de saison ou de contrat",
  A01: "Faillite de l'employeur ou mise sous séquestre",
  B00: "Grève ou lockout",
  D00: "Maladie ou blessure",
  E00: "Départ volontaire",
  E02: "Départ volontaire / pour accompagner un(e) conjoint(e)",
  E03: "Départ volontaire / retour aux études",
  E04: "Départ volontaire / raisons médicales",
  E05: "Départ volontaire / retraite volontaire",
  E06: "Départ volontaire / autre emploi",
  E09: "Départ volontaire / déménagement de l'employeur",
  E10: "Départ volontaire / prendre soin d'une personne à charge",
  E11: "Départ volontaire / pour devenir travailleur indépendant",
  F00: "Maternité",
  G00: "Retraite obligatoire",
  G07: "Retraite / programme approuvé de compression du personnel",
  H00: "Travail partagé",
  J00: "Formation en apprentissage",
  K00: "Autre (commentaire obligatoire)",
  K12: "Autre / changement de la fréquence de paie",
  K13: "Autre / changement de propriétaire",
  K14: "Autre / à la demande de l'assurance-emploi",
  K16: "Autre / à la demande de l'employé(e)",
  K17: "Autre / changement de fournisseur de service",
  M00: "Congédiement",
  M08: "Congédiement / avant la fin de la période de probation",
  N00: "Congé",
  P00: "Parental",
  Z00: "Congé de compassion / proches aidants",
};
// B14 — rappel prévu
export const CODES_RAPPEL = { U: "Date de retour inconnue", Y: "Date de rappel prévue", N: "Retour non prévu" };
// B17A — paie de vacances
export const CODES_VACANCES = {
  1: "Versée avec chaque paie",
  2: "Versée parce que l'employé cesse de travailler",
  3: "Versée pour une période de vacances",
  4: "Anniversaire (versée à une date fixe chaque année)",
};
// B17C — autres sommes (assurable : comprise dans les gains de la dernière période)
export const CODES_AUTRES_SOMMES = {
  B05: { libelle: "Prime (jours fériés)", assurable: true },
  B06: { libelle: "Prime (rendement, productivité)", assurable: true },
  B07: { libelle: "Prime (événement particulier)", assurable: true },
  B08: { libelle: "Prime (fin de contrat ou de saison)", assurable: true },
  B09: { libelle: "Prime (départ ou retraite)", assurable: true },
  B10: { libelle: "Prime (fermeture)", assurable: true },
  B11: { libelle: "Prime (autre)", assurable: true },
  E00: { libelle: "Indemnité de départ", assurable: false },
  G00: { libelle: "Gratifications", assurable: true },
  I00: { libelle: "Crédits de congé de maladie", assurable: true },
  J00: { libelle: "Ajustement rétroactif de paie", assurable: true },
  O00: { libelle: "Autre", assurable: true },
  Q00: { libelle: "Participation aux bénéfices", assurable: true },
  R00: { libelle: "Allocation de retraite", assurable: false },
  T00: { libelle: "Heures supplémentaires accumulées payées", assurable: true },
  Y00: { libelle: "Indemnité de préavis", assurable: true },
};

// ---------- Dates ----------
const jour = (s) => new Date(`${s}T12:00:00Z`);
const texteJour = (d) => d.toISOString().slice(0, 10);
const ajouterJours = (s, n) => { const d = jour(s); d.setUTCDate(d.getUTCDate() + n); return texteJour(d); };
const ecartJours = (a, b) => Math.round((jour(b) - jour(a)) / 86400000);
const dernierDuMois = (an, mois) => new Date(Date.UTC(an, mois, 0)).getUTCDate(); // mois 1 à 12
const dateValide = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && texteJour(jour(s)) === s;

// Périodes de paie qui se terminent à « fin » et remontent dans le temps :
// [{ debut, fin }], la plus récente d'abord, jusqu'à celle qui contient
// premierJour (ou au maximum du type)
export function periodesDePaie(type, fin, premierJour) {
  const periodes = [];
  const max = MAX_PERIODES[type] || 27;
  let finCourante = fin;
  for (let i = 0; i < max; i++) {
    let debut;
    if (type === "W" || type === "B") {
      debut = ajouterJours(finCourante, type === "W" ? -6 : -13);
    } else {
      const [an, mois, j] = finCourante.split("-").map(Number);
      if (type === "M") debut = `${an}-${String(mois).padStart(2, "0")}-01`;
      else debut = j <= 15 ? `${an}-${String(mois).padStart(2, "0")}-01` : `${an}-${String(mois).padStart(2, "0")}-16`;
    }
    periodes.push({ debut, fin: finCourante });
    if (premierJour && debut <= premierJour) break;
    if (type === "W" || type === "B") finCourante = ajouterJours(debut, -1);
    else {
      const precedent = ajouterJours(debut, -1);
      const [an, mois, j] = precedent.split("-").map(Number);
      finCourante = type === "M" ? `${an}-${String(mois).padStart(2, "0")}-${String(dernierDuMois(an, mois)).padStart(2, "0")}` : precedent;
      if (type === "S" && j !== 15 && j !== dernierDuMois(an, mois)) finCourante = precedent;
    }
  }
  return periodes;
}

// Durée maximale d'une période, pour l'écart entre B11 et B12
const DUREE_PERIODE = { W: 7, B: 14, S: 16, M: 31 };

// ---------- Vérifications ----------
const montantValide = (n) => Number.isFinite(Number(n)) && Number(n) > 0 && Number(n) <= 9999999.99;
const coupe = (s, n) => String(s || "").trim().replace(/\s+/g, " ").slice(0, n);

// Ce qui empêche de produire le fichier → liste de messages (vide : prêt)
// releve : { raison, premierJour, dernierJourPaye, finDernierePeriode,
// typePeriode, rappel, dateRappel, heuresAssurables, gainsParPeriode,
// vacances, joursFeries, autresSommes, commentaires } (dates AAAA-MM-JJ)
// employe : { prenom, nomFamille, nas, adresse, ville, province, codePostal }
// employeur : { bn, contactPrenom, contactNom, indicatif, telephone7 }
export function verifierReleve(releve, { employe, employeur, aujourdhui, nasValide }) {
  const e = [];
  const r = releve;
  if (!/^[178]\d{8}RP\d{4}$/.test(employeur.bn || "") || /0000$/.test(employeur.bn)) e.push("Numéro d'employeur de l'ARC (compte RP, ex. 123456789RP0001) manquant ou invalide — Administrateur → Informations de l'entreprise.");
  if (!employeur.contactPrenom || !employeur.contactNom) e.push("Personne à joindre (B16) : indique la personne responsable de l'entreprise (prénom et nom) — Administrateur → Informations de l'entreprise.");
  if (!/^\d{3}$/.test(employeur.indicatif || "") || !/^\d{7}$/.test(employeur.telephone7 || "")) e.push("Téléphone de l'entreprise (10 chiffres) manquant : c'est le numéro à joindre (B16).");
  if (!nasValide(employe.nas)) e.push("NAS de l'employé manquant ou invalide — fiche de l'employé.");
  if (!employe.prenom || !employe.nomFamille) e.push("Prénom et nom de famille de l'employé requis — fiche de l'employé.");
  if (!employe.adresse || !employe.ville) e.push("Adresse de l'employé incomplète (adresse et ville) — fiche de l'employé.");
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(String(employe.codePostal || "").replace(/[\s-]/g, "").toUpperCase())) e.push("Code postal de l'employé manquant ou invalide — fiche de l'employé.");
  if (!TYPES_PERIODE_INVERSE[r.typePeriode]) e.push("Type de période de paie invalide.");
  if (!RAISONS[r.raison]) e.push("Choisis la raison du relevé (B16).");

  const dates = [["premierJour", "Premier jour de travail (B10)"], ["dernierJourPaye", "Dernier jour payé (B11)"], ["finDernierePeriode", "Fin de la dernière période de paie (B12)"]];
  for (const [cle, libelle] of dates) if (!dateValide(r[cle])) e.push(`${libelle} : date invalide.`);
  if (dates.every(([cle]) => dateValide(r[cle]))) {
    if (r.premierJour > r.dernierJourPaye) e.push("Le dernier jour payé (B11) est avant le premier jour de travail (B10).");
    if (r.dernierJourPaye > ajouterJours(aujourdhui, 14)) e.push("Le dernier jour payé (B11) ne peut pas être à plus de 14 jours dans le futur.");
    if (r.finDernierePeriode < r.dernierJourPaye) e.push("La fin de la dernière période de paie (B12) est avant le dernier jour payé (B11).");
    else if (ecartJours(r.dernierJourPaye, r.finDernierePeriode) >= (DUREE_PERIODE[r.typePeriode] || 31)) e.push("Le dernier jour payé (B11) doit être dans la dernière période de paie (B12).");
    if (r.rappel === "Y") {
      if (!dateValide(r.dateRappel)) e.push("Date de rappel prévue (B14) manquante.");
      else if (r.dateRappel <= r.dernierJourPaye) e.push("La date de rappel (B14) doit suivre le dernier jour payé.");
    }
    const heures = Number(r.heuresAssurables);
    const maxHeures = (ecartJours(r.premierJour, r.dernierJourPaye) + 1) * 24;
    if (!Number.isInteger(heures) || heures < 1 || heures > 8904) e.push("Heures assurables (B15A) : un nombre entier de 1 à 8 904.");
    else if (heures > maxHeures) e.push("Heures assurables (B15A) : plus d'heures qu'il n'y en a entre le premier et le dernier jour.");
  }
  if (!["U", "Y", "N"].includes(r.rappel)) e.push("Rappel (B14) invalide.");
  if (r.rappel === "Y" && /^[EGM]/.test(r.raison || "")) e.push("Une date de rappel prévue (B14) n'est pas permise pour un départ volontaire, une retraite ou un congédiement.");

  const gains = Array.isArray(r.gainsParPeriode) ? r.gainsParPeriode.map(Number) : [];
  if (gains.length === 0) e.push("Gains assurables par période (B15C) manquants.");
  else {
    if (!(gains[0] >= 1 && gains[0] <= 9999999.99)) e.push("Gains assurables de la dernière période (B15C, période 1) : au moins 1,00 $.");
    if (gains.some((g) => !Number.isFinite(g) || g < 0 || g > 9999999.99)) e.push("Gains assurables (B15C) : montants de 0,00 à 9 999 999,99.");
    if (gains.length > 53) e.push("Gains assurables (B15C) : 53 périodes au plus.");
    // La période qui contient le premier jour de travail ne peut pas être à 0
    const pers = dateValide(r.finDernierePeriode) && dateValide(r.premierJour) ? periodesDePaie(r.typePeriode, r.finDernierePeriode, r.premierJour) : [];
    if (pers.length && pers[pers.length - 1].debut <= r.premierJour && gains.length >= pers.length && !(gains[pers.length - 1] > 0)) {
      e.push("Gains assurables (B15C) : la période du premier jour de travail ne peut pas être à 0,00.");
    }
    if (pers.length && gains.length > pers.length && pers[pers.length - 1].debut <= r.premierJour) e.push("Gains assurables (B15C) : des périodes sont avant le premier jour de travail — retire-les.");
  }

  const v = r.vacances;
  if (v && v.code) {
    if (!CODES_VACANCES[v.code]) e.push("Paie de vacances (B17A) : code invalide.");
    else if (v.code !== "1" && !montantValide(v.montant)) e.push("Paie de vacances (B17A) : montant requis.");
  }
  const feries = Array.isArray(r.joursFeries) ? r.joursFeries : [];
  if (feries.length > 10) e.push("Jours fériés (B17B) : 10 au plus.");
  for (const f of feries) {
    if (!dateValide(f.date) || !montantValide(f.montant)) e.push("Jours fériés (B17B) : chaque ligne demande une date et un montant.");
    else if (dateValide(r.dernierJourPaye) && f.date <= r.dernierJourPaye) e.push("Jours fériés (B17B) : seulement les jours fériés après le dernier jour payé.");
  }
  if (new Set(feries.map((f) => f.date)).size !== feries.length) e.push("Jours fériés (B17B) : une date en double.");
  const autres = Array.isArray(r.autresSommes) ? r.autresSommes : [];
  if (autres.length > 3) e.push("Autres sommes (B17C) : 3 au plus.");
  for (const a of autres) if (!CODES_AUTRES_SOMMES[a.code] || !montantValide(a.montant)) e.push("Autres sommes (B17C) : chaque ligne demande un code et un montant.");
  // Les sommes assurables versées au départ sont comprises dans la période 1
  const sommesAssurables = (v?.code === "2" ? Number(v.montant) || 0 : 0)
    + feries.reduce((t, f) => t + (Number(f.montant) || 0), 0)
    + autres.filter((a) => CODES_AUTRES_SOMMES[a.code]?.assurable).reduce((t, a) => t + (Number(a.montant) || 0), 0);
  if (gains.length > 0 && sommesAssurables > 0 && gains[0] + 0.005 < sommesAssurables) {
    e.push("Gains de la période 1 (B15C) : ils doivent comprendre les sommes assurables versées au départ (vacances au départ, jours fériés, primes, préavis).");
  }
  if (/^K(00|15)/.test(r.raison || "") && !String(r.commentaires || "").trim()) e.push("Commentaire (B18) obligatoire pour la raison « Autre ».");
  if (String(r.commentaires || "").length > 160) e.push("Commentaire (B18) : 160 caractères au plus.");
  return [...new Set(e)];
}
const TYPES_PERIODE_INVERSE = { W: 1, B: 1, S: 1, M: 1 };

// ---------- Fichier XML ----------
const echapper = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const montantXml = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);
const b = (nom, valeur, r) => (valeur === null || valeur === undefined || valeur === "" ? "" : `${r}<${nom}>${echapper(valeur)}</${nom}>\n`);

// Fichier pour RE Web : un ou plusieurs relevés vérifiés (verifierReleve
// vide). emission « D » : brouillon dans RE Web, à réviser et soumettre
// là-bas ; « S » : soumis directement.
export function xmlRelevesEmploi(releves, { employeur, versionLogiciel = "1.0", emission = "D" }) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ROEHEADER FileVersion="W-2.0" SoftwareVendor="kontrolshop" ProductName="kontrolshop" ProductVersion="${echapper(String(versionLogiciel).slice(0, 10))}">\n`;
  for (const { releve: r, employe } of releves) {
    const i = "    ";
    xml += `  <ROE PrintingLanguage="F" Issue="${emission === "S" ? "S" : "D"}">\n`;
    xml += b("B2", r.numeroSerieRemplace, i);
    xml += b("B3", coupe(employe.numeroEmploye, 26), i);
    xml += b("B5", employeur.bn, i);
    xml += b("B6", r.typePeriode, i);
    xml += b("B8", String(employe.nas).replace(/\D/g, ""), i);
    xml += `${i}<B9>\n`
      + b("FN", coupe(employe.prenom, 20), `${i}  `)
      + b("LN", coupe(employe.nomFamille, 28), `${i}  `)
      + b("A1", coupe(employe.adresse, 35), `${i}  `)
      + b("A2", coupe([employe.ville, employe.province].filter(Boolean).join(" "), 35), `${i}  `)
      + b("PC", String(employe.codePostal).replace(/[\s-]/g, "").toUpperCase(), `${i}  `)
      + `${i}</B9>\n`;
    xml += b("B10", r.premierJour, i) + b("B11", r.dernierJourPaye, i) + b("B12", r.finDernierePeriode, i);
    xml += b("B13", coupe(r.profession, 40), i);
    xml += `${i}<B14>\n${b("CD", r.rappel, `${i}  `)}${r.rappel === "Y" ? b("DT", r.dateRappel, `${i}  `) : ""}${i}</B14>\n`;
    xml += b("B15A", String(r.heuresAssurables), i);
    xml += `${i}<B15C>\n`;
    r.gainsParPeriode.forEach((g, n) => {
      xml += `${i}  <PP nbr="${n + 1}">\n${b("AMT", montantXml(g), `${i}    `)}${i}  </PP>\n`;
    });
    xml += `${i}</B15C>\n`;
    xml += `${i}<B16>\n`
      + b("CD", r.raison, `${i}  `)
      + b("FN", coupe(employeur.contactPrenom, 20), `${i}  `)
      + b("LN", coupe(employeur.contactNom, 28), `${i}  `)
      + b("AC", employeur.indicatif, `${i}  `)
      + b("TEL", employeur.telephone7, `${i}  `)
      + b("EXT", String(employeur.poste || "").replace(/\D/g, "").slice(0, 8), `${i}  `)
      + `${i}</B16>\n`;
    const v = r.vacances;
    if (v && v.code) {
      xml += `${i}<B17A>\n${i}  <VP nbr="1">\n${b("CD", v.code, `${i}    `)}`;
      if (v.code === "3" || v.code === "4") xml += b("SDT", v.debut, `${i}    `);
      if (v.code === "3") xml += b("EDT", v.fin, `${i}    `);
      if (v.code !== "1") xml += b("AMT", montantXml(v.montant), `${i}    `);
      xml += `${i}  </VP>\n${i}</B17A>\n`;
    }
    if (r.joursFeries?.length) {
      xml += `${i}<B17B>\n`;
      r.joursFeries.forEach((f, n) => { xml += `${i}  <SH nbr="${n + 1}">\n${b("DT", f.date, `${i}    `)}${b("AMT", montantXml(f.montant), `${i}    `)}${i}  </SH>\n`; });
      xml += `${i}</B17B>\n`;
    }
    if (r.autresSommes?.length) {
      xml += `${i}<B17C>\n`;
      r.autresSommes.forEach((a, n) => { xml += `${i}  <OM nbr="${n + 1}">\n${b("CD", a.code, `${i}    `)}${b("AMT", montantXml(a.montant), `${i}    `)}${i}  </OM>\n`; });
      xml += `${i}</B17C>\n`;
    }
    xml += b("B18", coupe(r.commentaires, 160), i);
    xml += b("B20", "F", i);
    xml += `  </ROE>\n`;
  }
  return `${xml}</ROEHEADER>\n`;
}
