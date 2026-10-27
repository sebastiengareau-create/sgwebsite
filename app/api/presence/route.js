import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { EN_LIGNE_MINUTES } from "@/lib/presence";

// Qui est en ligne — demandé seulement quand on touche le bouton (voir
// components/BoutonEnLigne.js) ; réservé au développeur pour l'instant
export async function GET() {
  const session = await obtenirSession();
  if (session?.role !== "DEVELOPPEUR") return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const depuis = new Date(Date.now() - EN_LIGNE_MINUTES * 60 * 1000);
  const enLigne = await prisma.user.findMany({
    where: { actif: true, derniereActivite: { gte: depuis } },
    select: { id: true, nom: true, derniereActivite: true },
    orderBy: { derniereActivite: "desc" },
  });
  return NextResponse.json({
    enLigne: enLigne.map((u) => ({ id: u.id, nom: u.nom, minutes: Math.max(0, Math.round((Date.now() - u.derniereActivite) / 60000)) })),
  });
}
