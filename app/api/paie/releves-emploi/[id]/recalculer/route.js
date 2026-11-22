import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesPaieActif } from "@/lib/accesPaie";
import { preparerReleve } from "@/lib/releveEmploi";

// Recalcule à partir des paies, pour le dernier jour payé donné
// ({ dernierJourPaye }) : B12, heures, gains par période et vacances au
// départ. Rien n'est enregistré : le formulaire reprend les valeurs.
export async function POST(request, props) {
  const session = await obtenirSession();
  if (!(await accesPaieActif(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { id } = await props.params;
  const releve = await prisma.releveEmploi.findUnique({ where: { id }, select: { employeId: true } });
  if (!releve) return NextResponse.json({ erreur: "Relevé introuvable." }, { status: 404 });
  const { dernierJourPaye } = await request.json().catch(() => ({}));
  const prepare = await preparerReleve(releve.employeId, { dernierJourPaye: /^\d{4}-\d{2}-\d{2}$/.test(dernierJourPaye || "") ? dernierJourPaye : undefined, exclureId: id });
  const { premierJour, finDernierePeriode, typePeriode, heuresAssurables, gainsParPeriode, vacances } = prepare;
  return NextResponse.json({ premierJour, finDernierePeriode, typePeriode, heuresAssurables, gainsParPeriode, vacances });
}
