import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { effectuerTransfert, obtenirTransfertsRecents } from "@/lib/tresorerie";

export async function GET() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const transferts = await obtenirTransfertsRecents();
  return NextResponse.json(transferts);
}

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { compteSourceId, compteDestinationId, montant, description, date } = await request.json();
  try {
    await effectuerTransfert({ compteSourceId, compteDestinationId, montant, description, date, creePar: session.nom });
  } catch (e) {
    if (e.message.startsWith("PERIODE_LOCK:")) {
      return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
    }
    return NextResponse.json({ erreur: e.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
