import { NextResponse } from "next/server";
import { logoCourriel } from "@/lib/courrielDocuments";

// Logo réduit des courriels envoyés en groupe (Resend n'y accepte pas de
// pièce jointe) — public, comme le logo du site
export async function GET() {
  const logo = await logoCourriel();
  if (!logo) return NextResponse.json({ erreur: "Pas de logo." }, { status: 404 });
  return new NextResponse(logo, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
}
