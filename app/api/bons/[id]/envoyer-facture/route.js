import { NextResponse } from "next/server";
import { nomClientBon } from "@/lib/nomClient";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { genererPdfFacture } from "@/lib/pdfFacture";
import { obtenirInfosEntreprise } from "@/lib/config";
import { courrielConfigure, courrielValide, envoyerDocumentPdf } from "@/lib/courrielDocuments";

// Envoie au client, en PDF joint, la facture du bon — ou, tant qu'il n'est
// pas facturé, le bon de commande (aperçu des travaux et du total estimé,
// comme la page imprimée « Bon de commande »).
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (!courrielConfigure()) {
    return NextResponse.json({ erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant)." }, { status: 500 });
  }

  const bon = await prisma.bonTravail.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      vehicule: true,
      facture: { include: { paiements: { select: { montant: true, modePaiement: true, depot: { select: { id: true } } } } } },
      depots: { select: { montant: true } },
      problemes: {
        orderBy: { id: "asc" },
        include: { pieces: { include: { piece: true } }, entreesTemps: { include: { employe: true } } },
      },
    },
  });
  if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });

  const { courrielManuel } = await request.json().catch(() => ({}));
  const destinataire = (courrielManuel || bon.client.courriel || "").trim();
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
  // Bon interne sur un véhicule à vendre : sans taxes (comme la page imprimée)
  const tpsTaux = bon.vehiculeVenteId ? 0 : Number(dict.tps_taux || 5);
  const tvqTaux = bon.vehiculeVenteId ? 0 : Number(dict.tvq_taux || 9.975);

  let pdf;
  try {
    pdf = await genererPdfFacture(bon, infosEntreprise, dict, tpsTaux, tvqTaux);
  } catch (e) {
    return NextResponse.json({ erreur: "Erreur lors de la génération du PDF : " + e.message }, { status: 500 });
  }

  const f = bon.facture;
  const envoi = f
    ? {
        sujet: `Facture ${f.numero} — ${nomEntreprise}`,
        texte: `Bonjour ${nomClientBon(bon)},\n\nVoici votre facture ${f.numero}, en pièce jointe.\n\nMontant total : ${f.totalAvecTaxes.toFixed(2)} $\n\nMerci de votre confiance,\n${nomEntreprise}`,
        nomFichier: `facture-${f.numero}.pdf`,
      }
    : {
        sujet: `Bon de commande ${bon.numero} — ${nomEntreprise}`,
        texte: `Bonjour ${nomClientBon(bon)},\n\nVoici votre bon de commande ${bon.numero}, en pièce jointe : les travaux prévus et le total estimé. Les montants peuvent changer selon les travaux réels; la facture finale suivra.\n\nMerci de votre confiance,\n${nomEntreprise}`,
        nomFichier: `bon-${bon.numero}.pdf`,
      };

  try {
    await envoyerDocumentPdf({ a: destinataire, entreprise: infosEntreprise, pdf, ...envoi });
  } catch (e) {
    return NextResponse.json({ erreur: "Échec de l'envoi : " + e.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, destinataire });
}
