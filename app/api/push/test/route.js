import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { jobsDeplacementActif } from "@/lib/envois";
import { envoyerNotification } from "@/lib/notifications";

// Notification test à ses propres appareils, depuis « Mes tâches »
export async function POST() {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });
  if (!(await jobsDeplacementActif())) return NextResponse.json({ erreur: "Le module Jobs en déplacement est désactivé." }, { status: 403 });
  const atteints = await envoyerNotification(session.id, { titre: "Notifications activées ✓", corps: "Tu seras averti ici quand un bon te sera envoyé.", tag: "test" });
  if (atteints === 0) return NextResponse.json({ erreur: "Aucun appareil abonné n'a pu être joint — réactive les notifications." }, { status: 400 });
  return NextResponse.json({ ok: true, atteints });
}
