import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { genererPdfFacture } from "@/lib/pdfFacture";
import { obtenirInfosEntreprise } from "@/lib/config";
import { Resend } from "resend";

export async function POST(request, { params }) {
  const session = await obtenirSession();
  const { nomEntreprise } = await obtenirInfosEntreprise();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant)." }, { status: 500 });
  }

  const bon = await prisma.bonTravail.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      facture: true,
      problemes: {
        orderBy: { id: "asc" },
        include: { pieces: { include: { piece: true } }, entreesTemps: { include: { employe: true } } },
      },
    },
  });
  if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });
  if (!bon.facture) return NextResponse.json({ erreur: "Ce bon n'a pas encore de facture émise." }, { status: 400 });

  const { courrielManuel } = await request.json().catch(() => ({}));
  const destinataire = courrielManuel || bon.client.courriel;
  if (!destinataire) {
    return NextResponse.json({ erreur: "Aucun courriel — le client n'en a pas au dossier, ou entre-en un manuellement." }, { status: 400 });
  }

  const parametres = await prisma.parametre.findMany();
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const infosEntreprise = await obtenirInfosEntreprise();

  let pdfBuffer;
  try {
    pdfBuffer = await genererPdfFacture(
      bon, infosEntreprise, dict,
      Number(dict.tps_taux || 5), Number(dict.tvq_taux || 9.975)
    );
  } catch (e) {
    return NextResponse.json({ erreur: "Erreur lors de la génération du PDF : " + e.message }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const adresseEnvoi = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  try {
    const { error } = await resend.emails.send({
      from: `${nomEntreprise} <${adresseEnvoi}>`,
      to: destinataire,
      subject: `Facture ${bon.facture.numero} — ${nomEntreprise}`,
      text: `Bonjour ${bon.client.nom},\n\nVoici votre facture ${bon.facture.numero}, en pièce jointe.\n\nMontant total : ${bon.facture.totalAvecTaxes.toFixed(2)} $\n\nMerci de votre confiance,\n${nomEntreprise}`,
      attachments: [
        {
          filename: `facture-${bon.facture.numero}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });
    if (error) {
      return NextResponse.json({ erreur: "Échec de l'envoi : " + (error.message || JSON.stringify(error)) }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ erreur: "Échec de l'envoi : " + e.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, destinataire });
}
