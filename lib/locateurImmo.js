// Fiche du locateur (Immobilier → Locateur) : les lignes de la section A du
// bail — nom, numéro, rue, app., municipalité, code postal, téléphones,
// courriel — pour un ou deux locateurs (copropriétaires d'un immeuble), et
// la personne qui les représente. Gardée dans Parametre (immo_locateur) ;
// tant qu'elle est vide, reprise des informations de l'entreprise.
// Sert au bail rempli (lib/pdfBailFormulaire.js) et à la fiche à recopier
// sur la plateforme du TAL (lib/bailTal.js).

import { prisma } from "./prisma";
import { separerAdresse } from "./adresseImmo";
import { normaliserFicheAdresse, PROVINCE_DEFAUT } from "./adresse";

const CLE = "immo_locateur";
// Adresse saisie au format de l'appli (adresse « 220 rue Richelieu », app.,
// ville, province, code postal) ; no et rue en sont tirés pour les cases du bail
export const CHAMPS_LOCATEUR = ["nom", "adresse", "no", "rue", "app", "ville", "province", "codePostal", "telephone", "telephone2", "courriel"];
const MAX = { nom: 160, adresse: 200, no: 20, rue: 160, app: 20, ville: 120, province: 40, codePostal: 12, telephone: 40, telephone2: 40, courriel: 200 };

const vide = () => Object.fromEntries(CHAMPS_LOCATEUR.map((c) => [c, ""]));

// Locateur tiré des informations de l'entreprise (Administrateur)
export function locateurDeEntreprise(e = {}) {
  const [no, rue] = separerAdresse(e.adresseLigne1);
  return {
    ...vide(), nom: e.nomEntreprise || "", adresse: e.adresseLigne1 || "", no, rue, ville: e.ville || "", province: e.province || PROVINCE_DEFAUT,
    codePostal: e.codePostal || "", telephone: e.telephone || "", courriel: e.courriel || "",
  };
}

// Fiche enregistrée avant le format de l'appli (no et rue à part) : adresse recomposée
const completer = (l) => ({ ...vide(), ...l, adresse: l.adresse || [l.no, l.rue].filter(Boolean).join(" "), province: l.province || PROVINCE_DEFAUT });

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
  return { locateurs: brut.locateurs.slice(0, 2).map(completer), representant: brut.representant || "", enregistre: true };
}

const propre = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export async function enregistrerLocateur(entree = {}) {
  const locateurs = (Array.isArray(entree.locateurs) ? entree.locateurs : []).slice(0, 2)
    .map((l) => Object.fromEntries(CHAMPS_LOCATEUR.map((c) => [c, propre(l?.[c], MAX[c])])))
    .map((l) => {
      const [no, rue] = separerAdresse(l.adresse);
      const a = normaliserFicheAdresse({ ...l, no, rue }, { adresse: "adresse" });
      return { ...a, province: a.province || "", codePostal: a.codePostal || "" };
    })
    .filter((l, i) => i === 0 || l.nom);
  if (!locateurs[0]?.nom) return { erreur: "Inscris le nom du locateur." };
  for (const l of locateurs) if (l.courriel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.courriel)) return { erreur: `Courriel invalide : ${l.courriel}` };
  const valeur = JSON.stringify({ locateurs, representant: propre(entree.representant, 160) });
  await prisma.parametre.upsert({ where: { cle: CLE }, update: { valeur }, create: { cle: CLE, valeur } });
  return { ok: true };
}
