// Numérotation séquentielle automatique de tous les documents du logiciel :
// PREFIXE-001, PREFIXE-002… (au moins 3 chiffres, puis 1000, 1001… sans
// plafond). Les bons de travail prennent l'année en cours comme préfixe et
// repartent à 001 chaque 1er janvier (2026-001, 2027-001…).
//
// Le prochain numéro est le plus grand existant + 1 en comparant les
// nombres, pas le texte : en ordre alphabétique « 999 » passe après
// « 1000 », ce qui ramènerait sans fin au même numéro. Le filtre startsWith
// et le contrôle « chiffres seulement » ignorent les valeurs hors format
// (ex. numéros d'employé entrés manuellement avant l'automatisation).
const { prisma } = require("./prisma");
const { dateAujourdhuiQuebec } = require("./temps");

async function prochainNumero(delegate, champ, prefixe) {
  const debut = `${prefixe}-`;
  const lignes = await delegate.findMany({ where: { [champ]: { startsWith: debut } }, select: { [champ]: true } });
  let plusGrand = 0;
  for (const ligne of lignes) {
    const suffixe = ligne[champ].slice(debut.length);
    if (/^\d+$/.test(suffixe)) plusGrand = Math.max(plusGrand, Number(suffixe));
  }
  return `${debut}${String(plusGrand + 1).padStart(3, "0")}`;
}

// Crée un document numéroté. Si un autre document a pris le même numéro
// entretemps (deux créations presque simultanées), réessaie avec le suivant.
// `creer(numero)` peut être une transaction complète : elle est rejouée.
async function creerAvecNumero(genererNumero, creer, essais = 8) {
  for (let essai = 1; ; essai++) {
    const numero = await genererNumero();
    try {
      return await creer(numero);
    } catch (e) {
      const collisionNumero = e?.code === "P2002" && [].concat(e.meta?.target ?? []).some((t) => String(t).includes("numero"));
      if (!collisionNumero || essai >= essais) throw e;
    }
  }
}

function prochainNumeroBon() {
  return prochainNumero(prisma.bonTravail, "numero", dateAujourdhuiQuebec().slice(0, 4));
}

function prochainNumeroFacture() {
  return prochainNumero(prisma.facture, "numero", "FAC");
}

function prochainNumeroSoumission() {
  return prochainNumero(prisma.soumission, "numero", "SOU");
}

function prochainNumeroLotPaie() {
  return prochainNumero(prisma.lotPaie, "numero", "PAIE");
}

function prochainNumeroEcriture() {
  return prochainNumero(prisma.ecritureComptable, "numero", "EC");
}

function prochainNumeroClient() {
  return prochainNumero(prisma.client, "numero", "CLI");
}

function prochainNumeroFournisseur() {
  return prochainNumero(prisma.fournisseur, "numero", "FOUR");
}

function prochainNumeroCommandeFournisseur() {
  return prochainNumero(prisma.commandeFournisseur, "numero", "CMD");
}

function prochainNumeroEmploye() {
  return prochainNumero(prisma.user, "numeroEmploye", "EMP");
}

module.exports = {
  prochainNumero, creerAvecNumero,
  prochainNumeroBon, prochainNumeroFacture, prochainNumeroSoumission, prochainNumeroLotPaie, prochainNumeroEcriture,
  prochainNumeroClient, prochainNumeroFournisseur, prochainNumeroEmploye, prochainNumeroCommandeFournisseur,
};
