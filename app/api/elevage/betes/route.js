import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { creerAvecNumero } from "@/lib/numerotation";
import { sessionElevage, normaliserBete, prochainNumeroBete, verifierMere } from "@/lib/elevage";

// Nouvelle bête au troupeau (née ici ou achetée), avec sa première pesée
// facultative (poids à la naissance ou à l'arrivée)
export async function POST(request) {
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const body = await request.json();
  const fiche = normaliserBete(body);
  if (fiche.erreur) return NextResponse.json({ erreur: fiche.erreur }, { status: 400 });
  if (!fiche.data.sexe) return NextResponse.json({ erreur: "Choisis le sexe." }, { status: 400 });
  const mere = await verifierMere(fiche.data.mereId, null);
  if (mere.erreur) return NextResponse.json({ erreur: mere.erreur }, { status: 400 });

  let pesee = null;
  if (String(body.poidsInitial ?? "").trim()) {
    const poids = Number(String(body.poidsInitial).replace(",", "."));
    if (!Number.isFinite(poids) || poids <= 0 || poids > 3000) return NextResponse.json({ erreur: "Poids invalide (kg)." }, { status: 400 });
    const date = (fiche.data.origine === "ACHETEE" ? fiche.data.dateAcquisition : fiche.data.dateNaissance) || new Date();
    pesee = { date, poids: Math.round(poids * 10) / 10, note: fiche.data.origine === "ACHETEE" ? "À l'arrivée" : "À la naissance" };
  }

  const bete = await creerAvecNumero(prochainNumeroBete, (numero) => prisma.bete.create({
    data: { ...fiche.data, numero, creePar: session.nom, ...(pesee && { pesees: { create: pesee } }) },
  }));
  return NextResponse.json({ id: bete.id, numero: bete.numero });
}
