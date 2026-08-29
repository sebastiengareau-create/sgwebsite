import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";

const ROLES_CONFIGURABLES = ["SECRETAIRE", "MECANICIEN"];

export async function PATCH(request) {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  let autorise = session.role === "DEVELOPPEUR";
  if (!autorise) {
    const moi = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
    autorise = moi?.estSuperAdmin || false;
  }
  if (!autorise) return NextResponse.json({ erreur: "Seul le super-administrateur peut modifier ceci." }, { status: 403 });

  const { role, sections } = await request.json();
  if (!ROLES_CONFIGURABLES.includes(role)) {
    return NextResponse.json({ erreur: "Rôle invalide." }, { status: 400 });
  }

  const valeur = Array.isArray(sections) ? sections.join(",") : "";
  await prisma.parametre.upsert({
    where: { cle: `role_defaut_${role}` },
    update: { valeur },
    create: { cle: `role_defaut_${role}`, valeur },
  });

  return NextResponse.json({ ok: true });
}
