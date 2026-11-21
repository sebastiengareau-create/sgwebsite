import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesPaieActif } from "@/lib/accesPaie";
import { preparerReleve, versEnregistrement } from "@/lib/releveEmploi";

// Nouveau relevé d'emploi pour un employé ({ employeId }) : préparé à partir
// de ses paies, enregistré en brouillon → { id }
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await accesPaieActif(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { employeId } = await request.json().catch(() => ({}));
  if (typeof employeId !== "string") return NextResponse.json({ erreur: "Choisis l'employé." }, { status: 400 });
  const prepare = await preparerReleve(employeId);
  if (!prepare) return NextResponse.json({ erreur: "Employé introuvable." }, { status: 404 });
  const donnees = versEnregistrement(prepare);
  const releve = await prisma.releveEmploi.create({ data: { ...donnees, employeId, creePar: session.nom } });
  return NextResponse.json({ id: releve.id });
}
