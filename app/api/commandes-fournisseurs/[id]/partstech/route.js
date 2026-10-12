import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { ouvrirSession } from "@/lib/partstech";

// « 🔌 Chercher dans PartsTech » d'une commande en brouillon : ouvre une
// session PartsTech et renvoie l'adresse où envoyer l'employé. Le panier
// reviendra à /api/partstech/panier/<jeton> (voir lib/partstech.js).
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const commande = await prisma.commandeFournisseur.findUnique({ where: { id: params.id } });
  if (!commande) return NextResponse.json({ erreur: "Commande introuvable." }, { status: 404 });
  if (commande.statut !== "BROUILLON") {
    return NextResponse.json({ erreur: "PartsTech ajoute seulement à une commande en brouillon." }, { status: 409 });
  }
  // PartsTech doit pouvoir joindre l'appli : son adresse publique
  const base = (process.env.APP_URL || "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) {
    return NextResponse.json({ erreur: "Adresse publique de l'appli manquante (variable APP_URL)." }, { status: 500 });
  }

  const corps = await request.json().catch(() => ({}));
  const jeton = crypto.randomBytes(24).toString("hex");
  const enregistree = await prisma.sessionPartsTech.create({ data: { jeton, commandeId: commande.id, creePar: session.nom } });
  try {
    const { sessionId, redirectUrl } = await ouvrirSession({
      numeroPiece: corps.numeroPiece,
      poNumber: commande.numero,
      callbackUrl: `${base}/api/partstech/panier/${jeton}`,
      returnUrl: `${base}/secretaire/inventaire/commandes/${commande.id}?partstech=${enregistree.id}`,
    });
    await prisma.sessionPartsTech.update({ where: { id: enregistree.id }, data: { sessionId } });
    return NextResponse.json({ redirectUrl });
  } catch (e) {
    await prisma.sessionPartsTech.delete({ where: { id: enregistree.id } });
    return NextResponse.json({ erreur: e.message }, { status: 502 });
  }
}
