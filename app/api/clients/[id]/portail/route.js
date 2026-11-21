import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { portailActif, nouveauJeton, lienPortailClient, envoyerLienPortailClient } from "@/lib/portailClient";

// Portail du client, depuis sa fiche (accès Clients) :
//   { action: "activer" }    → crée son lien secret, ou un nouveau (l'ancien ne marche plus)
//   { action: "desactiver" } → plus aucun accès
//   { action: "envoyer" }    → lui envoie le lien par courriel
export async function POST(request, props) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  if (!(await portailActif())) return NextResponse.json({ erreur: "Le portail client n'est pas actif (Administrateur → Modules)." }, { status: 409 });
  const { id } = await props.params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ erreur: "Client introuvable." }, { status: 404 });
  const { action } = await request.json().catch(() => ({}));

  if (action === "activer") {
    const jeton = nouveauJeton();
    await prisma.client.update({ where: { id }, data: { jetonPortail: jeton, portailCreeLe: new Date(), portailVuLe: null } });
    return NextResponse.json({ lien: lienPortailClient(jeton) });
  }
  if (action === "desactiver") {
    await prisma.client.update({ where: { id }, data: { jetonPortail: null, portailCreeLe: null, portailVuLe: null } });
    return NextResponse.json({ ok: true });
  }
  if (action === "envoyer") {
    try {
      await envoyerLienPortailClient(client);
    } catch (e) {
      return NextResponse.json({ erreur: e.message }, { status: 409 });
    }
    return NextResponse.json({ ok: true, a: client.courriel });
  }
  return NextResponse.json({ erreur: "Action inconnue." }, { status: 400 });
}
