import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { peutGererDestinataire, chargerFiche } from "@/lib/documentsServeur";
import { courrielConfigure, courrielValide, preparerCourriel, envoyerCourriels } from "@/lib/courrielDocuments";

// Envoie par courriel une lettre rédigée (texte déjà rempli et relu) —
// { modeleId, pourId, a, sujet, texte }
export async function POST(request) {
  const session = await obtenirSession();
  const { modeleId, pourId, a, sujet, texte } = await request.json().catch(() => ({}));
  const modele = modeleId ? await prisma.modeleDocument.findUnique({ where: { id: String(modeleId) } }) : null;
  if (!modele) return NextResponse.json({ erreur: "Modèle introuvable." }, { status: 404 });
  if (!(await peutGererDestinataire(session, modele.destinataire))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  if (!courrielConfigure()) return NextResponse.json({ erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant)." }, { status: 400 });

  const fiche = pourId ? await chargerFiche(modele.destinataire, String(pourId)) : null;
  if (!fiche) return NextResponse.json({ erreur: "Destinataire introuvable." }, { status: 404 });
  const adresse = String(a || "").trim();
  if (!courrielValide(adresse)) return NextResponse.json({ erreur: "Adresse courriel invalide." }, { status: 400 });
  if (!String(sujet || "").trim() || !String(texte || "").trim()) return NextResponse.json({ erreur: "Le sujet et le texte sont requis." }, { status: 400 });
  const estClient = modele.destinataire === "CLIENT";
  if (estClient && fiche.promotionsRefuseesLe) return NextResponse.json({ erreur: "Ce client s'est désabonné de nos courriels." }, { status: 400 });

  const courriel = preparerCourriel({ a: adresse, sujet: String(sujet).trim(), texte: String(texte), entreprise: await obtenirInfosEntreprise(), clientId: estClient ? fiche.id : null });
  const { echecs } = await envoyerCourriels([courriel]);
  if (echecs.length) return NextResponse.json({ erreur: `Échec de l'envoi : ${echecs[0].erreur}` }, { status: 502 });
  return NextResponse.json({ ok: true, a: adresse });
}
