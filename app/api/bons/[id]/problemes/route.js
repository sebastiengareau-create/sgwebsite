import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { description } = await request.json();
  if (!description?.trim()) {
    return NextResponse.json({ erreur: "Description requise." }, { status: 400 });
  }

  const probleme = await prisma.probleme.create({
    data: { description: description.trim(), bonId: params.id },
  });
  return NextResponse.json(probleme);
}
