// Lecture des fichiers de transactions téléchargés de la banque en ligne
// (RBC, CIBC… plateformes pour entreprises comprises) — aucune dépendance à
// Prisma : lib/transactionsBancaires.js s'occupe de l'import en base.
//
// Formats acceptés :
// - OFX / QFX (Quicken) / QBO (QuickBooks) : le même format standard, le
//   meilleur choix — montants signés, numéro de compte et solde du relevé.
// - CSV : colonnes reconnues par leur en-tête (français ou anglais), avec un
//   montant signé (RBC : « CAD$ ») ou des colonnes Débit/Crédit séparées ;
//   sans en-tête, la disposition de CIBC (date, description, débit, crédit).
//
// Retourne { comptes: [{ numero, transactions, solde }] } — un fichier peut
// contenir plusieurs comptes (RBC exporte « tous les comptes » en un seul
// CSV). Chaque transaction : { date: "YYYY-MM-DD", montant, description,
// reference }, montant vu par le titulaire (+ entre, − sort). `solde` :
// { montant, date } ou null, dans le même sens.

function decoderTexte(octets) {
  const utf8 = new TextDecoder("utf-8").decode(octets);
  // Les fichiers OFX 1.x et beaucoup de CSV canadiens sont en Windows-1252 :
  // décodés en UTF-8, leurs accents deviennent des caractères de remplacement.
  if (/CHARSET:\s*1252/i.test(utf8.slice(0, 400)) || utf8.includes("�")) {
    return new TextDecoder("windows-1252").decode(octets);
  }
  return utf8.replace(/^﻿/, "");
}

