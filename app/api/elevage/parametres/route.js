import { NextResponse } from "next/server";
import { sessionElevage, ecrireRendementCarcasse } from "@/lib/elevage";

// Rendement carcasse (% du poids vif) servant à estimer la découpe d'une
// bête encore au troupeau
export async function PATCH(request) {
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { rendementCarcasse } = await request.json();
  const n = Number(String(rendementCarcasse ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 30 || n > 80) return NextResponse.json({ erreur: "Rendement carcasse invalide (30 à 80 %)." }, { status: 400 });
  await ecrireRendementCarcasse(Math.round(n * 10) / 10);
  return NextResponse.json({ ok: true });
}
