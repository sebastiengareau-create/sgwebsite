import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { locataireParJeton, erreur } from "@/lib/immobilier";
import { REPONSES_AVIS, libelle } from "@/lib/immobilierCalculs";
import { notifier } from "@/lib/notifications";

// Réponse du locataire à l'avis de modification de son bail : { bailId, reponse }
// Possible tant qu'un avis est en attente de réponse sur un bail en cours.
// La réponse est consignée au bail (et dans ses notes, avec la date).
export async function POST(request, props) {
  const { jeton } = await props.params;
  const l = await locataireParJeton(jeton);
  if (!l) return erreur("Lien invalide.", 404);
  const { bailId, reponse } = await request.json().catch(() => ({}));
  if (!REPONSES_AVIS.some((r) => r.code === reponse)) return erreur("Réponse invalide.");
  const bail = await prisma.bailImmo.findFirst({ where: { id: String(bailId || ""), statut: "ACTIF", locataires: { some: { id: l.id } } } });
  if (!bail) return erreur("Bail introuvable.", 404);
  if (!bail.avisEnvoyeLe || bail.reponseAvis) return erreur("Aucun avis en attente de réponse.");
  const quand = new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeZone: "America/Toronto" }).format(new Date());
  const note = `Réponse à l'avis de modification donnée par ${l.nom} dans son portail le ${quand} : ${libelle(REPONSES_AVIS, reponse).toLowerCase()}.`;
  await prisma.bailImmo.update({ where: { id: bail.id }, data: { reponseAvis: reponse, notes: [bail.notes, note].filter(Boolean).join("\n") } });
  await notifier("DEMANDE_IMMO", { titre: `Réponse à l'avis — ${l.nom}`, corps: libelle(REPONSES_AVIS, reponse), url: `/immobilier/baux/${bail.id}`, tag: `avis-immo-${bail.id}` });
  return NextResponse.json({ ok: true });
}
