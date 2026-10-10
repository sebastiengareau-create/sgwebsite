import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";
import { notifier, employesDuBon } from "@/lib/notifications";

export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  const { description } = await request.json();
  if (!description?.trim()) {
    return NextResponse.json({ erreur: "Description requise." }, { status: 400 });
  }

  const probleme = await prisma.probleme.create({
    data: { description: description.trim(), bonId: params.id },
  });
  after(async () => {
    const bon = await prisma.bonTravail.findUnique({ where: { id: params.id }, select: { numero: true, client: { select: { nom: true } } } });
    await notifier("BON_MODIFIE", {
      employeIds: await employesDuBon(params.id),
      sauf: [session.id],
      titre: `🔧 Tâche ajoutée — bon #${bon.numero}`,
      corps: `${bon.client.nom} · ${probleme.description}`,
      url: `/bons/${params.id}`,
    });
  });
  return NextResponse.json(probleme);
}
