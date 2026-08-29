import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { echangerCodeContreJetons } from "@/lib/quickbooks";

const BASE = process.env.APP_URL || "http://localhost:3000";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId"); // identifiant de l'entreprise QuickBooks connectée
  const etatRecu = searchParams.get("state");
  const etatAttendu = request.cookies.get("qb_state")?.value;

  if (!code || !realmId) {
    return NextResponse.redirect(new URL("/gerant/parametres?qb_erreur=annulé", BASE));
  }
  if (!etatRecu || etatRecu !== etatAttendu) {
    return NextResponse.redirect(new URL("/gerant/parametres?qb_erreur=sécurité", BASE));
  }

  try {
    const jetons = await echangerCodeContreJetons(code);
    const expireLe = new Date(Date.now() + jetons.expires_in * 1000).toISOString();

    const valeurs = {
      qb_realm_id: realmId,
      qb_access_token: jetons.access_token,
      qb_refresh_token: jetons.refresh_token,
      qb_expire_le: expireLe,
    };
    for (const [cle, valeur] of Object.entries(valeurs)) {
      await prisma.parametre.upsert({
        where: { cle },
        update: { valeur: String(valeur) },
        create: { cle, valeur: String(valeur) },
      });
    }

    return NextResponse.redirect(new URL("/gerant/parametres?qb_connecte=1", BASE));
  } catch (e) {
    return NextResponse.redirect(new URL(`/gerant/parametres?qb_erreur=${encodeURIComponent(e.message)}`, BASE));
  }
}
