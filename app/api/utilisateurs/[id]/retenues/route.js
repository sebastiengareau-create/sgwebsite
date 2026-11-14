import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { TYPES_RETENUE } from "@/lib/retenuesPaie";

// Retenues propres à un employé (REER, assurance collective…) — voir
// lib/retenuesPaie.js. Réservé à qui a la section Paie.
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const employe = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!employe) return NextResponse.json({ erreur: "Employé introuvable." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const libelle = String(body.libelle || "").trim().slice(0, 60);
  const montant = Number(body.montant);
  if (!libelle) return NextResponse.json({ erreur: "Donne un nom à la retenue (ex. REER, Assurance collective)." }, { status: 400 });
  if (!TYPES_RETENUE[body.type]) return NextResponse.json({ erreur: "Type de retenue invalide." }, { status: 400 });
  if (!(montant > 0) || montant > 100000) return NextResponse.json({ erreur: "Montant par paie invalide." }, { status: 400 });

  const retenue = await prisma.retenueEmploye.create({
    data: { employeId: employe.id, libelle, type: body.type, montant: Math.round(montant * 100) / 100 },
  });
  return NextResponse.json(retenue);
}
