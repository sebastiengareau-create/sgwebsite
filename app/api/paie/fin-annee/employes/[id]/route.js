import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesPaieActif } from "@/lib/accesPaie";

// Noms tels qu'ils vont sur les feuillets et code d'assurance dentaire d'un
// employé, depuis la page Fin d'année (accès Paie) : { prenom, nomFamille, codeDentaireT4 }
export async function PATCH(request, props) {
  const session = await obtenirSession();
  if (!(await accesPaieActif(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { id } = await props.params;
  const body = await request.json().catch(() => ({}));
  const data = {};
  for (const champ of ["prenom", "nomFamille"]) {
    if (body[champ] !== undefined) data[champ] = String(body[champ] || "").trim().slice(0, 60) || null;
  }
  if (body.codeDentaireT4 !== undefined) {
    const code = body.codeDentaireT4 === "" || body.codeDentaireT4 === null ? null : Number(body.codeDentaireT4);
    if (code !== null && !(Number.isInteger(code) && code >= 1 && code <= 5)) return NextResponse.json({ erreur: "Code d'assurance dentaire invalide (1 à 5)." }, { status: 400 });
    data.codeDentaireT4 = code;
  }
  const existe = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return NextResponse.json({ erreur: "Employé introuvable." }, { status: 404 });
  const maj = await prisma.user.update({ where: { id }, data, select: { prenom: true, nomFamille: true, codeDentaireT4: true } });
  return NextResponse.json(maj);
}
