import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

// Conversation ouverte : ses textos reçus sont marqués lus ({ telephone })
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { telephone } = await request.json().catch(() => ({}));
  if (typeof telephone !== "string" || !telephone) return NextResponse.json({ erreur: "Numéro manquant." }, { status: 400 });
  const { count } = await prisma.texto.updateMany({ where: { telephone, direction: "ENTRANT", lu: false }, data: { lu: true } });
  return NextResponse.json({ lus: count });
}
