import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { CLIENT } from "@/lib/client";
import { alignerVehiculesAuGL, calculerAlignementVehicules } from "@/lib/vehiculesAVendre";

// Aligne le compte 1250 sur le coûtant des véhicules en stock (écriture
// contre 3010 Soldes d'ouverture) — voir lib/vehiculesAVendre.js
export async function POST() {
  const session = await obtenirSession();
  if (!CLIENT.vehiculesAVendre || !(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  try {
    await alignerVehiculesAuGL(session.nom);
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace(/^PERIODE_LOCK:/, "") }, { status: 423 });
  }
  return NextResponse.json(await calculerAlignementVehicules());
}
