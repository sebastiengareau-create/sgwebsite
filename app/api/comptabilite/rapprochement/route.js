import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { limitesJourQuebec } from "@/lib/temps";
import { sensCompte, montantLigne, obtenirSoldeOuverture, obtenirLignesNonVerrouillees } from "@/lib/rapprochement";

// Enregistre une conciliation : tout est recalculé ici (pas de confiance aux
// soldes envoyés par le navigateur), refusé s'il reste un écart, puis les
// lignes pointées sont verrouillées dans la même transaction.
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { compteTresorerieId, dateRapprochement, soldeReleve } = await request.json();
  if (!compteTresorerieId) return NextResponse.json({ erreur: "Choisis un compte." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRapprochement || "")) return NextResponse.json({ erreur: "Date du relevé invalide." }, { status: 400 });
  const releve = Number(soldeReleve);
  if (soldeReleve === "" || soldeReleve == null || !Number.isFinite(releve)) {
    return NextResponse.json({ erreur: "Solde du relevé invalide." }, { status: 400 });
  }

  const compte = await prisma.compteTresorerie.findUnique({ where: { id: compteTresorerieId } });
  if (!compte) return NextResponse.json({ erreur: "Compte introuvable." }, { status: 404 });

  const sens = sensCompte(compte.categorie);
  const { fin } = limitesJourQuebec(dateRapprochement);
  const precedent = await prisma.rapprochementBancaire.findFirst({
    where: { compteTresorerieId, dateRapprochement: { gte: fin } },
  });
  if (precedent) {
    return NextResponse.json({ erreur: "Ce compte a déjà une conciliation à cette date ou après — annule-la d'abord ou choisis une date plus récente." }, { status: 400 });
  }
  const [soldeOuverture, lignes] = await Promise.all([
    obtenirSoldeOuverture(compte.compteId, sens),
    obtenirLignesNonVerrouillees(compte.compteId),
  ]);
  const lignesPeriode = lignes.filter((l) => new Date(l.ecriture.date) <= fin);
  const lignesPointees = lignesPeriode.filter((l) => l.rapproche);

  const soldePointe = soldeOuverture + lignesPointees.reduce((s, l) => s + montantLigne(l, sens), 0);
  const soldeLivres = soldeOuverture + lignesPeriode.reduce((s, l) => s + montantLigne(l, sens), 0);
  const ecart = releve - soldePointe;
  if (Math.abs(ecart) >= 0.01) {
    return NextResponse.json({ erreur: `Il reste un écart de ${ecart.toFixed(2)} $ entre le relevé et les lignes pointées.` }, { status: 400 });
  }

  const rapprochement = await prisma.$transaction(async (tx) => {
    const cree = await tx.rapprochementBancaire.create({
      data: {
        compteTresorerieId,
        dateRapprochement: fin,
        soldeReleve: releve,
        soldeLivres,
        ecart: 0,
      },
    });
    await tx.ligneEcriture.updateMany({
      where: { id: { in: lignesPointees.map((l) => l.id) }, rapprochementId: null },
      data: { rapprochementId: cree.id },
    });
    return cree;
  });
  return NextResponse.json(rapprochement);
}

export async function GET(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const compteTresorerieId = new URL(request.url).searchParams.get("compteTresorerieId");
  const historique = await prisma.rapprochementBancaire.findMany({
    where: compteTresorerieId ? { compteTresorerieId } : {},
    orderBy: { dateRapprochement: "desc" },
    take: 12,
  });
  return NextResponse.json(historique);
}
