import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirChecklistLot } from "@/lib/checklistLot";
import { posterPaie, moduleComptabiliteActif, verifierPeriodeModifiable } from "@/lib/comptabilite";

export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const lot = await prisma.lotPaie.findUnique({
    where: { id: params.id },
    include: { paies: { include: { employe: true } } },
  });
  if (!lot) return NextResponse.json({ erreur: "Lot introuvable." }, { status: 404 });
  if (lot.statut !== "BROUILLON") {
    return NextResponse.json({ erreur: "Ce lot est déjà comptabilisé." }, { status: 409 });
  }
  if (lot.paies.length === 0) {
    return NextResponse.json({ erreur: "Ce lot ne contient plus aucun employé." }, { status: 400 });
  }

  const checklist = await obtenirChecklistLot(lot.paies);
  if (!checklist.peutComptabiliser) {
    return NextResponse.json(
      { erreur: "Des éléments bloquants doivent être corrigés avant de traiter ce lot.", blocages: checklist.blocages.filter((b) => !b.ok) },
      { status: 409 }
    );
  }

  // Une paie n'est « versée » que si son écriture comptable existe : on
  // vérifie d'abord que la période accepte l'écriture (rien n'est touché
  // sinon), puis, paie par paie, l'écriture AVANT le statut. Si une paie
  // échoue, le lot reste en brouillon et se relance : celles déjà versées
  // sont sautées, jamais comptabilisées deux fois.
  const comptabiliteActive = await moduleComptabiliteActif();
  const aTraiter = lot.paies.filter((p) => p.statut === "BROUILLON");
  if (comptabiliteActive) {
    try {
      for (const date of new Set(aTraiter.map((p) => (p.dateVersement || new Date()).toISOString()))) {
        await verifierPeriodeModifiable(new Date(date), { nouvellePiece: true });
      }
    } catch (e) {
      if (!e.message.startsWith("PERIODE_LOCK:")) throw e;
      return NextResponse.json(
        { erreur: `Paie non traitée — la date de versement tombe dans une période comptable fermée. Rouvre la période, ou refais le lot avec une autre date de versement.` },
        { status: 423 }
      );
    }
  }

  const maintenant = new Date();
  const echecs = [];
  for (const paie of aTraiter) {
    try {
      // Écriture déjà là (statut resté en brouillon après une panne) : on ne la refait pas
      const dejaPostee = comptabiliteActive && (await prisma.ecritureComptable.findFirst({ where: { source: "PAIE", sourceId: paie.id }, select: { id: true } }));
      if (!dejaPostee) await posterPaie(paie, session.nom);
      // dateVersement reste celle choisie à la création du lot (voir
      // app/api/paie/lots/route.js) — ce n'est pas forcément la même date
      // que le moment du traitement
      await prisma.paie.update({ where: { id: paie.id }, data: { statut: "VERSEE" } });
    } catch (e) {
      console.error("Erreur comptabilisation paie (lot) :", e);
      echecs.push(paie.employe.nom);
    }
  }
  if (echecs.length > 0) {
    return NextResponse.json(
      { erreur: `La comptabilisation a échoué pour ${echecs.join(", ")} : ces paies restent en brouillon, les autres sont versées. Relance le traitement pour terminer.` },
      { status: 500 }
    );
  }

  const lotFinal = await prisma.lotPaie.update({
    where: { id: lot.id },
    data: { statut: "COMPTABILISEE", comptabiliseLe: maintenant },
  });

  return NextResponse.json({ lot: lotFinal, avertissements: [] });
}
