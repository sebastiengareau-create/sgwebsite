import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirChecklistLot } from "@/lib/checklistLot";
import { posterPaie } from "@/lib/comptabilite";

export async function POST(request, { params }) {
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

  const avertissements = [];
  const maintenant = new Date();

  for (const paie of lot.paies) {
    const paieVersee = await prisma.paie.update({
      where: { id: paie.id },
      data: { statut: "VERSEE", dateVersement: maintenant },
    });
    try {
      await posterPaie(paieVersee, session.nom);
    } catch (e) {
      if (e.message.startsWith("PERIODE_LOCK:")) {
        avertissements.push(`${paie.employe.nom} : ${e.message.replace("PERIODE_LOCK:", "").split("\n")[0]}`);
      } else {
        console.error("Erreur comptabilisation paie (lot) :", e);
        avertissements.push(`${paie.employe.nom} : comptabilisation échouée`);
      }
    }
  }

  const lotFinal = await prisma.lotPaie.update({
    where: { id: lot.id },
    data: { statut: "COMPTABILISEE", comptabiliseLe: maintenant },
  });

  return NextResponse.json({ lot: lotFinal, avertissements });
}
