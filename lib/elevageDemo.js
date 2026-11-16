// Troupeau de démonstration (Administrateur → Troupeau de démonstration) :
// un petit troupeau wagyu complet pour présenter le module Élevage — bêtes de
// chaque catégorie, pesées, frais, soins (rappel en retard, délai de retrait),
// gestation, deux bêtes abattues avec leurs paquets et des ventes étalées sur
// neuf mois. Chargé seulement dans un troupeau vide ; chaque bête créée porte
// creePar = AUTEUR_DEMO, ce qui permet de tout retirer d'un coup sans toucher
// aux vraies bêtes ajoutées ensuite.

import { prisma } from "./prisma";
import { assurerCoupesParDefaut } from "./elevage";

export const AUTEUR_DEMO = "Démonstration";

// Prix de démonstration ($/kg : boutique, en ligne), mis seulement sur les
// coupes dont les deux prix sont encore à 0
const PRIX_DEMO = {
  "Entrecôte (faux-filet)": [150, 160], "Contre-filet": [140, 150], "Filet mignon": [180, 195], "Surlonge": [90, 95],
  "Bavette": [80, 85], "Hampe": [75, 80], "Rôti de palette": [45, 48], "Pointe de poitrine (brisket)": [50, 55],
  "Côtes courtes": [55, 60], "Rôti de ronde": [40, 44], "Jarret (osso buco)": [35, 38], "Bœuf haché": [28, 30],
  "Os à moelle / bouillon": [12, 14],
};

export async function etatTroupeauDemo() {
  const [betes, demo] = await Promise.all([prisma.bete.count(), prisma.bete.count({ where: { creePar: AUTEUR_DEMO } })]);
  return { betes, demo };
}

// Il y a n jours, à midi UTC (comme toutes les dates de l'élevage)
function ilYA(n) {
  const d = new Date(Date.now() - n * 86400000);
  return new Date(`${d.toISOString().slice(0, 10)}T12:00:00Z`);
}

