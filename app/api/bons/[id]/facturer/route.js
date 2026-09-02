import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { posterFactureEmise } from "@/lib/comptabilite";

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}

export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const bon = await prisma.bonTravail.findUnique({
    where: { id: params.id },
    include: {
      facture: true,
      problemes: { include: { pieces: { include: { piece: true } }, entreesTemps: true } },
    },
  });
  if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });
  if (bon.facture) return NextResponse.json({ erreur: "Ce bon a déjà une facture." }, { status: 409 });

  const parametres = await prisma.parametre.findMany();
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tauxHoraireClient = bon.tauxHoraireOverride ?? Number(dict.taux_horaire_client || 195);
  const tpsTaux = Number(dict.tps_taux || 5);
  const tvqTaux = Number(dict.tvq_taux || 9.975);

  // Main-d'œuvre : facturée sur les heures poinçonnées, seulement pour les
  // tâches restées sur le poste par défaut. Les autres postes de revenu
  // (remorquage, alignement, entreposage, autre) se facturent sur la ligne
  // manuelle saisie sur la tâche — le poinçon reste actif pour la paie, mais
  // ne détermine plus le montant facturé au client pour ces tâches-là.
  const problemesMainOeuvre = bon.problemes.filter((pr) => (pr.categorieRevenu || "MAIN_OEUVRE") === "MAIN_OEUVRE");
  const entreesTempsMainOeuvre = problemesMainOeuvre.flatMap((pr) => pr.entreesTemps);

  const totalPieces = bon.problemes.reduce(
    (s, pr) => s + pr.pieces.reduce((s2, l) => s2 + l.qte * l.prix, 0),
    0
  );
  const heuresFacturees = entreesTempsMainOeuvre
    .filter((t) => t.fin)
    .reduce((s, t) => s + dureeHeures(t.debut, t.fin), 0);
  const totalMainOeuvre = heuresFacturees * tauxHoraireClient;
  const totalAutresRevenus = bon.problemes
    .filter((pr) => (pr.categorieRevenu || "MAIN_OEUVRE") !== "MAIN_OEUVRE")
    .reduce((s, pr) => s + (pr.facturePrixUnitaire || 0) * (pr.factureQte || 1), 0);
  const sousTotalAvantEscompte = totalPieces + totalMainOeuvre + totalAutresRevenus;
  const escompte = Math.min(bon.escompteMontant || 0, sousTotalAvantEscompte); // jamais négatif
  const totalFacture = sousTotalAvantEscompte - escompte;

  // TPS et TVQ se calculent toutes deux sur le même montant de base
  // (règle en vigueur au Québec depuis 2013 — pas de taxe en cascade)
  const tpsMontant = totalFacture * (tpsTaux / 100);
  const tvqMontant = totalFacture * (tvqTaux / 100);
  const totalAvecTaxes = totalFacture + tpsMontant + tvqMontant;

  const derniereFacture = await prisma.facture.findFirst({ orderBy: { numero: "desc" } });
  let prochainNum = 1;
  if (derniereFacture) {
    const partieNum = parseInt(derniereFacture.numero.split("-")[1], 10);
    if (!isNaN(partieNum)) prochainNum = partieNum + 1;
  }
  const numero = `FAC-${String(1000 + prochainNum).slice(1)}`;

  const facture = await prisma.$transaction(async (tx) => {
    const f = await tx.facture.create({
      data: {
        bonId: bon.id,
        numero,
        totalPieces,
        totalMainOeuvre,
        totalAutresRevenus,
        escompteApplique: escompte,
        totalFacture,
        tauxHoraireUtilise: tauxHoraireClient,
        heuresFacturees,
        tpsMontant,
        tvqMontant,
        totalAvecTaxes,
      },
    });
    // Émettre la facture marque automatiquement le bon comme terminé
    await tx.bonTravail.update({ where: { id: bon.id }, data: { statut: "TERMINE" } });
    return f;
  });

  // Génère l'écriture comptable correspondante — ne fait jamais échouer
  // l'émission de la facture elle-même si la comptabilité a un problème
  // (y compris si la période comptable du jour est fermée)
  let avertissementComptable = null;
  try {
    await posterFactureEmise(bon, facture, session.nom);
  } catch (e) {
    if (e.message.startsWith("PERIODE_LOCK:")) {
      avertissementComptable = e.message.replace("PERIODE_LOCK:", "").split("\n")[0];
    } else {
      console.error("Erreur comptabilisation facture émise :", e);
    }
  }

  return NextResponse.json({ ...facture, avertissementComptable });
}
