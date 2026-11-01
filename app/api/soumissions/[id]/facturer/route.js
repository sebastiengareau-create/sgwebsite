import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prochainNumeroBon, prochainNumeroFacture, creerAvecNumero } from "@/lib/numerotation";
import { CLIENT } from "@/lib/client";
import { clientEtVehiculeDuBon, totauxSoumission, sortDuStock, manqueStockSoumission, sortirPieceSoumissionDuStock, messagePieceSoumission } from "@/lib/soumissions";
import { posterFactureEmise, COMPTE_MAIN_OEUVRE } from "@/lib/comptabilite";

// Profil soumissionFacturerDirect : la soumission se facture telle quelle —
// exactement ce qui a été entré (heures estimées × taux horaire, pièces
// estimées à leur prix), plus les taxes. Rien d'autre ne s'ajoute
// (fournitures d'atelier, escompte…). La facture a besoin d'un bon : un bon
// est créé, déjà terminé, dont les tâches portent ces montants en lignes de
// facturation fixes (main-d'œuvre au compte 4000, pièces au compte 4010) —
// pas de poinçon. Les pièces choisies dans l'inventaire, elles, sortent du
// stock maintenant (et seulement maintenant) : leur ligne porte la pièce du
// bon, au prix de la soumission, pour le coût des pièces vendues.
import { COMPTE_PIECES_SOUMISSION as COMPTE_PIECES } from "@/lib/piecesSoumission";

export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (!CLIENT.soumissionFacturerDirect) {
    return NextResponse.json({ erreur: "Les soumissions s'acceptent pour créer un bon." }, { status: 409 });
  }

  const soumission = await prisma.soumission.findUnique({
    where: { id: params.id },
    include: { taches: { include: { pieces: true } }, vehicule: true },
  });
  if (!soumission) return NextResponse.json({ erreur: "Soumission introuvable." }, { status: 404 });
  if (soumission.bonId) {
    return NextResponse.json({ erreur: "Cette soumission a déjà un bon (ou une facture). Remets-la en attente d'abord." }, { status: 409 });
  }

  const parametres = await prisma.parametre.findMany();
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tauxHoraire = Number(dict.taux_horaire_client || 195);
  const tpsTaux = Number(dict.tps_taux || 5);
  const tvqTaux = Number(dict.tvq_taux || 9.975);

  const totaux = totauxSoumission(soumission, tauxHoraire);
  const totalFacture = totaux.mainOeuvre + totaux.pieces;
  const tpsMontant = totalFacture * (tpsTaux / 100);
  const tvqMontant = totalFacture * (tvqTaux / 100);

  // Vérifié avant de créer client, véhicule, bon ou facture
  const manque = await manqueStockSoumission(soumission);
  if (manque) return NextResponse.json({ erreur: manque }, { status: 409 });

  const { clientId, vehiculeId, kilometrage, clientNomAffiche } = await clientEtVehiculeDuBon(soumission);

  // Une tâche par tâche de la soumission (ses heures), puis une par pièce.
  // Pièce de l'inventaire : la ligne ne facture rien elle-même (0 × 0) — son
  // montant vient de la pièce du bon qu'elle porte (pieceEstimee)
  const problemes = [
    ...soumission.taches.map((t) => ({
      description: t.description,
      categorieRevenu: COMPTE_MAIN_OEUVRE,
      factureDescription: "Main-d'œuvre",
      facturePrixUnitaire: tauxHoraire,
      factureQte: t.tempsEstime || 0,
    })),
    ...soumission.taches.flatMap((t) => t.pieces.map((p) => ({
      description: p.nom,
      categorieRevenu: COMPTE_PIECES,
      factureDescription: "Pièce",
      facturePrixUnitaire: sortDuStock(p) ? 0 : p.prixEstime,
      factureQte: sortDuStock(p) ? 0 : p.qte,
      pieceEstimee: sortDuStock(p) ? p : null,
    }))),
  ];

  const bon = await creerAvecNumero(prochainNumeroBon, (numero) => prisma.bonTravail.create({
    data: { numero, clientId, vehiculeId, kilometrage, clientNomAffiche, statut: "TERMINE", tauxHoraireOverride: tauxHoraire },
    include: { client: true },
  }));
  try {
    await prisma.$transaction(async (tx) => {
      // Une à une, pour garder l'ordre des tâches sur la facture
      for (const { pieceEstimee, ...pr } of problemes) {
        const probleme = await tx.probleme.create({ data: { ...pr, bonId: bon.id } });
        if (pieceEstimee) await sortirPieceSoumissionDuStock(tx, { probleme: { ...probleme, bon }, pieceEstimee, creePar: session.nom });
      }
    }, { timeout: 30000 });
  } catch (e) {
    await prisma.bonTravail.delete({ where: { id: bon.id } });
    const message = messagePieceSoumission(e);
    if (message) return NextResponse.json({ erreur: message }, { status: 409 });
    throw e;
  }

  const facture = await creerAvecNumero(prochainNumeroFacture, (numero) => prisma.facture.create({
    data: {
      bonId: bon.id,
      numero,
      totalPieces: totaux.pieces,
      totalMainOeuvre: totaux.mainOeuvre,
      totalAutresRevenus: 0,
      totalMaterielAtelier: 0,
      escompteApplique: 0,
      totalFacture,
      tauxHoraireUtilise: tauxHoraire,
      heuresFacturees: totaux.heures,
      tpsMontant,
      tvqMontant,
      totalAvecTaxes: totalFacture + tpsMontant + tvqMontant,
    },
  }));

  await prisma.soumission.update({
    where: { id: soumission.id },
    data: { statut: "FACTUREE", bonId: bon.id },
  });

  // Écriture comptable — ne fait jamais échouer la facture
  let avertissementComptable = null;
  try {
    const bonComplet = await prisma.bonTravail.findUnique({
      where: { id: bon.id },
      include: { problemes: { include: { pieces: { include: { piece: true } }, entreesTemps: true } } },
    });
    await posterFactureEmise(bonComplet, facture, session.nom);
  } catch (e) {
    if (e.message.startsWith("PERIODE_LOCK:")) {
      avertissementComptable = e.message.replace("PERIODE_LOCK:", "").split("\n")[0];
    } else {
      console.error("Erreur comptabilisation facture de soumission :", e);
    }
  }

  return NextResponse.json({ bonId: bon.id, bonNumero: bon.numero, factureNumero: facture.numero, avertissementComptable });
}
