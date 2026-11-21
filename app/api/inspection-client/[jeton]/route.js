import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifier } from "@/lib/notifications";
import { peutRepondreInspection, pointsRecommandes } from "@/lib/grillesInspection";

const TAILLE_MAX_SIGNATURE = 300 * 1024; // caractères de la data URL

// Réponse du client à son rapport d'inspection (page publique
// /inspection/<jeton>) : protégée par le lien secret, sans compte. Une seule
// réponse — pour la changer, le client appelle l'atelier.
// { reponse: "APPROUVEE" | "REFUSEE", points: [ids approuvés], nom, signature, note }
export async function POST(request, props) {
  const { jeton } = await props.params;
  const inspection = jeton
    ? await prisma.inspection.findUnique({
        where: { jetonClient: jeton },
        include: {
          points: { select: { id: true, etat: true, recommandation: true, ordre: true } },
          bon: { select: { id: true, numero: true, clientNomAffiche: true, client: { select: { nom: true } } } },
        },
      })
    : null;
  if (!inspection) return NextResponse.json({ erreur: "Ce lien n'est plus valide." }, { status: 404 });
  if (!peutRepondreInspection(inspection)) {
    return NextResponse.json({ erreur: "Ce rapport a déjà reçu une réponse." }, { status: 409 });
  }

  const corps = await request.json().catch(() => ({}));
  const note = String(corps.note || "").trim().slice(0, 1000) || null;
  const recommandes = pointsRecommandes(inspection.points).map((pt) => pt.id);
  const nomClient = (inspection.bon.clientNomAffiche || "").trim() || inspection.bon.client.nom;
  const url = `/bons/${inspection.bon.id}/inspection/${inspection.id}`;
  const tag = `inspection-${inspection.id}`;

  if (corps.reponse === "REFUSEE") {
    await prisma.$transaction([
      prisma.pointInspection.updateMany({ where: { id: { in: recommandes } }, data: { approbation: "REFUSE" } }),
      prisma.inspection.update({ where: { id: inspection.id }, data: { reponseClient: "REFUSEE", reponseLe: new Date(), noteClient: note } }),
    ]);
    await notifier("INSPECTION_REPONSE", {
      titre: `Inspection du bon #${inspection.bon.numero} : pas de travaux pour l'instant`,
      corps: `${nomClient} a répondu « pas maintenant » au rapport d'inspection.${note ? ` « ${note} »` : ""}`,
      url, tag,
    });
    return NextResponse.json({ ok: true });
  }

  if (corps.reponse !== "APPROUVEE") return NextResponse.json({ erreur: "Réponse invalide." }, { status: 400 });

  const nom = String(corps.nom || "").trim().slice(0, 120);
  const signature = String(corps.signature || "");
  if (!nom) return NextResponse.json({ erreur: "Entrez votre nom." }, { status: 400 });
  if (!signature.startsWith("data:image/png;base64,") || signature.length > TAILLE_MAX_SIGNATURE) {
    return NextResponse.json({ erreur: "Signez dans la case avant d'approuver." }, { status: 400 });
  }
  const approuves = new Set((Array.isArray(corps.points) ? corps.points : []).filter((id) => recommandes.includes(id)));
  if (approuves.size === 0) return NextResponse.json({ erreur: "Cochez au moins un travail à approuver." }, { status: 400 });

  await prisma.$transaction([
    prisma.pointInspection.updateMany({ where: { id: { in: [...approuves] } }, data: { approbation: "APPROUVE" } }),
    prisma.pointInspection.updateMany({ where: { id: { in: recommandes.filter((id) => !approuves.has(id)) } }, data: { approbation: "REFUSE" } }),
    prisma.inspection.update({
      where: { id: inspection.id },
      data: { reponseClient: "APPROUVEE", reponseLe: new Date(), signataireNom: nom, signatureClient: signature, noteClient: note },
    }),
  ]);

  const partiel = approuves.size < recommandes.length ? ` (${approuves.size} sur ${recommandes.length})` : "";
  await notifier("INSPECTION_REPONSE", {
    titre: `Travaux approuvés${partiel} — inspection du bon #${inspection.bon.numero}`,
    corps: `${nom} a approuvé et signé des travaux recommandés en ligne.${note ? ` « ${note} »` : ""}`,
    url, tag,
  });
  return NextResponse.json({ ok: true });
}
