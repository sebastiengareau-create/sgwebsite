import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const body = await request.json();
  const data = {};

  // Renommer un compte n'a aucune répercussion comptable (le numéro, pas le
  // nom, sert de clé partout) — mais réservé au développeur pour éviter que
  // le plan comptable dérive au fil du temps.
  if (typeof body.nom === "string" && body.nom.trim()) {
    let autorise = session.role === "DEVELOPPEUR";
    if (!autorise) {
      const moi = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
      autorise = moi?.estSuperAdmin || false;
    }
    if (!autorise) return NextResponse.json({ erreur: "Seul le développeur peut renommer un poste." }, { status: 403 });
    data.nom = body.nom.trim();
  }

  if (typeof body.actif === "boolean") {
    if (!(await aAccesSection(session, "comptabilite"))) {
      return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
    }
    data.actif = body.actif;
  }

  // Classification fixe/variable — utilisée pour le seuil de rentabilité de
  // la Vue d'ensemble, seulement pertinente pour un poste de DÉPENSE.
  if (body.typeCharge === "FIXE" || body.typeCharge === "VARIABLE") {
    if (!(await aAccesSection(session, "comptabilite"))) {
      return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
    }
    data.typeCharge = body.typeCharge;
  }

  const compte = await prisma.compte.update({ where: { id: params.id }, data });
  return NextResponse.json(compte);
}
