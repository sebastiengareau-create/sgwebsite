import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { genererPdfSoumission } from "@/lib/pdfSoumission";
import { obtenirInfosEntreprise } from "@/lib/config";
import { courrielConfigure, courrielValide, envoyerDocumentPdf } from "@/lib/courrielDocuments";

// Envoie la soumission au client, en PDF joint
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (!courrielConfigure()) {
    return NextResponse.json({ erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant)." }, { status: 500 });
  }

  const soumission = await prisma.soumission.findUnique({
    where: { id: params.id },
    include: { taches: { include: { pieces: true } }, client: true, vehicule: true, depots: { select: { montant: true } } },
  });
  if (!soumission) return NextResponse.json({ erreur: "Soumission introuvable." }, { status: 404 });

  const { courrielManuel } = await request.json().catch(() => ({}));
  const destinataire = (courrielManuel || soumission.client?.courriel || "").trim();
  if (!destinataire) {
    return NextResponse.json({ erreur: "Aucun courriel — le client n'en a pas au dossier, ou entre-en un manuellement." }, { status: 400 });
  }
  if (!courrielValide(destinataire)) {
    return NextResponse.json({ erreur: "Adresse courriel invalide." }, { status: 400 });
  }

  const parametres = await prisma.parametre.findMany();
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const infosEntreprise = await obtenirInfosEntreprise();
  const { nomEntreprise } = infosEntreprise;

  let pdf;
  try {
    pdf = await genererPdfSoumission(soumission, infosEntreprise, dict);
  } catch (e) {
    return NextResponse.json({ erreur: "Erreur lors de la génération du PDF : " + e.message }, { status: 500 });
  }

  try {
    await envoyerDocumentPdf({
      a: destinataire,
      entreprise: infosEntreprise,
      pdf,
      nomFichier: `soumission-${soumission.numero}.pdf`,
      sujet: `Soumission ${soumission.numero} — ${nomEntreprise}`,
      texte: `Bonjour ${soumission.clientNom},\n\nVoici votre soumission ${soumission.numero}, en pièce jointe. Pour l'accepter ou pour toute question, répondez simplement à ce courriel ou appelez-nous.\n\nMerci de votre confiance,\n${nomEntreprise}`,
    });
  } catch (e) {
    return NextResponse.json({ erreur: "Échec de l'envoi : " + e.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, destinataire });
}
