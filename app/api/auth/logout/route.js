import { NextResponse } from "next/server";
import { COOKIE_NAME, obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  // Déconnecté : n'apparaît plus « en ligne » (voir lib/presence.js)
  const session = await obtenirSession();
  if (session?.id && session.role !== "DEVELOPPEUR") {
    await prisma.user.update({ where: { id: session.id }, data: { derniereActivite: null } }).catch(() => {});
  }
  const reponse = NextResponse.json({ ok: true });
  reponse.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return reponse;
}
