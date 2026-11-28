// Entretien préventif des immeubles (module Immobilier) : ce qui revient —
// ramonage, avertisseurs de fumée, gouttières, chauffe-eau… — avec sa
// fréquence et sa prochaine date (page /immobilier/entretien).
//
//   • « Fait » inscrit l'intervention comme réparation terminée de
//     l'immeuble (historique, coût réel — compté au rendement et à l'impôt)
//     et avance la prochaine date d'une fréquence.
//   • Un entretien qui se fait dans les logements prépare l'avis d'accès
//     de 24 h (art. 1931 C.c.Q.) pour chaque bail résidentiel en cours de
//     l'immeuble, rangé dans ses documents et, au choix, envoyé par courriel.
//   • En retard ou dans 14 jours : dans la liste « À faire » du tableau de
//     bord et dans les avis au propriétaire (aSurveillerEntretien).
import { prisma } from "./prisma";
import { creerReparation, genererDocumentBail } from "./immobilier";
import { synchroniserComptaImmo, periodeImmoBloquee } from "./immobilierCompta";
import { prochaineApres } from "./immobilierCalculs";

const dateValide = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
const aMidi = (v) => new Date(`${v}T12:00:00Z`);
const montant = (v) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return String(v ?? "").trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

// « Fait le … » : { date, coutReel, entrepreneur, numeroFacture, notes } → { reparationId, prochaineDate }
export async function marquerFait(id, entree, creePar) {
  const e = await prisma.entretienImmo.findUnique({ where: { id } });
  if (!e) return { erreur: "Entretien introuvable." };
  if (!dateValide(entree.date)) return { erreur: "Indique la date de l'intervention." };
  const quand = aMidi(entree.date);
  const coutReel = montant(entree.coutReel);
  const periode = coutReel ? await periodeImmoBloquee({ nouvelles: [quand] }) : null;
  if (periode) return { erreur: periode };
  const r = await creerReparation({
    titre: e.titre.slice(0, 200), categorie: e.categorie, priorite: "NORMALE", statut: "TERMINEE", immeubleId: e.immeubleId, logementId: null,
    signalePar: "Entretien préventif", entrepreneur: String(entree.entrepreneur || e.entrepreneur || "").slice(0, 160) || null,
    telephoneEntrepreneur: e.telephoneEntrepreneur, dateFin: quand, coutReel, numeroFacture: String(entree.numeroFacture || "").slice(0, 80) || null,
    notes: String(entree.notes || "").slice(0, 2000) || null, entretienId: e.id, creePar,
  });
  const prochaineDate = prochaineApres(quand, e.frequenceMois);
  await prisma.entretienImmo.update({ where: { id }, data: { derniereDate: quand, prochaineDate } });
  if (coutReel) await synchroniserComptaImmo({ creePar });
  return { reparationId: r.id, prochaineDate };
}

// Avis d'accès aux locataires de l'immeuble : { dateAcces, heure, envoyer }
// → { generes, envoyes, sansCourriel, erreurs }
export async function avisAccesEntretien(id, entree, creePar) {
  const e = await prisma.entretienImmo.findUnique({ where: { id }, include: { immeuble: { select: { id: true } } } });
  if (!e) return { erreur: "Entretien introuvable." };
  if (!dateValide(entree.dateAcces)) return { erreur: "Indique la date de la visite." };
  const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
  if (entree.dateAcces <= aujourdhui) return { erreur: "L'avis d'accès se donne au moins 24 heures avant la visite : choisis une date à partir de demain." };
  const baux = await prisma.bailImmo.findMany({ where: { statut: "ACTIF", logement: { immeubleId: e.immeubleId, type: "LOGEMENT" } }, select: { id: true, logement: { select: { numero: true } } } });
  if (baux.length === 0) return { erreur: "Aucun bail résidentiel en cours dans cet immeuble." };
  const details = [e.titre, e.description].filter(Boolean).join(" — ").slice(0, 600);
  let generes = 0;
  let envoyes = 0;
  const sansCourriel = [];
  const erreurs = [];
  const { envoyerDocument, courrielConfigure } = await import("./immobilierCourriel");
  const parCourriel = entree.envoyer === true && courrielConfigure();
  for (const b of baux) {
    const r = await genererDocumentBail(b.id, "AVIS_ACCES", {
      motif: e.type === "INSPECTION" ? "VERIFICATION" : "TRAVAUX", dateAcces: entree.dateAcces, heure: String(entree.heure || "").slice(0, 40), details, dateAvis: aujourdhui,
    }, creePar);
    if (r.erreur) { erreurs.push(`${b.logement.numero} : ${r.erreur}`); continue; }
    generes += 1;
    if (parCourriel) {
      const env = await envoyerDocument(r.id, creePar);
      if (env.erreur || !env.envoyes) sansCourriel.push(b.logement.numero);
      else envoyes += 1;
    }
  }
  return { generes, envoyes, sansCourriel, erreurs, parCourriel };
}
