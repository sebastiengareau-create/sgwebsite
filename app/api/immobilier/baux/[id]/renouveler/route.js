import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionImmo, refus, erreur, normaliserModele } from "@/lib/immobilier";
import { datesRenouvellement } from "@/lib/immobilierCalculs";

// Renouvelle un bail : le bail actuel passe à « Terminé » et un nouveau bail
// commence le lendemain de sa fin, avec les mêmes locataires, services et
// jour de paiement. Corps : { loyer, dateDebut, dateFin } (par défaut :
// nouveau loyer proposé, même durée).
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const bail = await prisma.bailImmo.findUnique({ where: { id }, include: { locataires: { select: { id: true } } } });
  if (!bail) return erreur("Bail introuvable.", 404);
  if (bail.statut !== "ACTIF") return erreur("Seul un bail en cours se renouvelle.");
  if (!bail.dateFin) return erreur("Un bail à durée indéterminée ne se renouvelle pas : modifie son loyer.");
  const body = await request.json().catch(() => ({}));
  const defaut = datesRenouvellement(bail);
  const r = normaliserModele("bail", {
    logementId: bail.logementId,
    dateDebut: body.dateDebut || defaut.dateDebut.toISOString(),
    dateFin: body.dateFin === "" ? "" : body.dateFin || defaut.dateFin.toISOString(),
    loyer: body.loyer ?? bail.nouveauLoyer ?? bail.loyer,
  }, { creation: true });
  if (r.erreur) return erreur(r.erreur);
  const nouveau = await prisma.$transaction(async (tx) => {
    await tx.bailImmo.update({ where: { id }, data: { statut: "TERMINE" } });
    return tx.bailImmo.create({
      data: {
        ...r.data, jourPaiement: bail.jourPaiement, services: bail.services,
        notes: `Renouvellement du bail précédent (loyer de ${bail.loyer.toFixed(2).replace(".", ",")} $).`,
        locataires: { connect: bail.locataires },
      },
    });
  });
  return NextResponse.json({ ok: true, id: nouveau.id });
}
