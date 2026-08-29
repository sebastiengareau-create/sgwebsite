import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";

export async function POST() {
  const session = await obtenirSession();
  if (!session || !estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  await prisma.parametre.deleteMany({
    where: { cle: { in: ["qb_realm_id", "qb_access_token", "qb_refresh_token", "qb_expire_le"] } },
  });

  return NextResponse.json({ ok: true });
}
