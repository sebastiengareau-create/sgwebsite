import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { dateRapprochement, soldeReleve, soldeLivres } = await request.json();
  const ecart = Number(soldeReleve) - Number(soldeLivres);

  const rapprochement = await prisma.rapprochementBancaire.create({
    data: {
      dateRapprochement: new Date(dateRapprochement),
      soldeReleve: Number(soldeReleve),
      soldeLivres: Number(soldeLivres),
      ecart,
    },
  });
  return NextResponse.json(rapprochement);
}

export async function GET() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const historique = await prisma.rapprochementBancaire.findMany({ orderBy: { dateRapprochement: "desc" }, take: 12 });
  return NextResponse.json(historique);
}
