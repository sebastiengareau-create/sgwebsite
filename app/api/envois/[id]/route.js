import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { jobsDeplacementActif, peutGererJobsDeplacement } from "@/lib/envois";
import { STATUTS_EMPLOYE } from "@/lib/statutsEnvoi";
import { notifier } from "@/lib/notifications";

// Change l'étape d'un envoi. L'employé à qui il est adressé avance ses
// propres envois (Vu → En route → Sur place → Terminé) ; le bureau
// (section Jobs en déplacement) peut aussi l'annuler.
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });
  if (!(await jobsDeplacementActif())) return NextResponse.json({ erreur: "Le module Jobs en déplacement est désactivé." }, { status: 403 });

  const { statut } = await request.json().catch(() => ({}));
  const envoi = await prisma.envoiBon.findUnique({ where: { id: params.id } });
  if (!envoi) return NextResponse.json({ erreur: "Envoi introuvable." }, { status: 404 });
  if (envoi.statut === "ANNULE" || envoi.statut === "TERMINE") {
    return NextResponse.json({ erreur: "Cet envoi est déjà fermé." }, { status: 400 });
  }

  if (statut === "ANNULE") {
    if (!(await peutGererJobsDeplacement(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  } else if (STATUTS_EMPLOYE.includes(statut)) {
    if (envoi.employeId !== session.id) return NextResponse.json({ erreur: "Cette tâche ne t'est pas adressée." }, { status: 403 });
  } else {
    return NextResponse.json({ erreur: "Étape invalide." }, { status: 400 });
  }

  const maintenant = new Date();
  const maj = await prisma.envoiBon.update({
    where: { id: envoi.id },
    data: {
      statut,
      vuLe: envoi.vuLe || (statut !== "ANNULE" ? maintenant : null),
      termineLe: statut === "TERMINE" || statut === "ANNULE" ? maintenant : null,
    },
  });
  if (statut === "TERMINE") {
    after(async () => {
      const bon = await prisma.bonTravail.findUnique({ where: { id: envoi.bonId }, select: { id: true, numero: true, client: { select: { nom: true } } } });
      await notifier("BON_TERMINE", {
        sauf: [session.id],
        titre: `✅ Job terminée — bon #${bon.numero}`,
        corps: `${session.nom} a terminé · ${bon.client.nom}`,
        url: `/bons/${bon.id}`,
        tag: `termine-${bon.id}`,
      });
    });
  }
  return NextResponse.json(maj);
}
