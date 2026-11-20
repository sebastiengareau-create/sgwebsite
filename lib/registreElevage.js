// Registre de l'élevage (module « Élevage », lib/elevage.js) : identification
// ATQ des bêtes et journal de ce qui leur arrive — naissances, arrivées,
// déplacements, remplacements de boucle, sorties. Sans accès à la base :
// utilisable dans le navigateur comme sur le serveur.
import { dateCourte, nomBete } from "./elevageCalculs";

// ---------- Boucle d'oreille ATQ ----------
// Le numéro d'identification d'un bovin compte 15 chiffres (code du pays,
// 124 pour le Canada, puis le numéro de l'animal) ; la boucle électronique
// et le panneau visuel portent le même.

// Texte saisi → les 15 chiffres, ou null s'il n'en a pas 15
export function normaliserBoucle(v) {
  const chiffres = String(v ?? "").replace(/[\s\-.]/g, "");
  return /^\d{15}$/.test(chiffres) ? chiffres : null;
}

// « 124000312345678 » → « 124 000 312 345 678 » ; tout autre texte tel quel
export const formaterBoucle = (v) => (/^\d{15}$/.test(v || "") ? v.replace(/(\d{3})(?=\d)/g, "$1 ") : v || "");

export const RAISONS_BOUCLE = [
  { code: "PERDUE", label: "Boucle perdue" },
  { code: "ILLISIBLE", label: "Boucle illisible ou brisée" },
  { code: "ERREUR", label: "Erreur de pose" },
  { code: "AUTRE", label: "Autre" },
];

// ---------- Déplacements ----------

export const TYPES_DEPLACEMENT = [
  { code: "INTERNE", label: "Changement d'enclos ou de pâturage" },
  { code: "SORTIE", label: "Sortie vers un autre site" },
  { code: "ENTREE", label: "Arrivée d'un autre site" },
];

// Où se trouve une bête : le lieu de son dernier déplacement — ou hors de
// la ferme si c'est une sortie → { lieu, horsFerme, depuis } ou null
export function emplacement(deplacements) {
  const dernier = [...(deplacements || [])].sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.creeLe || 0) - new Date(a.creeLe || 0))[0];
  if (!dernier) return null;
  if (dernier.type === "SORTIE") return { lieu: dernier.site || "autre site", horsFerme: true, depuis: dernier.date };
  return dernier.lieu ? { lieu: dernier.lieu, horsFerme: false, depuis: dernier.date } : null;
}

// ---------- Journal ----------

export const EVENEMENTS = {
  NAISSANCE: "Naissance",
  ARRIVEE: "Arrivée (achat)",
  ENTREE: "Arrivée d'un autre site",
  SORTIE: "Sortie vers un autre site",
  INTERNE: "Changement d'enclos",
  BOUCLE: "Remplacement de boucle",
  ABATTAGE: "Sortie — abattoir",
  VENTE: "Sortie — vente sur pied",
  MORT: "Mort",
};

// Délai habituel d'une déclaration à Agri-Traçabilité Québec, en jours
export const DELAI_DECLARATION = 7;

// Tout ce qui est arrivé aux bêtes, du plus récent au plus ancien.
// betes : avec deplacements, boucles et abattage ; declarations : Map cle →
// { declareLe }. → [{ cle, date, type, bete, detail, transporteur,
// aDeclarer (événement à déclarer à ATQ), declareLe }]
export function evenementsRegistre(betes, declarations = new Map()) {
  const liste = [];
  const ajouter = (bete, cle, date, type, detail = "", plus = {}) => {
    if (!date) return;
    const aDeclarer = type !== "INTERNE";
    liste.push({ cle, date, type, bete, detail, aDeclarer, declareLe: aDeclarer ? declarations.get(cle)?.declareLe || null : null, ...plus });
  };
  for (const b of betes) {
    if (b.origine === "NEE_ICI") ajouter(b, `naissance:${b.id}`, b.dateNaissance, "NAISSANCE");
    else ajouter(b, `achat:${b.id}`, b.dateAcquisition, "ARRIVEE", b.provenance ? `de ${b.provenance}` : "");
    for (const d of b.deplacements || []) {
      const detail = d.type === "INTERNE" ? `vers ${d.lieu}` : [d.site && `${d.type === "ENTREE" ? "de" : "vers"} ${d.site}`, d.type === "ENTREE" && d.lieu && `→ ${d.lieu}`].filter(Boolean).join(" ");
      ajouter(b, `depl:${d.id}`, d.date, d.type, [detail, d.note].filter(Boolean).join(" · "), { transporteur: d.transporteur || "", deplacementId: d.id });
    }
    for (const x of b.boucles || []) ajouter(b, `boucle:${x.id}`, x.retireeLe, "BOUCLE", `${formaterBoucle(x.numero)} → ${formaterBoucle(x.remplaceePar)}`);
    if (b.abattage) ajouter(b, `abattage:${b.id}`, b.abattage.date, "ABATTAGE", b.abattage.abattoir || "");
    else if (b.statut === "VENDUE") ajouter(b, `vente:${b.id}`, b.dateSortie, "VENTE");
    else if (b.statut === "MORTE") ajouter(b, `mort:${b.id}`, b.dateSortie, "MORT");
  }
  return liste.sort((x, y) => new Date(y.date) - new Date(x.date) || x.cle.localeCompare(y.cle));
}

// Lignes du fichier d'export (CSV) du registre
export const ENTETES_EXPORT = ["Date", "Événement", "Boucle ATQ", "Numéro", "Nom", "Détail", "Transporteur", "À déclarer à ATQ", "Déclaré le"];
export function ligneExport(e) {
  return [
    dateCourte(e.date), EVENEMENTS[e.type], formaterBoucle(e.bete.identifiant), e.bete.numero, e.bete.nom || "", e.detail, e.transporteur || "",
    e.aDeclarer ? "oui" : "non", e.declareLe ? dateCourte(e.declareLe) : "",
  ];
}

export { nomBete };
