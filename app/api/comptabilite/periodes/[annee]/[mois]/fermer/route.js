import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { limitesMoisQuebec } from "@/lib/temps";
import { calculerResumeFermeture } from "@/lib/rapportsComptables";
import { obtenirChecklist } from "@/lib/checklistFermeture";

export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const annee = Number(params.annee);
  const mois = Number(params.mois);

  const existante = await prisma.periodeComptable.findUnique({ where: { annee_mois: { annee, mois } } });
  const statutAvant = existante?.statut || "OUVERTE";
  if (statutAvant === "FERMEE") {
    return NextResponse.json({ erreur: "Cette période est déjà fermée." }, { status: 409 });
  }

  const checklist = await obtenirChecklist(annee, mois);
  if (!checklist.peutFermer) {
    return NextResponse.json(
      { erreur: "Des éléments bloquants doivent être corrigés avant de fermer cette période.", blocages: checklist.blocages.filter((b) => !b.ok) },
      { status: 409 }
    );
  }

  const { debut, fin } = limitesMoisQuebec(annee, mois);
  const resume = await calculerResumeFermeture({ debut, fin });

  const periode = await prisma.$transaction(async (tx) => {
    const p = await tx.periodeComptable.upsert({
      where: { annee_mois: { annee, mois } },
      update: { statut: "FERMEE", statutParNom: session.nom, statutLe: new Date() },
      create: { annee, mois, dateDebut: debut, dateFin: fin, statut: "FERMEE", statutParNom: session.nom, statutLe: new Date() },
    });
    await tx.fermeturePeriodeHistorique.create({
      data: { periodeId: p.id, action: "FERMETURE", statutAvant, statutApres: "FERMEE", parNom: session.nom, resumeJson: JSON.stringify(resume) },
    });
    return p;
  });

  return NextResponse.json({ ...periode, resume });
}
