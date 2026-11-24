import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { refusPneus, genererRecuPneus } from "@/lib/pneus";
import { libelleJeuMinuscule } from "@/lib/pneusCalculs";
import { courrielConfigure, courrielValide, envoyerDocumentPdf } from "@/lib/courrielDocuments";

// Reçu d'entreposage d'un jeu de pneus (lib/pdfRecuPneus.js) : le PDF à
// imprimer (GET), ou envoyé au client par courriel (POST { courriel? } — par
// défaut celui de son dossier)
export async function GET(request, props) {
  const { id } = await props.params;
  const refus = await refusPneus(await obtenirSession());
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const recu = await genererRecuPneus(id).catch((e) => ({ erreur: e.message }));
  if (!recu) return NextResponse.json({ erreur: "Jeu de pneus introuvable." }, { status: 404 });
  if (recu.erreur) return NextResponse.json({ erreur: `Le reçu n'a pas pu être créé : ${recu.erreur}` }, { status: 500 });
  return new Response(recu.pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="recu-entreposage-${recu.jeu.numero}.pdf"` } });
}

export async function POST(request, props) {
  const { id } = await props.params;
  const refus = await refusPneus(await obtenirSession());
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  if (!courrielConfigure()) return NextResponse.json({ erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant)." }, { status: 500 });
  const { courriel } = await request.json().catch(() => ({}));
  const recu = await genererRecuPneus(id).catch((e) => ({ erreur: e.message }));
  if (!recu) return NextResponse.json({ erreur: "Jeu de pneus introuvable." }, { status: 404 });
  if (recu.erreur) return NextResponse.json({ erreur: `Le reçu n'a pas pu être créé : ${recu.erreur}` }, { status: 500 });
  const { jeu, pdf, entreprise } = recu;
  const a = String(courriel || jeu.client.courriel || "").trim();
  if (!a) return NextResponse.json({ erreur: "Ce client n'a pas de courriel au dossier." }, { status: 400 });
  if (!courrielValide(a)) return NextResponse.json({ erreur: "Adresse courriel invalide." }, { status: 400 });
  try {
    await envoyerDocumentPdf({
      a, entreprise, pdf, nomFichier: `recu-entreposage-${jeu.numero}.pdf`,
      sujet: `Reçu d'entreposage de vos pneus (${jeu.numero}) — ${entreprise.nomEntreprise}`,
      texte: `Bonjour ${jeu.client.nom},\n\nVoici le reçu d'entreposage de vos ${libelleJeuMinuscule(jeu)} (${jeu.numero}), en pièce jointe. L'état de chaque pneu, noté au dépôt, y est inscrit.\n\nPour toute question, répondez simplement à ce courriel ou appelez-nous.\n\nMerci de votre confiance,\n${entreprise.nomEntreprise}`,
    });
  } catch (e) {
    return NextResponse.json({ erreur: `Échec de l'envoi : ${e.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, destinataire: a });
}
