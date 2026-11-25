// Fiche du locateur (Immobilier → Locateur) : les lignes de la section A du
// bail — nom, numéro, rue, app., municipalité, code postal, téléphones,
// courriel — pour un ou deux locateurs (copropriétaires d'un immeuble), et
// la personne qui les représente. Gardée dans Parametre (immo_locateur) ;
// tant qu'elle est vide, reprise des informations de l'entreprise.
// Sert au bail rempli (lib/pdfBailFormulaire.js) et à la fiche à recopier
// sur la plateforme du TAL (lib/bailTal.js).

import { prisma } from "./prisma";
import { separerAdresse } from "./adresseImmo";

const CLE = "immo_locateur";
export const CHAMPS_LOCATEUR = ["nom", "no", "rue", "app", "ville", "codePostal", "telephone", "telephone2", "courriel"];
const MAX = { nom: 160, no: 20, rue: 160, app: 20, ville: 120, codePostal: 12, telephone: 40, telephone2: 40, courriel: 200 };

const vide = () => Object.fromEntries(CHAMPS_LOCATEUR.map((c) => [c, ""]));

// Locateur tiré des informations de l'entreprise (Administrateur)
export function locateurDeEntreprise(e = {}) {
  const [no, rue] = separerAdresse(e.adresseLigne1);
  return { ...vide(), nom: e.nomEntreprise || "", no, rue, ville: e.ville || "", codePostal: e.codePostal || "", telephone: e.telephone || "", courriel: e.courriel || "" };
}

// → { locateurs: [l1, l2?], representant, enregistre }
export async function lireLocateur(entreprise) {
  let brut = null;
  try {
    brut = JSON.parse((await prisma.parametre.findUnique({ where: { cle: CLE } }))?.valeur || "null");
  } catch { brut = null; }
  if (!brut?.locateurs?.length) {
    const e = entreprise || (await (await import("./config")).obtenirInfosEntreprise());
    return { locateurs: [locateurDeEntreprise(e)], representant: e.personneResponsable || "", enregistre: false };
  }
  return { locateurs: brut.locateurs.slice(0, 2).map((l) => ({ ...vide(), ...l })), representant: brut.representant || "", enregistre: true };
}

const propre = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export async function enregistrerLocateur(entree = {}) {
  const locateurs = (Array.isArray(entree.locateurs) ? entree.locateurs : []).slice(0, 2)
    .map((l) => Object.fromEntries(CHAMPS_LOCATEUR.map((c) => [c, propre(l?.[c], MAX[c])])))
    .filter((l, i) => i === 0 || l.nom);
  if (!locateurs[0]?.nom) return { erreur: "Inscris le nom du locateur." };
  for (const l of locateurs) if (l.courriel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.courriel)) return { erreur: `Courriel invalide : ${l.courriel}` };
  const valeur = JSON.stringify({ locateurs, representant: propre(entree.representant, 160) });
  await prisma.parametre.upsert({ where: { cle: CLE }, update: { valeur }, create: { cle: CLE, valeur } });
  return { ok: true };
}
