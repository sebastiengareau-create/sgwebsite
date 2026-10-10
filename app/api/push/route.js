import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";

async function employeConnecte() {
  const session = await obtenirSession();
  if (!session) return { erreur: NextResponse.json({ erreur: "Non connecté." }, { status: 401 }) };
  const employe = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true } });
  if (!employe) return { erreur: NextResponse.json({ erreur: "Seul un compte employé peut recevoir des notifications." }, { status: 403 }) };
  return { employe };
}

// Abonne ce téléphone aux notifications de l'employé connecté. Un même
// téléphone passé à un autre employé (appareil partagé) suit le dernier
// connecté.
export async function POST(request) {
  const { employe, erreur } = await employeConnecte();
  if (erreur) return erreur;

  const { abonnement, appareil } = await request.json().catch(() => ({}));
  const endpoint = String(abonnement?.endpoint || "");
  const p256dh = String(abonnement?.keys?.p256dh || "");
  const auth = String(abonnement?.keys?.auth || "");
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return NextResponse.json({ erreur: "Abonnement invalide." }, { status: 400 });

  const donnees = { employeId: employe.id, p256dh, auth, appareil: String(appareil || "").slice(0, 200) || null };
  await prisma.abonnementPush.upsert({ where: { endpoint }, update: donnees, create: { endpoint, ...donnees } });
  return NextResponse.json({ ok: true });
}

// Désabonne ce téléphone
export async function DELETE(request) {
  const { employe, erreur } = await employeConnecte();
  if (erreur) return erreur;
  const { endpoint } = await request.json().catch(() => ({}));
  await prisma.abonnementPush.deleteMany({ where: { endpoint: String(endpoint || ""), employeId: employe.id } });
  return NextResponse.json({ ok: true });
}
