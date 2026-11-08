import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionCopro, refus, erreur, nouveauJeton, lienPortail, envoyerLienPortail } from "@/lib/copropriete";

// Accès du copropriétaire à son portail :
//   { action: "activer" }    → crée son lien secret (ou en crée un nouveau,
//                              ce qui rend l'ancien inutilisable)
//   { action: "desactiver" } → plus aucun accès
//   { action: "envoyer" }    → lui envoie son lien par courriel
export async function POST(request, props) {
  if (!(await sessionCopro())) return refus();
  const { id } = await props.params;
  const c = await prisma.coproprietaireCopro.findUnique({ where: { id } });
  if (!c) return erreur("Copropriétaire introuvable.", 404);
  const { action } = await request.json().catch(() => ({}));

  if (action === "activer") {
    const jeton = nouveauJeton();
    await prisma.coproprietaireCopro.update({ where: { id }, data: { jetonPortail: jeton } });
    return NextResponse.json({ ok: true, lien: lienPortail(jeton) });
  }
  if (action === "desactiver") {
    await prisma.coproprietaireCopro.update({ where: { id }, data: { jetonPortail: null } });
    return NextResponse.json({ ok: true });
  }
  if (action === "envoyer") {
    if (!c.jetonPortail) return erreur("Active d'abord son accès au portail.");
    if (!c.courriel) return erreur("Ce copropriétaire n'a pas de courriel.");
    try {
      await envoyerLienPortail(c);
    } catch (e) {
      return erreur(e.message || "Envoi impossible.", 502);
    }
    return NextResponse.json({ ok: true });
  }
  return erreur("Action inconnue.");
}
