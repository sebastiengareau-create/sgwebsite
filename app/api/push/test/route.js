import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { envoyerNotification } from "@/lib/notifications";

// Notification test à ses propres appareils, depuis la page Notifications
export async function POST() {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });
  const atteints = await envoyerNotification(session.id, { titre: "Notifications activées ✓", corps: "Tes notifications arriveront sur ce téléphone.", tag: "test" });
  if (atteints === 0) return NextResponse.json({ erreur: "Aucun appareil abonné n'a pu être joint — réactive les notifications." }, { status: 400 });
  return NextResponse.json({ ok: true, atteints });
}
