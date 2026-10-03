import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { creerAvecNumero, prochainNumeroBon } from "@/lib/numerotation";
import { CLIENT } from "@/lib/client";

// Nouveau bon de travail relié au véhicule à vendre : un bon ordinaire
// (client interne, véhicule du dossier), dont la facture sera sans taxes et
// payée par le coûtant du véhicule (voir app/api/bons/[id]/facturer).
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!CLIENT.vehiculesAVendre || !(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { problemes } = await request.json();
  const lignes = (problemes || []).map((p) => String(p).trim()).filter(Boolean);
  if (lignes.length === 0) return NextResponse.json({ erreur: "Indique au moins une tâche." }, { status: 400 });

  const vv = await prisma.vehiculeVente.findUnique({ where: { id: params.id }, include: { vehicule: true, factureVente: true } });
  if (!vv) return NextResponse.json({ erreur: "Véhicule introuvable." }, { status: 404 });
  if (vv.factureVente) return NextResponse.json({ erreur: "Ce véhicule est vendu — un nouveau bon se fait au nom de son acheteur." }, { status: 409 });

  const bon = await creerAvecNumero(prochainNumeroBon, (numero) => prisma.bonTravail.create({
    data: {
      numero,
      clientId: vv.vehicule.clientId,
      vehiculeId: vv.vehiculeId,
      vehiculeVenteId: vv.id,
      problemes: { create: lignes.map((description) => ({ description })) },
    },
  }));
  return NextResponse.json({ id: bon.id, numero: bon.numero });
}
