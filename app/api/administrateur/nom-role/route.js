import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";

const ROLES_RENOMMABLES = ["GERANT", "SECRETAIRE", "MECANICIEN"];

export async function PATCH(request) {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  let autorise = session.role === "DEVELOPPEUR";
  if (!autorise) {
    const moi = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
    autorise = moi?.estSuperAdmin || false;
  }
  if (!autorise) return NextResponse.json({ erreur: "Seul le super-administrateur peut modifier ceci." }, { status: 403 });

  const { role, nom } = await request.json();
  if (!ROLES_RENOMMABLES.includes(role)) {
    return NextResponse.json({ erreur: "Rôle invalide." }, { status: 400 });
  }
  if (!nom || !nom.trim()) {
    return NextResponse.json({ erreur: "Le nom ne peut pas être vide." }, { status: 400 });
  }

  await prisma.parametre.upsert({
    where: { cle: `nom_role_${role}` },
    update: { valeur: nom.trim() },
    create: { cle: `nom_role_${role}`, valeur: nom.trim() },
  });

  return NextResponse.json({ ok: true });
}
