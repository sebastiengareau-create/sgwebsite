import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lirePanier, DUREE_SESSION_MS } from "@/lib/partstech";

// Panier envoyé par PartsTech (« Submit Quote ») — adresse publique, sans
// connexion : seul le jeton secret de la session, mis dans l'adresse à son
// ouverture, l'autorise. Le panier est seulement stocké ; un employé
// connecté l'ajoute ensuite aux commandes. Voir lib/partstech.js.
const TAILLE_MAX = 1_000_000;

export async function POST(request, props) {
  const params = await props.params;
  const session = await prisma.sessionPartsTech.findUnique({ where: { jeton: String(params.jeton || "") } });
  if (!session) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  if (session.importeLe) return NextResponse.json({ error: "Cart already imported" }, { status: 409 });
  if (Date.now() - session.creeLe.getTime() > DUREE_SESSION_MS) return NextResponse.json({ error: "Session expired" }, { status: 410 });

  const brut = await request.text();
  if (brut.length > TAILLE_MAX) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let corps;
  try { corps = JSON.parse(brut); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (session.sessionId && corps.sessionId !== session.sessionId) return NextResponse.json({ error: "Session mismatch" }, { status: 400 });
  if (corps.action && corps.action !== "SUBMIT_QUOTE") return NextResponse.json({ error: "Only quotes are accepted" }, { status: 400 });

  // Un nouvel envoi (panier modifié puis soumis de nouveau) remplace le précédent
  await prisma.sessionPartsTech.update({ where: { id: session.id }, data: { panier: lirePanier(corps), recuLe: new Date() } });
  return NextResponse.json({ ok: true });
}
