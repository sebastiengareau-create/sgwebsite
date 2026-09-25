import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { normaliserVehicule } from "@/lib/vehicules";

// Le dossier véhicule se gère depuis la fiche client, mais aussi en créant
// un bon — l'accès aux Clients OU aux Opérations suffit.
async function accesVehicules(session) {
  return (await aAccesSection(session, "clients")) || (await aAccesSection(session, "operations"));
}

export async function GET(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await accesVehicules(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const vehicules = await prisma.vehicule.findMany({ where: { clientId: params.id }, orderBy: { creeLe: "desc" } });
  return NextResponse.json(vehicules);
}

export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await accesVehicules(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client) return NextResponse.json({ erreur: "Client introuvable." }, { status: 404 });

  const { data, vide, erreur } = normaliserVehicule(await request.json());
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });
  if (vide) return NextResponse.json({ erreur: "Indique au moins une information sur le véhicule." }, { status: 400 });

  const vehicule = await prisma.vehicule.create({ data: { ...data, clientId: client.id } });
  return NextResponse.json(vehicule);
}
