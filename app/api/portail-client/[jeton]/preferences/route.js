import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientParJeton } from "@/lib/portailClient";

// Le client choisit, depuis son portail, s'il reçoit les rappels et les
// promotions par courriel : { promotions: true | false }
export async function POST(request, props) {
  const { jeton } = await props.params;
  const client = await clientParJeton(jeton);
  if (!client) return NextResponse.json({ erreur: "Ce lien n'est plus valide." }, { status: 404 });
  const { promotions } = await request.json().catch(() => ({}));
  if (typeof promotions !== "boolean") return NextResponse.json({ erreur: "Choix invalide." }, { status: 400 });
  await prisma.client.update({ where: { id: client.id }, data: { promotionsRefuseesLe: promotions ? null : client.promotionsRefuseesLe || new Date() } });
  return NextResponse.json({ promotions });
}
