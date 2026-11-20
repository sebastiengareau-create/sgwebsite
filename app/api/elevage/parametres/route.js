import { NextResponse } from "next/server";
import { sessionElevage, ecrireRendementCarcasse, ecrireGmqCible, ecrirePoidsAbattage } from "@/lib/elevage";

const nombre = (v) => Number(String(v ?? "").replace(",", "."));

// Réglages de l'élevage : rendement carcasse (% du poids vif) servant à
// estimer la découpe d'une bête encore au troupeau, et gain moyen quotidien
// visé (kg/jour) pour signaler les bêtes en croissance sous la cible, et
// poids vif visé à l'abattage (kg) pour prévoir l'abattage des bouvillons
export async function PATCH(request) {
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { rendementCarcasse, gmqCible, poidsAbattage } = await request.json();
  if (rendementCarcasse !== undefined) {
    const n = nombre(rendementCarcasse);
    if (!Number.isFinite(n) || n < 30 || n > 80) return NextResponse.json({ erreur: "Rendement carcasse invalide (30 à 80 %)." }, { status: 400 });
    await ecrireRendementCarcasse(Math.round(n * 10) / 10);
  }
  if (gmqCible !== undefined) {
    const n = nombre(gmqCible);
    if (!Number.isFinite(n) || n < 0.1 || n > 3) return NextResponse.json({ erreur: "Gain visé invalide (0,1 à 3 kg/jour)." }, { status: 400 });
    await ecrireGmqCible(Math.round(n * 100) / 100);
  }
  if (poidsAbattage !== undefined) {
    const n = nombre(poidsAbattage);
    if (!Number.isFinite(n) || n < 200 || n > 1500) return NextResponse.json({ erreur: "Poids d'abattage visé invalide (200 à 1 500 kg)." }, { status: 400 });
    await ecrirePoidsAbattage(Math.round(n));
  }
  return NextResponse.json({ ok: true });
}
