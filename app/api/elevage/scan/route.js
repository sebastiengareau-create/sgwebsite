import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage } from "@/lib/elevage";

// Retrouve une bête par son numéro (BT-014) ou sa boucle d'oreille, tapés ou
// lus autrement que par le QR d'une étiquette. GET ?code=…
export async function GET(request) {
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const code = (new URL(request.url).searchParams.get("code") || "").trim();
  if (!code) return NextResponse.json({ erreur: "Code vide." }, { status: 400 });
  const bete = await prisma.bete.findFirst({
    where: { OR: [{ numero: { equals: code, mode: "insensitive" } }, { identifiant: { equals: code, mode: "insensitive" } }] },
    select: { id: true },
  });
  if (!bete) return NextResponse.json({ erreur: `Aucune bête ni étiquette ne correspond à « ${code.slice(0, 40)} ».` }, { status: 404 });
  return NextResponse.json({ beteId: bete.id });
}
