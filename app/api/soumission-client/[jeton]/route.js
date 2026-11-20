import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifier } from "@/lib/notifications";
import { peutRepondre } from "@/lib/approbationSoumission";

const TAILLE_MAX_SIGNATURE = 300 * 1024; // caractères de la data URL

// Réponse du client à sa soumission (page publique /soumission/<jeton>) :
// protégée par le lien secret, sans compte. Une seule réponse — pour la
// changer, le client appelle l'atelier (modifier la soumission la remet à zéro).
export async function POST(request, props) {
  const { jeton } = await props.params;
  const soumission = jeton
    ? await prisma.soumission.findUnique({ where: { jetonClient: jeton }, include: { taches: { select: { id: true } } } })
    : null;
  if (!soumission) return NextResponse.json({ erreur: "Ce lien n'est plus valide." }, { status: 404 });
  if (!peutRepondre(soumission)) {
    return NextResponse.json({ erreur: "Cette soumission a déjà reçu une réponse ou n'est plus en attente." }, { status: 409 });
  }

  const corps = await request.json().catch(() => ({}));
  const note = String(corps.note || "").trim().slice(0, 1000) || null;

  if (corps.reponse === "REFUSEE") {
    await prisma.soumission.update({
      where: { id: soumission.id },
      data: { reponseClient: "REFUSEE", reponseLe: new Date(), noteClient: note, signataireNom: null, signatureClient: null },
    });
    await notifier("SOUMISSION_REPONSE", {
      titre: `Soumission #${soumission.numero} refusée`,
      corps: `${soumission.clientNom} a refusé la soumission en ligne.${note ? ` « ${note} »` : ""}`,
      url: "/secretaire/operations/soumissions",
      tag: `soumission-${soumission.id}`,
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
  const idsValides = new Set(soumission.taches.map((t) => t.id));
  const approuvees = new Set((Array.isArray(corps.taches) ? corps.taches : []).filter((id) => idsValides.has(id)));
  if (approuvees.size === 0) return NextResponse.json({ erreur: "Cochez au moins un travail à approuver." }, { status: 400 });

  await prisma.$transaction([
    prisma.tacheSoumission.updateMany({ where: { soumissionId: soumission.id, id: { in: [...approuvees] } }, data: { refusee: false } }),
    prisma.tacheSoumission.updateMany({ where: { soumissionId: soumission.id, id: { notIn: [...approuvees] } }, data: { refusee: true } }),
    prisma.soumission.update({
      where: { id: soumission.id },
      data: { reponseClient: "APPROUVEE", reponseLe: new Date(), signataireNom: nom, signatureClient: signature, noteClient: note },
    }),
  ]);

  const partiel = approuvees.size < idsValides.size ? ` (${approuvees.size} travaux sur ${idsValides.size})` : "";
  await notifier("SOUMISSION_REPONSE", {
    titre: `Soumission #${soumission.numero} approuvée${partiel}`,
    corps: `${nom} a approuvé et signé la soumission en ligne.${note ? ` « ${note} »` : ""}`,
    url: "/secretaire/operations/soumissions",
    tag: `soumission-${soumission.id}`,
  });
  return NextResponse.json({ ok: true });
}
