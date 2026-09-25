import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { normaliserVehicule } from "@/lib/vehicules";

async function accesVehicules(session) {
  return (await aAccesSection(session, "clients")) || (await aAccesSection(session, "operations"));
}

export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await accesVehicules(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const { data, vide, erreur } = normaliserVehicule(await request.json());
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });
  if (vide) return NextResponse.json({ erreur: "Indique au moins une information sur le véhicule." }, { status: 400 });

  const existe = await prisma.vehicule.findUnique({ where: { id: params.id } });
  if (!existe) return NextResponse.json({ erreur: "Véhicule introuvable." }, { status: 404 });

  const vehicule = await prisma.vehicule.update({ where: { id: params.id }, data });
  return NextResponse.json(vehicule);
}

export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await accesVehicules(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  // Comme pour un client : un véhicule qui figure sur des bons reste au
  // dossier, pour préserver l'historique de ce qui a été fait dessus.
  const bons = await prisma.bonTravail.count({ where: { vehiculeId: params.id } });
  if (bons > 0) {
    return NextResponse.json(
      { erreur: `Ce véhicule figure sur ${bons} bon${bons > 1 ? "s" : ""} de travail — il ne peut pas être supprimé pour préserver l'historique.` },
      { status: 409 }
    );
  }

  await prisma.vehicule.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
