// Fin d'année de paie : la déclaration T4 en XML pour l'ARC (Transfert de
// fichiers par Internet), d'après les feuillets calculés par
// lib/feuilletsFiscaux.js, et la vérification de ce qu'il faut avant de
// la produire.
//
// Format : spécifications T619 et T4 de l'ARC pour 2027 (schéma 1-27-1,
// fichier T619_T4.xsd), celles qui servent à transmettre les T4 de 2026 à
// partir de janvier 2027. L'installation est au Québec : la province
// d'emploi est QC, les cotisations sont au RRQ (cases 17, 17A) et au RQAP
// (cases 55, 56). Le sommaire T4 ne porte pas le RRQ (déclaré à Revenu
// Québec) : seulement l'AE et l'impôt fédéral.
import { lireParametre } from "./parametres";
import { nasValide } from "./nas";
import { nomsEmploye } from "./nomsFeuillets";

export const CLE_CODE_DENTAIRE = "paie_code_dentaire";

const echapper = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const coupe = (s, n) => String(s || "").trim().replace(/\s+/g, " ").slice(0, n);
const montant = (n) => (Math.round(Number(n || 0) * 100) / 100).toFixed(2);
const arrondir = (n) => Math.round(Number(n || 0) * 100) / 100;

export const bnValide = (bn) => /^\d{9}RP\d{4}$/.test(String(bn || "")) && !/^0{9}/.test(bn) && !/0000$/.test(bn);
export const codePostalCanada = (cp) => {
  const c = String(cp || "").replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(c) ? c : null;
};
// « (514) 555-1234 poste 12 » → { indicatif: "514", numero: "555-1234", poste: "12" }
export function decouperTelephone(tel) {
  const texte = String(tel || "");
  const poste = /(?:poste|post\.?|ext\.?|x|#)\s*(\d+)\s*$/i.exec(texte)?.[1] || "";
  let chiffres = texte.replace(/(?:poste|post\.?|ext\.?|x|#)\s*\d+\s*$/i, "").replace(/\D/g, "");
  if (chiffres.length === 11 && chiffres.startsWith("1")) chiffres = chiffres.slice(1);
  if (chiffres.length !== 10) return null;
  return { indicatif: chiffres.slice(0, 3), numero: `${chiffres.slice(3, 6)}-${chiffres.slice(6)}`, sept: chiffres.slice(3), poste };
}

export async function lireCodeDentaireDefaut() {
  const n = Number(await lireParametre(CLE_CODE_DENTAIRE));
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 1;
}

// Date limite pour produire les T4 et remettre les copies : le dernier jour
// de février de l'année suivante, reportée au lundi si elle tombe une fin
// de semaine → « AAAA-MM-JJ »
export function echeanceFeuillets(annee) {
  const d = new Date(Date.UTC(annee + 1, 2, 0, 12)); // dernier jour de février
  const jour = d.getUTCDay();
  if (jour === 6) d.setUTCDate(d.getUTCDate() + 2);
  if (jour === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Ce qui manque avant de produire les feuillets : { bloquants, aVerifier }
// bloquants : sans eux, le fichier serait refusé ; aVerifier : il part,
// mais c'est à regarder
export function verifierPreparation({ entreprise, feuillets }) {
  const bloquants = [];
  const aVerifier = [];
  if (!bnValide(entreprise.numeroEmployeurArc)) bloquants.push("Numéro d'employeur de l'ARC (compte de retenues, ex. 123456789RP0001) manquant ou invalide — Administrateur → Informations de l'entreprise.");
  if (!coupe(entreprise.nomEntreprise, 30)) bloquants.push("Nom de l'entreprise manquant.");
  if (!decouperTelephone(entreprise.telephone)) bloquants.push("Téléphone de l'entreprise (10 chiffres) manquant : il sert de contact pour l'ARC — Administrateur → Informations de l'entreprise.");
  if (!/^\S+@\S+\.\S+$/.test(String(entreprise.courriel || "").trim())) bloquants.push("Courriel de l'entreprise manquant : l'ARC l'exige pour le contact — Administrateur → Informations de l'entreprise.");
  if (!coupe(entreprise.personneResponsable, 35)) aVerifier.push("Personne responsable de l'entreprise non indiquée : le nom de l'entreprise sert de contact.");
  if (!entreprise.adresseLigne1 || !entreprise.ville || !codePostalCanada(entreprise.codePostal)) aVerifier.push("Adresse de l'entreprise incomplète (adresse, ville, code postal).");
  for (const f of feuillets) {
    const e = f.employe;
    const noms = nomsEmploye(e);
    if (!nasValide(e.nas)) bloquants.push(`${e.nom} : NAS manquant ou invalide — fiche de l'employé.`);
    if (!noms.nomFamille) bloquants.push(`${e.nom} : nom de famille manquant.`);
    else if (noms.deduits) aVerifier.push(`${e.nom} : nom de famille « ${noms.nomFamille} » et prénom « ${noms.prenom || "—"} » déduits du nom — à confirmer.`);
    if (!e.adresse || !e.ville || !codePostalCanada(e.codePostal)) aVerifier.push(`${e.nom} : adresse incomplète (adresse, ville, code postal) — fiche de l'employé.`);
  }
  return { bloquants, aVerifier };
}

const balise = (nom, valeur, retrait) => (valeur === null || valeur === undefined || valeur === "" ? "" : `${retrait}<${nom}>${echapper(valeur)}</${nom}>\n`);
function bloc(nom, contenu, retrait) {
  return contenu ? `${retrait}<${nom}>\n${contenu}${retrait}</${nom}>\n` : "";
}
// Adresse trop longue pour une ligne de 30 caractères : la suite va sur la
// deuxième ligne, coupée entre deux mots
function deuxLignes(adresse, n = 30) {
  const t = coupe(adresse, 200);
  if (t.length <= n) return [t, ""];
  const coupure = t.lastIndexOf(" ", n);
  const i = coupure > 0 ? coupure : n;
  return [t.slice(0, i).trim(), coupe(t.slice(i), n)];
}
function adresseXml(nom, { adresse, ville, province, codePostal }, retrait) {
  const r = `${retrait}  `;
  const [ligne1, ligne2] = deuxLignes(adresse);
  return bloc(nom,
    balise("addr_l1_txt", ligne1, r)
    + balise("addr_l2_txt", ligne2, r)
    + balise("cty_nm", coupe(ville, 28), r)
    + balise("prov_cd", /^[A-Z]{2}$/.test(String(province || "").toUpperCase()) ? String(province).toUpperCase() : "", r)
    + balise("cntry_cd", "CAN", r)
    + balise("pstl_cd", codePostalCanada(codePostal), r),
    retrait);
}

// Montants d'un feuillet tels qu'ils vont dans le XML (arrondis au cent)
export function casesT4(f) {
  const m = f.montants;
  return {
    empt_incamt: arrondir(m.revenus),
    qpp_cntrb_amt: arrondir(m.rrq),
    qppe_cntrb_amt: arrondir(m.rrq2),
    empe_eip_amt: arrondir(m.ae),
    itx_ddct_amt: arrondir(m.impotFederal),
    ei_insu_ern_amt: arrondir(m.gainsAssurablesAe),
    cpp_qpp_ern_amt: arrondir(m.gainsPension),
    prov_pip_amt: arrondir(m.rqap),
    prov_insu_ern_amt: arrondir(m.salaireRqap),
  };
}

// Déclaration T4 complète (T619 + feuillets + sommaire) → { xml, nomFichier }.
// À appeler après verifierPreparation, sans bloquant.
export function genererT4Xml({ annee, feuillets, entreprise, codeDentaireDefaut = 1, maintenant = new Date() }) {
  const bn = entreprise.numeroEmployeurArc;
  const tel = decouperTelephone(entreprise.telephone);
  const contact = coupe(entreprise.personneResponsable, 35) || coupe(entreprise.nomEntreprise, 35);
  const refSoumission = `${String(annee).slice(2)}${maintenant.getTime().toString(36)}`.toUpperCase().slice(-8);
  const adresseEntreprise = { adresse: entreprise.adresseLigne1, ville: entreprise.ville, province: entreprise.province, codePostal: entreprise.codePostal };

  let feuilletsXml = "";
  const totaux = { revenus: 0, ae: 0, impot: 0, aeEmployeur: 0 };
  for (const f of feuillets) {
    const e = f.employe;
    const noms = nomsEmploye(e);
    const c = casesT4(f);
    totaux.revenus += c.empt_incamt;
    totaux.ae += c.empe_eip_amt;
    totaux.impot += c.itx_ddct_amt;
    totaux.aeEmployeur += arrondir(f.employeur.ae);
    const r = "        ";
    const r2 = `${r}  `;
    const positif = (nom) => (c[nom] > 0 ? balise(nom, montant(c[nom]), r2) : "");
    feuilletsXml += `      <T4Slip>\n`
      + bloc("EMPE_NM", balise("snm", coupe(noms.nomFamille, 20), r2) + balise("gvn_nm", coupe(noms.prenom, 12), r2), r)
      + adresseXml("EMPE_ADDR", e, r)
      + balise("sin", String(e.nas).replace(/\D/g, ""), r)
      + balise("empe_nbr", coupe(e.numeroEmploye, 20), r)
      + balise("bn", bn, r)
      + balise("cpp_qpp_xmpt_cd", e.exemptionRRQ || c.qpp_cntrb_amt === 0 ? "1" : "0", r)
      + balise("ei_xmpt_cd", e.exemptionAE || c.empe_eip_amt === 0 ? "1" : "0", r)
      + balise("prov_pip_xmpt_cd", c.prov_pip_amt === 0 ? "1" : "0", r)
      + balise("rpt_tcd", "O", r)
      + balise("empt_prov_cd", "QC", r)
      + balise("empr_dntl_ben_rpt_cd", String(e.codeDentaireT4 || codeDentaireDefaut), r)
      + `${r}<T4_AMT>\n`
      + balise("empt_incamt", montant(c.empt_incamt), r2)
      + positif("qpp_cntrb_amt")
      + positif("qppe_cntrb_amt")
      + positif("empe_eip_amt")
      + positif("itx_ddct_amt")
      + balise("ei_insu_ern_amt", montant(c.ei_insu_ern_amt), r2)
      + balise("cpp_qpp_ern_amt", montant(c.cpp_qpp_ern_amt), r2)
      + positif("prov_pip_amt")
      + positif("prov_insu_ern_amt")
      + `${r}</T4_AMT>\n`
      + `      </T4Slip>\n`;
  }

  const r = "        ";
  const r2 = `${r}  `;
  const sommaire = `      <T4Summary>\n`
    + balise("bn", bn, r)
    + bloc("EMPR_NM", balise("l1_nm", coupe(entreprise.nomEntreprise, 30), r2), r)
    + adresseXml("EMPR_ADDR", adresseEntreprise, r)
    + bloc("CNTC",
      balise("cntc_nm", coupe(contact, 22), r2)
      + balise("cntc_area_cd", tel.indicatif, r2)
      + balise("cntc_phn_nbr", tel.numero, r2)
      + balise("cntc_extn_nbr", tel.poste.slice(0, 5), r2), r)
    + balise("tx_yr", String(annee), r)
    + balise("slp_cnt", String(feuillets.length), r)
    + balise("rpt_tcd", "O", r)
    + bloc("T4_TAMT",
      balise("tot_empt_incamt", montant(totaux.revenus), r2)
      + (totaux.ae > 0 ? balise("tot_empe_eip_amt", montant(totaux.ae), r2) : "")
      + (totaux.impot > 0 ? balise("tot_itx_ddct_amt", montant(totaux.impot), r2) : "")
      + (totaux.aeEmployeur > 0 ? balise("tot_empr_eip_amt", montant(totaux.aeEmployeur), r2) : ""), r)
    + `      </T4Summary>\n`;

  const t619 = `  <T619>\n`
    + bloc("TransmitterAccountNumber", balise("bn15", bn, "      "), "    ")
    + balise("sbmt_ref_id", refSoumission, "    ")
    + balise("summ_cnt", "1", "    ")
    + balise("lang_cd", "F", "    ")
    + bloc("TransmitterName", balise("l1_nm", coupe(entreprise.nomEntreprise, 35), "      "), "    ")
    + balise("TransmitterCountryCode", "CAN", "    ")
    + bloc("CNTC",
      balise("cntc_nm", contact, "      ")
      + balise("cntc_area_cd", tel.indicatif, "      ")
      + balise("cntc_phn_nbr", tel.numero, "      ")
      + balise("cntc_extn_nbr", tel.poste.slice(0, 12), "      ")
      + balise("cntc_email_area", coupe(entreprise.courriel, 60), "      "), "    ")
    + `  </T619>\n`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<Submission xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="layout-topologie.xsd">\n`
    + t619
    + `  <Return>\n    <T4>\n${feuilletsXml}${sommaire}    </T4>\n  </Return>\n`
    + `</Submission>\n`;
  return {
    xml,
    nomFichier: `T4-${annee}-${bn}.xml`,
    totaux: { revenus: arrondir(totaux.revenus), ae: arrondir(totaux.ae), impot: arrondir(totaux.impot), aeEmployeur: arrondir(totaux.aeEmployeur) },
  };
}
