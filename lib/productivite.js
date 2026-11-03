// Indicateurs de productivité (Productivité par employés, Rentabilité par
// période). Serveur seulement.

import { dateQuebecStr } from "./temps";
import { tacheAuForfait } from "./kits";

// ---------------------------------------------------------------------------
// Taux de facturation : heures vendues au client ÷ heures poinçonnées.
//
// Heures vendues d'une tâche d'un bon facturé :
// - Main-d'œuvre à l'heure : les heures poinçonnées terminées (ce que la
//   facture compte, voir heuresFacturablesTache) ;
// - Main-d'œuvre comprise dans un kit (forfait) : les heures de
//   main-d'œuvre prévues dans le kit × la quantité de kits ;
// - Ligne de main-d'œuvre d'une soumission facturée directement (poste
//   4000) : les heures de la ligne (temps estimé).
// Les autres postes (remorquage, alignement, entreposage, pièces…) ne vendent
// pas d'heures : leurs tâches sont laissées hors du calcul (null).
//
// Les heures vendues d'une tâche se partagent entre les employés au prorata
// de leurs heures poinçonnées dessus.
export function heuresVenduesTache(probleme) {
  const cat = probleme.categorieRevenu || "MAIN_OEUVRE";
  if (cat === "MAIN_OEUVRE") {
    if (tacheAuForfait(probleme)) {
      return (probleme.pieces || []).reduce((s, l) => s + (l.kit?.heures > 0 ? l.kit.heures * l.qte : 0), 0);
    }
    return heuresPoinconneesTache(probleme);
  }
  if (cat === "4000") return Number(probleme.factureQte) || 0;
  return null;
}

export function heuresPoinconneesTache(probleme) {
  return (probleme.entreesTemps || [])
    .filter((t) => t.fin)
    .reduce((s, t) => s + (new Date(t.fin) - new Date(t.debut)) / 3600000, 0);
}

// Pour les poinçons terminés d'un employé : { heuresVendues, heuresPoinconnees }
// sur les tâches de bons facturés (facture non annulée) qui vendent des heures.
// Chaque poinçon doit inclure probleme { categorieRevenu, factureQte, pieces,
// entreesTemps, bon: { facture } }.
export function tauxFacturationEmploye(entrees) {
  let heuresVendues = 0;
  let heuresPoinconnees = 0;
  for (const t of entrees) {
    if (!t.fin) continue;
    const facture = t.probleme.bon.facture;
    if (!facture || facture.statut === "ANNULEE") continue;
    const vendues = heuresVenduesTache(t.probleme);
    if (vendues === null) continue;
    const totalTache = heuresPoinconneesTache(t.probleme);
    const siennes = (new Date(t.fin) - new Date(t.debut)) / 3600000;
    heuresPoinconnees += siennes;
    if (totalTache > 0) heuresVendues += vendues * (siennes / totalTache);
  }
  return { heuresVendues, heuresPoinconnees };
}

// ---------------------------------------------------------------------------
// Poinçons oubliés : un poinçon (sur un bon ou une tâche interne) est
// suspect s'il dure plus de SEUIL_POINCON_OUBLIE_HEURES, ou s'il déborde sur
// un autre jour (commencé un jour, terminé — ou toujours ouvert — le
// lendemain ou plus tard). Un poinçon encore ouvert compte jusqu'à maintenant.
export const SEUIL_POINCON_OUBLIE_HEURES = 10;

// Combien de jours en arrière chercher les poinçons déjà fermés mais suspects
export const JOURS_POINCONS_OUBLIES = 7;

export function estPoinconSuspect(entree, maintenant = new Date()) {
  const fin = entree.fin ? new Date(entree.fin) : maintenant;
  const heures = (fin - new Date(entree.debut)) / 3600000;
  return heures > SEUIL_POINCON_OUBLIE_HEURES || dateQuebecStr(entree.debut) !== dateQuebecStr(fin);
}
