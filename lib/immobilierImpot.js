// Revenus de location pour l'impôt : l'état annuel de chaque immeuble sur
// les lignes du T776 (calcul : etatRevenusLocation, lib/immobilierCalculs.js),
// page /immobilier/depenses/impot, PDF et CSV pour le comptable.

import { prisma } from "./prisma";
import { etatRevenusLocation, ligneT776, LIGNES_T776, libelle, nomLogement, CATEGORIES_DEPENSE } from "./immobilierCalculs";

const bornes = (annee) => ({ gte: new Date(Date.UTC(annee, 0, 1)), lt: new Date(Date.UTC(annee + 1, 0, 1)) });
const immeubleDuBail = { bail: { select: { id: true, dateDebut: true, logement: { select: { numero: true, type: true, immeubleId: true } }, locataires: { select: { nom: true } } } } };

// Les données de l'année → { annee, etat, lignes (détail pour le CSV) }
export async function donneesImpot(annee) {
  const periode = bornes(annee);
  const [immeubles, charges, paiements, depenses, reparations] = await Promise.all([
    prisma.immeubleImmo.findMany({ select: { id: true, nom: true, adresse: true, ville: true, codePostal: true, _count: { select: { logements: true } } }, orderBy: { nom: "asc" } }),
    prisma.chargeImmo.findMany({ where: { date: periode }, select: { type: true, montant: true, date: true, description: true, ...immeubleDuBail } }),
    prisma.paiementImmo.findMany({ where: { date: periode }, select: { montant: true, ...immeubleDuBail } }),
    prisma.depenseImmo.findMany({ where: { date: periode }, select: { immeubleId: true, categorie: true, montant: true, date: true, description: true, payeA: true, reference: true }, orderBy: { date: "asc" } }),
    // Réparations terminées dans l'année (date de fin, sinon date de la demande), comme le rendement
    prisma.reparationImmo.findMany({
      where: { statut: "TERMINEE", coutReel: { gt: 0 }, OR: [{ dateFin: periode }, { dateFin: null, creeLe: periode }] },
      select: { immeubleId: true, coutReel: true, immobilisation: true, numero: true, titre: true, entrepreneur: true, numeroFacture: true, dateFin: true, creeLe: true },
    }),
  ]);
  const viaBail = (x) => ({ ...x, immeubleId: x.bail.logement.immeubleId });
  const reps = reparations.map((r) => ({ ...r, date: r.dateFin || r.creeLe }));
  const etat = etatRevenusLocation({
    immeubles: immeubles.map((i) => ({ id: i.id, nom: i.nom, adresse: [i.adresse, i.ville, i.codePostal].filter(Boolean).join(", "), unites: i._count.logements })),
    charges: charges.map(viaBail), paiements: paiements.map(viaBail), depenses, reparations: reps,
  });

  // Détail pour le comptable : une ligne par bail (loyers et frais de l'année), par dépense et par réparation
  const nomImmeuble = Object.fromEntries(immeubles.map((i) => [i.id, i.nom]));
  const parBail = new Map();
  for (const c of charges) {
    const ligne = c.type === "LOYER" || c.montant < 0 ? "8141" : "8230";
    const cle = `${c.bail.id}:${ligne}`;
    if (!parBail.has(cle)) {
      parBail.set(cle, {
        immeuble: nomImmeuble[c.bail.logement.immeubleId], ligne, poste: ligne === "8141" ? "Loyers bruts" : "Autres revenus",
        date: "", description: `${nomLogement(c.bail.logement)} — ${c.bail.locataires.map((l) => l.nom).join(", ")} (bail du ${c.bail.dateDebut.toISOString().slice(0, 10)})`, payeA: "", reference: "", montant: 0,
      });
    }
    parBail.get(cle).montant += c.montant;
  }
  const libelleLigne = Object.fromEntries(LIGNES_T776.map((l) => [l.ligne, l.label]));
  const lignes = [
    ...[...parBail.values()].map((l) => ({ ...l, montant: Math.round(l.montant * 100) / 100 })),
    ...depenses.map((d) => {
      const ligne = ligneT776(d.categorie);
      return {
        immeuble: nomImmeuble[d.immeubleId], ligne: ligne || "Immobilisation", poste: ligne ? libelleLigne[ligne] : "Immobilisation (DPA)",
        date: d.date, description: d.description || libelle(CATEGORIES_DEPENSE, d.categorie), payeA: d.payeA || "", reference: d.reference || "", montant: d.montant,
      };
    }),
    ...reps.map((r) => ({
      immeuble: nomImmeuble[r.immeubleId], ligne: r.immobilisation ? "Immobilisation" : "8960", poste: r.immobilisation ? "Immobilisation (DPA)" : libelleLigne["8960"],
      date: r.date, description: `${r.numero} — ${r.titre}`, payeA: r.entrepreneur || "", reference: r.numeroFacture || "", montant: r.coutReel,
    })),
  ].sort((a, b) => a.immeuble.localeCompare(b.immeuble, "fr") || String(a.ligne).localeCompare(String(b.ligne)) || new Date(a.date || 0) - new Date(b.date || 0));
  return { annee, etat, lignes };
}

// CSV (point-virgule, Excel en français) du détail
export function csvImpot({ annee, lignes }) {
  const echapper = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const date = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const entete = ["Immeuble", "Ligne T776", "Poste", "Date", "Description", "Payé à", "Référence", "Montant"];
  const corps = lignes.map((l) => [l.immeuble, l.ligne, l.poste, date(l.date), l.description, l.payeA, l.reference, String(l.montant.toFixed(2)).replace(".", ",")].map(echapper).join(";"));
  return "﻿" + [`${echapper(`Revenus de location ${annee}`)}`, entete.join(";"), ...corps].join("\r\n");
}
