// Checklist de traitement d'un lot de paie — même esprit que
// lib/checklistFermeture.js : seuls les items bloquants comptent dans le
// pourcentage, les items informatifs sont affichés à titre indicatif.
const { prisma } = require("./prisma");
const { tauxPourAnnee, anneeQuebec, lireTauxEmployeur, CLE_CONGE_PAQUES } = require("./paie");
const { joursFeriesEntre } = require("./joursFeries");

const HEURES_MAX_RAISONNABLE = 90; // sur une période typique de 2 semaines
const HEURES_MIN_RAISONNABLE = 1;
const ECART_SIGNIFICATIF = 0.4; // 40 %

// `paies` doit inclure la relation `employe` (include: { employe: true }).
async function obtenirChecklistLot(paies) {
  const blocages = [];
  const informatifs = [];

  const negatives = paies.filter((p) => p.salaireNet < 0);
  blocages.push({
    cle: "salaire_net_negatif",
    label: "Aucun salaire net négatif",
    ok: negatives.length === 0,
    detail: negatives.length > 0 ? `${negatives.length} employé(s) avec un salaire net négatif` : null,
  });

  const sansRemuneration = paies.filter((p) => p.salaireBrut <= 0);
  blocages.push({
    cle: "sans_remuneration",
    label: "Tous les employés ont une rémunération",
    ok: sansRemuneration.length === 0,
    detail: sansRemuneration.length > 0 ? `${sansRemuneration.length} employé(s) sans salaire brut (retire-les du lot si ce n'est pas voulu)` : null,
  });

  if (paies.length > 0 && paies[0].typePaie === "VACANCES") {
    const insuffisantes = [];
    for (const p of paies) {
      const accumule = await prisma.paie.aggregate({ where: { employeId: p.employeId, statut: "VERSEE", typePaie: "REGULIERE" }, _sum: { vacancesAccumulees: true } });
      const dejaVerse = await prisma.paie.aggregate({ where: { employeId: p.employeId, statut: "VERSEE", typePaie: "VACANCES", id: { not: p.id } }, _sum: { salaireBrut: true } });
      const solde = Math.max(0, (accumule._sum.vacancesAccumulees || 0) - (dejaVerse._sum.salaireBrut || 0));
      if (p.salaireBrut > solde + 0.01) insuffisantes.push(p);
    }
    blocages.push({
      cle: "vacances_insuffisantes",
      label: "Montants de vacances couverts par le solde accumulé",
      ok: insuffisantes.length === 0,
      detail: insuffisantes.length > 0 ? `${insuffisantes.length} employé(s) dont le montant dépasse le solde de vacances disponible` : null,
    });
  }

  const heuresInhabituelles = paies.filter((p) => p.heuresTravaillees > 0 && (p.heuresTravaillees > HEURES_MAX_RAISONNABLE || p.heuresTravaillees < HEURES_MIN_RAISONNABLE));
  if (heuresInhabituelles.length > 0) {
    informatifs.push({ cle: "heures_inhabituelles", label: "Heures inhabituelles", valeur: heuresInhabituelles.map((p) => p.employe.nom).join(", ") });
  }

  // Taux horaire global des Paramètres (le coût horaire du garage) utilisé
  // comme salaire, faute de taux dans la fiche — à confirmer d'un coup d'œil
  const auTauxGlobal = paies.filter((p) => p.typePaie !== "VACANCES" && p.employe.typeRemuneration !== "SALAIRE" && !p.employe.tauxHoraireEmploye);
  if (auTauxGlobal.length > 0) {
    const parametreTaux = await prisma.parametre.findUnique({ where: { cle: "cout_horaire_mecanicien" } });
    informatifs.push({
      cle: "taux_global",
      label: `Payé au taux global des Paramètres (${Number(parametreTaux?.valeur) || 0} $/h), sans taux dans la fiche`,
      valeur: auTauxGlobal.map((p) => p.employe.nom).join(", "),
    });
  }

  // Année de versement sans table de taux (lib/paie.js, TAUX_PAR_ANNEE)
  for (const annee of new Set(paies.map((p) => anneeQuebec(p.dateVersement || p.periodeFin)))) {
    const { tauxAJour, anneeTaux } = tauxPourAnnee(annee);
    if (!tauxAJour) {
      informatifs.push({ cle: `taux_annee_${annee}`, label: `Taux de ${annee} pas encore dans le logiciel`, valeur: `calculé avec ceux de ${anneeTaux} — valide les retenues avec WebRAS` });
    }
  }

  // Jours fériés de la période : l'indemnité est calculée pour les employés
  // à l'heure, mais le droit au congé reste à confirmer (l'employé ne doit pas
  // s'être absenté sans raison la veille ou le lendemain de son congé)
  if (paies.length > 0 && paies[0].typePaie !== "VACANCES") {
    const congePaques = await prisma.parametre.findUnique({ where: { cle: CLE_CONGE_PAQUES } });
    const jour = (d) => new Date(d).toISOString().slice(0, 10);
    const feries = joursFeriesEntre(jour(paies[0].periodeDebut), jour(paies[0].periodeFin), { paques: congePaques?.valeur === "LUNDI" ? "LUNDI" : "VENDREDI" });
    if (feries.length > 0) {
      informatifs.push({
        cle: "jours_feries",
        label: `Jour férié dans la période : ${feries.map((f) => f.nom).join(", ")}`,
        valeur: "indemnité calculée pour les employés à l'heure — à confirmer",
      });
    }
  }

  // Taux de la CNESST propre à l'employeur : sans lui, la prime n'est pas calculée
  if ((await lireTauxEmployeur()).cnesst === null) {
    informatifs.push({ cle: "cnesst_non_regle", label: "Taux de la CNESST non réglé", valeur: "prime non calculée — page Paie, Cotisations de l'employeur" });
  }

  const ecartsImportants = [];
  for (const p of paies) {
    const derniere = await prisma.paie.findFirst({
      where: { employeId: p.employeId, statut: "VERSEE", typePaie: p.typePaie, id: { not: p.id } },
      orderBy: { periodeFin: "desc" },
    });
    if (derniere && derniere.salaireNet > 0) {
      const ecart = Math.abs(p.salaireNet - derniere.salaireNet) / derniere.salaireNet;
      if (ecart > ECART_SIGNIFICATIF) ecartsImportants.push(p.employe.nom);
    }
  }
  if (ecartsImportants.length > 0) {
    informatifs.push({ cle: "ecart_important", label: "Écart de plus de 40 % vs la paie précédente", valeur: ecartsImportants.join(", ") });
  }

  const bloquantsReussis = blocages.filter((b) => b.ok).length;
  const pourcentage = blocages.length === 0 ? 100 : Math.round((bloquantsReussis / blocages.length) * 100);

  return { blocages, informatifs, pourcentage, peutComptabiliser: blocages.every((b) => b.ok) };
}

module.exports = { obtenirChecklistLot };
