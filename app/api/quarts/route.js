import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesFeuillesTemps, periodeVerrouillee, journaliser, decrireQuart } from "@/lib/quarts";
import { TYPES_QUART } from "@/lib/quartsCalculs";
import { dateHeureLocaleVersUTC, dateQuebecStr } from "@/lib/temps";

const FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

// Quart ajouté à la main par le gérant (feuille de temps) — consigné au journal.
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await accesFeuillesTemps(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const { employeId, type = "TRAVAIL", debut, fin, raison } = await request.json();
  if (!TYPES_QUART.includes(type) || !FORMAT.test(debut || "") || !FORMAT.test(fin || "")) {
    return NextResponse.json({ erreur: "Type ou heures invalides." }, { status: 400 });
  }
  if (!String(raison || "").trim()) return NextResponse.json({ erreur: "Inscris la raison de l'ajout." }, { status: 400 });
  const employe = await prisma.user.findUnique({ where: { id: employeId || "" }, select: { id: true, nom: true } });
  if (!employe) return NextResponse.json({ erreur: "Employé introuvable." }, { status: 404 });
  const debutUTC = dateHeureLocaleVersUTC(debut);
  const finUTC = dateHeureLocaleVersUTC(fin);
  if (finUTC <= debutUTC) return NextResponse.json({ erreur: "La fin doit être après le début." }, { status: 400 });
  if (finUTC > new Date()) return NextResponse.json({ erreur: "La fin ne peut pas être dans le futur." }, { status: 400 });
  const jour = dateQuebecStr(debutUTC);
  if (await periodeVerrouillee(jour)) return NextResponse.json({ erreur: "Cette période est verrouillée." }, { status: 409 });

  const quart = await prisma.$transaction(async (tx) => {
    const cree = await tx.quart.create({ data: { employeId, type, debut: debutUTC, fin: finUTC, ajoutePar: session.nom } });
    await journaliser(session, { quartId: cree.id, employe, jour, action: "AJOUT", nouvelle: decrireQuart(cree), raison: String(raison).trim() }, tx);
    return cree;
  });
  return NextResponse.json({ ok: true, id: quart.id });
}
