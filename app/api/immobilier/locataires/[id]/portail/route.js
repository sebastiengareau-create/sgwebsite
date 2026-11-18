import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionImmo, refus, erreur, nouveauJeton, lienPortailLocataire, envoyerLienPortailLocataire } from "@/lib/immobilier";

// Accès du locataire à son portail :
//   { action: "activer" }    → crée son lien secret (un nouveau rend l'ancien inutilisable)
//   { action: "desactiver" } → plus aucun accès
//   { action: "envoyer" }    → lui envoie son lien par courriel
export async function POST(request, props) {
  if (!(await sessionImmo())) return refus();
  const { id } = await props.params;
  const l = await prisma.locataireImmo.findUnique({ where: { id } });
  if (!l) return erreur("Locataire introuvable.", 404);
  const { action } = await request.json().catch(() => ({}));
  if (action === "activer") {
    const jeton = nouveauJeton();
    await prisma.locataireImmo.update({ where: { id }, data: { jetonPortail: jeton } });
    return NextResponse.json({ ok: true, lien: lienPortailLocataire(jeton) });
  }
  if (action === "desactiver") {
    await prisma.locataireImmo.update({ where: { id }, data: { jetonPortail: null } });
    return NextResponse.json({ ok: true });
  }
  if (action === "envoyer") {
    if (!l.jetonPortail) return erreur("Active d'abord son accès au portail.");
    if (!l.courriel) return erreur("Ce locataire n'a pas de courriel.");
    try {
      await envoyerLienPortailLocataire(l);
    } catch (e) {
      return erreur(e.message || "Envoi impossible.", 502);
    }
    return NextResponse.json({ ok: true });
  }
  return erreur("Action inconnue.");
}