// → { betes } ou { erreur }
export async function chargerTroupeauDemo() {
  if ((await prisma.bete.count()) > 0) return { erreur: "Le troupeau contient déjà des bêtes : le troupeau de démonstration ne se charge que dans un troupeau vide." };
  await assurerCoupesParDefaut();
  for (const coupe of await prisma.coupeViande.findMany()) {
    const prix = PRIX_DEMO[coupe.nom];
    if (prix && !coupe.prixBoutique && !coupe.prixEnLigne) await prisma.coupeViande.update({ where: { id: coupe.id }, data: { prixBoutique: prix[0], prixEnLigne: prix[1] } });
  }
  const coupes = await prisma.coupeViande.findMany({ where: { actif: true }, orderBy: [{ ordre: "asc" }, { nom: "asc" }] });

  const creer = ({ lieu = "Pâturage nord", pesees = [], frais = [], soins = [], ...fiche }) => prisma.bete.create({
    data: {
      genetique: "FULLBLOOD", pourcentageWagyu: 100, creePar: AUTEUR_DEMO, ...fiche,
      pesees: { create: pesees.map(([jours, poids, note]) => ({ date: ilYA(jours), poids, note })) },
      frais: { create: frais.map(([jours, categorie, montant, description]) => ({ date: ilYA(jours), categorie, montant, description })) },
      soins: { create: soins.map((s) => ({ ...s, creePar: AUTEUR_DEMO })) },
      deplacements: fiche.statut ? undefined : { create: [{ date: ilYA(300), type: "INTERNE", lieu, creePar: AUTEUR_DEMO }] },
    },
  });

  const taureau = await creer({
    numero: "BT-001", nom: "Kenji", sexe: "TAUREAU", identifiant: "124000312345671", dateNaissance: ilYA(1500),
    origine: "ACHETEE", dateAcquisition: ilYA(900), coutAcquisition: 12000, provenance: "Wagyu Québec", lieu: "Enclos des taureaux",
    pesees: [[400, 780], [200, 820], [30, 845]], frais: [[100, "ALIMENTATION", 900, "Foin et moulée"]],
  });
  const mere = await creer({
    numero: "BT-002", nom: "Sakura", sexe: "FEMELLE", identifiant: "124000312345672", dateNaissance: ilYA(1800),
    origine: "ACHETEE", dateAcquisition: ilYA(1400), coutAcquisition: 8500, provenance: "Wagyu Québec",
    pesees: [[300, 560], [40, 585]], frais: [[90, "VETERINAIRE", 220, "Échographie"]],
    soins: [{ date: ilYA(350), type: "VACCIN", produit: "Bovi-Shield", dose: "2 ml sous-cutané", rappelLe: ilYA(-12) }],
  });
  await prisma.saillie.create({ data: { femelleId: mere.id, date: ilYA(230), type: "NATURELLE", taureauId: taureau.id, statut: "GESTANTE", creePar: AUTEUR_DEMO } });
  const parents = { mereId: mere.id, pereId: taureau.id };
  await creer({
    numero: "BT-003", nom: "Yuki", sexe: "FEMELLE", genetique: "PUREBRED", pourcentageWagyu: 93, identifiant: "124000312345673", dateNaissance: ilYA(900), ...parents,
    pesees: [[900, 32, "naissance"], [600, 240], [300, 410], [60, 520]], frais: [[200, "ALIMENTATION", 1400]],
    soins: [{ date: ilYA(400), type: "VERMIFUGE", produit: "Ivomec", rappelLe: ilYA(20) }],
  });
  await creer({
    numero: "BT-004", sexe: "BOUVILLON", genetique: "CROISE", pourcentageWagyu: 50, identifiant: "124000312345674", dateNaissance: ilYA(600), mereId: mere.id, lieu: "Parc d'engraissement",
    pesees: [[600, 35, "naissance"], [400, 210, "sevrage"], [200, 380], [90, 470], [10, 482]],
    frais: [[300, "ALIMENTATION", 1100], [100, "ALIMENTATION", 950], [150, "VETERINAIRE", 180]],
    soins: [{ date: ilYA(8), type: "TRAITEMENT", produit: "Pénicilline", dose: "20 ml", retraitJours: 30 }],
  });
  await creer({
    numero: "BT-005", nom: "Hiro", sexe: "BOUVILLON", identifiant: "124000312345675", dateNaissance: ilYA(820), ...parents, lieu: "Parc d'engraissement",
    pesees: [[820, 34, "naissance"], [500, 300], [250, 500], [20, 690]], frais: [[400, "ALIMENTATION", 1800], [100, "ALIMENTATION", 1600]],
  });
  await creer({ numero: "BT-006", sexe: "FEMELLE", dateNaissance: ilYA(45), ...parents, pesees: [[45, 31, "naissance"]] });

  // Deux bêtes abattues : l'une il y a 2 mois (viande en bonne partie en
  // stock), l'autre il y a 9 mois (presque tout vendu, mois après mois)
  const abattre = async (fiche, jours, poidsVif, carcasse, bms, fraisAbattage, vendre) => {
    const bete = await creer({ ...fiche, statut: "ABATTUE", dateSortie: ilYA(jours) });
    const abattage = await prisma.abattage.create({
      data: {
        beteId: bete.id, date: ilYA(jours), abattoir: "Abattoir Saint-Alexandre", poidsVif, poidsCarcasse: carcasse, bms, fraisAbattage, creePar: AUTEUR_DEMO,
        lots: {
          create: coupes.map((c, i) => {
            const estimes = Math.floor((carcasse * c.rendement) / 100 / c.poidsPaquet + 1e-9);
            const recus = Math.max(0, estimes - (i % 3 === 0 ? 1 : 0)); // le boucher n'arrive jamais pile sur l'estimation
            return { coupeId: c.id, paquetsEstimes: estimes, nbPaquets: recus, poidsTotal: Math.round(recus * c.poidsPaquet * 100) / 100 };
          }).filter((l) => l.nbPaquets > 0),
        },
      },
      include: { lots: { include: { coupe: true } } },
    });
    const ventes = abattage.lots.flatMap((lot, i) => vendre(lot, i).filter((v) => v.nbPaquets > 0).map(({ ilYAJours, enLigne, rabais = 1, nbPaquets }) => {
      const poids = Math.round(nbPaquets * lot.coupe.poidsPaquet * 1000) / 1000;
      return {
        lotId: lot.id, date: ilYA(ilYAJours), canal: enLigne ? "EN_LIGNE" : "BOUTIQUE", nbPaquets, poids, creePar: AUTEUR_DEMO,
        montant: Math.round(poids * (enLigne ? lot.coupe.prixEnLigne : lot.coupe.prixBoutique) * rabais * 100) / 100,
      };
    }));
    await prisma.venteViande.createMany({ data: ventes });
  };
  await abattre(
    { numero: "BT-007", nom: "Taro", sexe: "BOUVILLON", identifiant: "124000312345677", dateNaissance: ilYA(1100), origine: "ACHETEE", dateAcquisition: ilYA(760), coutAcquisition: 3200, provenance: "Encan de Saint-Hyacinthe",
      pesees: [[700, 420], [300, 640], [62, 760]], frais: [[500, "ALIMENTATION", 2400], [200, "ALIMENTATION", 1900], [61, "TRANSPORT", 250]] },
    60, 760, 470, 9, 1450,
    // Une vente par coupe dans les 45 derniers jours : les coupes nobles partent vite, le reste moins
    (lot, i) => [{ ilYAJours: 44 - i * 3, enLigne: i % 2 === 1, nbPaquets: Math.floor(lot.nbPaquets * [0.85, 0.7, 0.9, 0.5, 0.6, 0.4, 0.2, 0.3, 0.35, 0.25, 0.15, 0.4, 0.1][i % 13]) }],
  );
  await abattre(
    { numero: "BT-008", nom: "Goro", sexe: "BOUVILLON", identifiant: "124000312345678", dateNaissance: ilYA(1300), origine: "ACHETEE", dateAcquisition: ilYA(900), coutAcquisition: 3000, provenance: "Encan de Saint-Hyacinthe",
      pesees: [[900, 400], [550, 610], [282, 740]], frais: [[700, "ALIMENTATION", 2300], [450, "ALIMENTATION", 1700], [281, "TRANSPORT", 250]] },
    280, 740, 455, 8, 1400,
    // Écoulée sur neuf mois, les derniers paquets au rabais
    (lot, i) => {
      let reste = Math.floor(lot.nbPaquets * [1, 1, 1, 0.9, 0.95, 0.9, 0.6, 0.7, 0.8, 0.5, 0.6, 0.97, 0.4][i % 13]);
      const liste = [];
      for (let m = 0; m < 9 && reste > 0; m++) {
        const nbPaquets = Math.min(reste, Math.ceil(lot.nbPaquets / (5 + ((i + m) % 4))));
        reste -= nbPaquets;
        liste.push({ ilYAJours: 270 - m * 29 - i, enLigne: (m + i) % 3 === 0, rabais: m > 6 ? 0.9 : 1, nbPaquets });
      }
      return liste;
    },
  );
  await prisma.bete.create({
    data: {
      numero: "BT-009", sexe: "BOUVILLON", genetique: "CROISE", pourcentageWagyu: 50, dateNaissance: ilYA(700), mereId: mere.id, statut: "VENDUE", dateSortie: ilYA(120), prixVente: 4200, creePar: AUTEUR_DEMO,
      pesees: { create: [{ date: ilYA(700), poids: 36 }, { date: ilYA(130), poids: 520 }] }, frais: { create: [{ date: ilYA(300), categorie: "ALIMENTATION", montant: 1300 }] },
    },
  });
  return { betes: await prisma.bete.count({ where: { creePar: AUTEUR_DEMO } }) };
}

// Retire les bêtes de démonstration avec tout ce qui leur est rattaché
// (pesées, frais, soins, saillies, abattages, paquets et ventes : en cascade).
// Les vraies bêtes, les coupes et leurs prix restent.
export async function retirerTroupeauDemo() {
  const { count } = await prisma.bete.deleteMany({ where: { creePar: AUTEUR_DEMO } });
  return { betes: count };
}
