import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { creerAvecNumero } from "@/lib/numerotation";
import { normaliserVehicule } from "@/lib/vehicules";
import { CLIENT } from "@/lib/client";
import { obtenirClientInterne, prochainNumeroVehiculeVente, normaliserFiche } from "@/lib/vehiculesAVendre";

// Nouveau véhicule à vendre : son dossier Vehicule (au nom du client
// interne) et sa fiche (coûtant d'achat, prix demandé…).
export async function POST(request) {
  const session = await obtenirSession();
  if (!CLIENT.vehiculesAVendre || !(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json();
  const vehicule = normaliserVehicule(body.vehicule);
  if (vehicule.erreur) return NextResponse.json({ erreur: vehicule.erreur }, { status: 400 });
  if (!vehicule.data.marque || !vehicule.data.modele) {
    return NextResponse.json({ erreur: "Indique au moins la marque et le modèle du véhicule." }, { status: 400 });
  }
  const fiche = normaliserFiche(body);
  if (fiche.erreur) return NextResponse.json({ erreur: fiche.erreur }, { status: 400 });

  const client = await obtenirClientInterne();
  const vv = await creerAvecNumero(prochainNumeroVehiculeVente, (numero) => prisma.$transaction(async (tx) => {
    const v = await tx.vehicule.create({ data: { ...vehicule.data, clientId: client.id } });
    return tx.vehiculeVente.create({ data: { ...fiche.data, numero, vehiculeId: v.id, creePar: session.nom } });
  }));

  return NextResponse.json({ id: vv.id, numero: vv.numero });
}