function nettoyer(texte) {
  return String(texte ?? "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}

// "1 234,56" / "1,234.56" / "(12.34)" / "-12.34 $" → nombre, ou null
function lireMontant(texte) {
  let t = String(texte ?? "").replace(/[\s $]/g, "").replace(/CAD|USD/gi, "");
  if (!t) return null;
  let negatif = false;
  if (/^\(.*\)$/.test(t)) { negatif = true; t = t.slice(1, -1); }
  if (t.endsWith("-")) { negatif = true; t = t.slice(0, -1); }
  if (t.startsWith("-")) { negatif = !negatif; t = t.slice(1); }
  else if (t.startsWith("+")) t = t.slice(1);
  const derniereVirgule = t.lastIndexOf(",");
  const dernierPoint = t.lastIndexOf(".");
  if (derniereVirgule > dernierPoint) {
    // virgule décimale (« 1 234,56 » ou « 1.234,56 »)
    t = t.replace(/\./g, "").replace(",", ".");
  } else {
    t = t.replace(/,/g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return negatif ? -n : n;
}

const arrondir = (n) => Math.round(n * 100) / 100;

// ---------- OFX / QFX / QBO ----------

// Valeur d'une balise, que le fichier soit en OFX 1.x (SGML, sans balise
// fermante) ou 2.x (XML)
function balise(bloc, nom) {
  const m = bloc.match(new RegExp(`<${nom}>([^<\\r\\n]*)`, "i"));
  return m ? nettoyer(m[1]) : "";
}

function blocs(texte, nom) {
  const resultat = [];
  const re = new RegExp(`<${nom}>([\\s\\S]*?)</${nom}>`, "gi");
  let m;
  while ((m = re.exec(texte))) resultat.push(m[1]);
  return resultat;
}

function dateOfx(valeur) {
  const m = String(valeur).match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function lireOfx(texte) {
  // Un relevé par compte : STMTRS (compte bancaire) ou CCSTMTRS (carte de crédit)
  const releves = [...blocs(texte, "STMTRS"), ...blocs(texte, "CCSTMTRS")];
  if (releves.length === 0) throw new Error("Aucun relevé de compte trouvé dans ce fichier OFX.");

  return releves.map((releve) => {
    const transactions = [];
    for (const t of blocs(releve, "STMTTRN")) {
      const date = dateOfx(balise(t, "DTPOSTED") || balise(t, "DTUSER"));
      const montant = lireMontant(balise(t, "TRNAMT"));
      if (!date || montant === null || montant === 0) continue;
      const nom = balise(t, "NAME") || balise(t, "PAYEE");
      const memo = balise(t, "MEMO");
      // NAME est souvent tronqué à 32 caractères : le MEMO complète quand il
      // apporte autre chose
      const description = memo && !nom.toUpperCase().includes(memo.toUpperCase()) ? (nom ? `${nom} — ${memo}` : memo) : nom || memo || balise(t, "TRNTYPE");
      transactions.push({ date, montant: arrondir(montant), description, reference: balise(t, "CHECKNUM") || null });
    }
    const soldeBloc = blocs(releve, "LEDGERBAL")[0] || "";
    const soldeMontant = lireMontant(balise(soldeBloc, "BALAMT"));
    const soldeDate = dateOfx(balise(soldeBloc, "DTASOF"));
    return {
      numero: balise(releve, "ACCTID") || null,
      transactions,
      solde: soldeMontant !== null && soldeDate ? { montant: arrondir(soldeMontant), date: soldeDate } : null,
    };
  });
}

// ---------- CSV ----------

// Découpe un CSV (champs entre guillemets, retours de ligne compris) avec
// le délimiteur le plus fréquent de la première ligne
function decouperCsv(texte) {
  const premiere = texte.split(/\r?\n/, 1)[0] || "";
  const compter = (c) => premiere.split(c).length - 1;
  const delimiteur = [",", ";", "\t"].sort((a, b) => compter(b) - compter(a))[0];

  const lignes = [];
  let ligne = [];
  let champ = "";
  let guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === delimiteur) { ligne.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ); champ = "";
      if (ligne.some((v) => v.trim() !== "")) lignes.push(ligne);
      ligne = [];
    } else champ += c;
  }
  ligne.push(champ);
  if (ligne.some((v) => v.trim() !== "")) lignes.push(ligne);
  return lignes;
}

const normaliser = (texte) => String(texte || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[()$:#.]/g, " ").replace(/\s+/g, " ").trim();

// En-têtes reconnus (sans accents ni casse, parenthèses et « $ » retirés)
const ALIAS_CSV = {
  date: ["date", "transaction date", "date de transaction", "date de la transaction", "date de l'operation", "date operation", "posting date", "posted date", "date comptable", "date d'inscription", "date de valeur", "value date", "date effective", "effective date"],
  description: ["description", "description 1", "libelle", "details", "detail", "transaction", "transaction description", "description de la transaction", "nom", "name", "payee", "beneficiaire", "memo"],
  description2: ["description 2", "memo 2", "details 2", "description supplementaire"],
  montant: ["amount", "montant", "cad", "cad$", "montant cad", "amount cad", "transaction amount", "montant de la transaction"],
  debit: ["debit", "debits", "retrait", "retraits", "withdrawal", "withdrawals", "montant du debit", "debit amount", "sortie", "sorties"],
  credit: ["credit", "credits", "depot", "depots", "deposit", "deposits", "montant du credit", "credit amount", "entree", "entrees"],
  reference: ["cheque number", "cheque", "numero de cheque", "no de cheque", "no cheque", "n de cheque", "numero cheque", "check number", "reference", "no de reference", "numero de reference"],
  solde: ["balance", "solde", "running balance", "solde courant"],
  compte: ["account number", "numero de compte", "no de compte", "compte", "account"],
};

function trouverEntetes(ligne) {
  const colonnes = {};
  ligne.forEach((cellule, index) => {
    const texte = normaliser(cellule);
    for (const [champ, alias] of Object.entries(ALIAS_CSV)) {
      if (colonnes[champ] === undefined && alias.includes(texte)) {
        colonnes[champ] = index;
        break;
      }
    }
  });
  return colonnes.date !== undefined && (colonnes.montant !== undefined || colonnes.debit !== undefined || colonnes.credit !== undefined) ? colonnes : null;
}

// Dates « 2026-01-15 », « 2026/01/15 », « 15/01/2026 » ou « 1/15/2026 » :
// l'ordre jour/mois des dates avec barres se décide sur tout le fichier (une
// valeur > 12 trahit le jour) ; RBC écrit mois/jour, c'est le choix par défaut.
function lecteurDates(valeurs) {
  let jourEnPremier = false;
  for (const v of valeurs) {
    const m = String(v).trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (m && Number(m[1]) > 12) { jourEnPremier = true; break; }
    if (m && Number(m[2]) > 12) break;
  }
  return (valeur) => {
    const v = String(valeur || "").trim();
    let m = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (m) {
      const [jour, mois] = jourEnPremier ? [m[1], m[2]] : [m[2], m[1]];
      return `${m[3]}-${mois.padStart(2, "0")}-${jour.padStart(2, "0")}`;
    }
    m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return null;
  };
}

function lireCsv(texte) {
  const lignes = decouperCsv(texte);
  let indexEntete = lignes.findIndex((l, i) => i < 15 && trouverEntetes(l));
  let colonnes;
  if (indexEntete >= 0) {
    colonnes = trouverEntetes(lignes[indexEntete]);
  } else {
    // Sans en-tête : disposition de CIBC — date, description, débit, crédit
    // (puis numéro de carte pour une carte de crédit)
    colonnes = { date: 0, description: 1, debit: 2, credit: 3 };
    indexEntete = -1;
  }
  const donnees = lignes.slice(indexEntete + 1);
  const lireDate = lecteurDates(donnees.map((l) => l[colonnes.date]));

  const parCompte = new Map();
  for (const l of donnees) {
    const date = lireDate(l[colonnes.date]);
    if (!date) continue;
    let montant;
    if (colonnes.montant !== undefined) {
      montant = lireMontant(l[colonnes.montant]);
    } else {
      // Débit = argent qui sort, crédit = argent qui entre — certaines banques
      // écrivent le débit en négatif, d'où la valeur absolue
      const debit = lireMontant(l[colonnes.debit]);
      const credit = lireMontant(l[colonnes.credit]);
      montant = debit === null && credit === null ? null : Math.abs(credit || 0) - Math.abs(debit || 0);
    }
    if (montant === null || montant === 0) continue;
    const description = [l[colonnes.description], l[colonnes.description2]].map(nettoyer).filter(Boolean).join(" — ") || "(sans description)";
    const numero = colonnes.compte !== undefined ? nettoyer(l[colonnes.compte]) || null : null;
    if (!parCompte.has(numero)) parCompte.set(numero, { numero, transactions: [], soldes: [] });
    const compte = parCompte.get(numero);
    compte.transactions.push({ date, montant: arrondir(montant), description, reference: colonnes.reference !== undefined ? nettoyer(l[colonnes.reference]) || null : null });
    if (colonnes.solde !== undefined) {
      const solde = lireMontant(l[colonnes.solde]);
      if (solde !== null) compte.soldes.push({ date, montant: arrondir(solde), rang: compte.transactions.length });
    }
  }

  return [...parCompte.values()].map(({ numero, transactions, soldes }) => {
    // Solde courant : celui de la transaction la plus récente — en cas
    // d'égalité de date, la dernière lue si le fichier va du plus ancien au
    // plus récent, la première sinon
    let solde = null;
    if (soldes.length > 0) {
      const croissant = transactions[0].date <= transactions[transactions.length - 1].date;
      const plusRecente = soldes.reduce((a, b) => (b.date > a.date || (b.date === a.date && croissant) ? b : a));
      solde = { montant: plusRecente.montant, date: plusRecente.date };
    }
    return { numero, transactions, solde };
  });
}

function lireReleve(octets, nomFichier = "") {
  const texte = decoderTexte(octets);
  const estOfx = /\.(ofx|qfx|qbo)$/i.test(nomFichier) || /<OFX>/i.test(texte.slice(0, 5000));
  const comptes = estOfx ? lireOfx(texte) : lireCsv(texte);
  if (!comptes.some((c) => c.transactions.length > 0)) {
    throw new Error(estOfx
      ? "Aucune transaction trouvée dans ce fichier."
      : "Aucune transaction reconnue dans ce fichier CSV — il faut au moins une colonne de date et une colonne de montant (ou Débit/Crédit).");
  }
  return { format: estOfx ? "OFX" : "CSV", comptes: comptes.filter((c) => c.transactions.length > 0) };
}

module.exports = { lireReleve, lireMontant };
