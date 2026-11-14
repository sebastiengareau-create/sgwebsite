import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesFeuillesTemps, periodeVerrouillee, journaliser, decrireQuart } from "@/lib/quarts";
import { dateHeureLocaleVersUTC, dateQuebecStr } from "@/lib/temps";

const FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

async function preparer(props) {
  const session = await obtenirSession();
  if (!(await accesFeuillesTemps(session))) return { reponse: NextResponse.json({ erreur: "Accès refusé." }, { status: 403 }) };
  const { id } = await props.params;
  const quart = await prisma.quart.findUnique({ where: { id }, include: { employe: { select: { id: true, nom: true } } } });
  if (!quart) return { reponse: NextResponse.json({ erreur: "Quart introuvable." }, { status: 404 }) };
  if (await periodeVerrouillee(dateQuebecStr(quart.debut))) {
    return { reponse: NextResponse.json({ erreur: "Cette période est verrouillée." }, { status: 409 }) };
  }
  return { session, quart };
}

// Correction d'un quart par le gérant : heures de début et de fin. Chaque
// correction est consignée (qui, quand, ancienne et nouvelle valeur, raison) ;
// les heures d'origine du pointage restent sur le quart.
export async function PATCH(request, props) {
  const { reponse, session, quart } = await preparer(props);
  if (reponse) return reponse;

  const { debut, fin, raison } = await request.json();
  if (!FORMAT.test(debut || "") || !FORMAT.test(fin || "")) return NextResponse.json({ erreur: "Heures invalides." }, { status: 400 });
  if (!String(raison || "").trim()) return NextResponse.json({ erreur: "Inscris la raison de la correction." }, { status: 400 });
  const debutUTC = dateHeureLocaleVersUTC(debut);
  const finUTC = dateHeureLocaleVersUTC(fin);
  if (finUTC <= debutUTC) return NextResponse.json({ erreur: "La fin doit être après le début." }, { status: 400 });
  if (finUTC > new Date()) return NextResponse.json({ erreur: "La fin ne peut pas être dans le futur." }, { status: 400 });
  if (await periodeVerrouillee(dateQuebecStr(debutUTC))) return NextResponse.json({ erreur: "Cette période est verrouillée." }, { status: 409 });
  if (debutUTC.getTime() === quart.debut.getTime() && finUTC.getTime() === quart.fin?.getTime()) {
    return NextResponse.json({ ok: true }); // rien n'a changé
  }

  await prisma.$transaction(async (tx) => {
    const corrige = await tx.quart.update({
      where: { id: quart.id },
      data: {
        debut: debutUTC, fin: finUTC, fermeAuto: false,
        // Heures d'origine : gardées à la première correction seulement
        ...(quart.modifiePar || quart.ajoutePar ? {} : { debutOriginal: quart.debut, finOriginal: quart.fin }),
        modifiePar: session.nom, modifieLe: new Date(),
      },
    });
    await journaliser(session, {
      quartId: quart.id, employe: quart.employe, jour: dateQuebecStr(debutUTC), action: "MODIFICATION",
      ancienne: decrireQuart(quart), nouvelle: decrireQuart(corrige), raison: String(raison).trim(),
    }, tx);
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, props) {
  const { reponse, session, quart } = await preparer(props);
  if (reponse) return reponse;
  const { raison } = await request.json().catch(() => ({}));
  if (!String(raison || "").trim()) return NextResponse.json({ erreur: "Inscris la raison de la suppression." }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.quart.delete({ where: { id: quart.id } });
    await journaliser(session, {
      quartId: quart.id, employe: quart.employe, jour: dateQuebecStr(quart.debut), action: "SUPPRESSION",
      ancienne: decrireQuart(quart), raison: String(raison).trim(),
    }, tx);
  });
  return NextResponse.json({ ok: true });
}
