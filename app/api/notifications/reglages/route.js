import { NextResponse } from "next/server";
import { obtenirSession, estGerantOuDev, ROLES_VALIDES } from "@/lib/auth";
import { TYPES_NOTIFICATIONS } from "@/lib/typesNotifications";
import { enregistrerRolesDuType, tousLesRolesParType } from "@/lib/notifications";

// Qui reçoit quoi : rôles avisés pour chaque type d'avis — { roles: { TYPE: ["SECRETAIRE", …] } }
export async function PUT(request) {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) return NextResponse.json({ erreur: "Réservé au gérant." }, { status: 403 });

  const { roles } = await request.json().catch(() => ({}));
  if (!roles || typeof roles !== "object") return NextResponse.json({ erreur: "Réglages invalides." }, { status: 400 });
  for (const [type, liste] of Object.entries(roles)) {
    if (!TYPES_NOTIFICATIONS[type]?.parRole || !Array.isArray(liste)) continue;
    await enregistrerRolesDuType(type, [...new Set(liste)].filter((r) => ROLES_VALIDES.includes(r)));
  }
  return NextResponse.json({ roles: await tousLesRolesParType() });
}
