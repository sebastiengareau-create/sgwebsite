import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { locataireParJeton, erreur } from "@/lib/immobilier";
import { REPONSES_AVIS, libelle } from "@/lib/immobilierCalculs";
import { notifier } from "@/lib/notifications";
import { repondreAvisPortail, origineRequete, TAILLE_MAX_SIGNATURE } from "@/lib/signatureImmo";

// Réponse du locataire à l'avis de modification de son bail, signée :
// { bailId, reponse, nom, signature, consentement }. Possible tant qu'un avis
// est en attente de réponse sur un bail en cours. La réponse, la signature,
// la date et l'adresse IP sont consignées au bail (lib/signatureImmo.js).
export async function POST(request, props) {
  const { jeton } = await props.params;
  const l = await locataireParJeton(jeton);
  if (!l) return erreur("Lien invalide.", 404);
  const { bailId, reponse, nom: nomRecu, signature: signatureRecue, consentement } = await request.json().catch(() => ({}));
  if (!REPONSES_AVIS.some((r) => r.code === reponse)) return erreur("Réponse invalide.");
  const nom = String(nomRecu || "").trim().slice(0, 120);
  const signature = String(signatureRecue || "");
  if (!nom) return erreur("Entrez votre nom.");
  if (!signature.startsWith("data:image/png;base64,") || signature.length > TAILLE_MAX_SIGNATURE) return erreur("Signez dans la case.");
  if (!consentement) return erreur("Cochez la case de consentement à la signature électronique.");
  const bail = await prisma.bailImmo.findFirst({ where: { id: String(bailId || ""), statut: "ACTIF", locataires: { some: { id: l.id } } } });
  if (!bail) return erreur("Bail introuvable.", 404);
  if (!bail.avisEnvoyeLe || bail.reponseAvis) return erreur("Aucun avis en attente de réponse.");
  await repondreAvisPortail({ locataire: l, bail, reponse, nom, signature, origine: origineRequete(request) });
  await notifier("DEMANDE_IMMO", { titre: `Réponse à l'avis — ${nom}`, corps: `${libelle(REPONSES_AVIS, reponse)} (réponse signée en ligne)`, url: `/immobilier/baux/${bail.id}`, tag: `avis-immo-${bail.id}` });
  return NextResponse.json({ ok: true });
}
