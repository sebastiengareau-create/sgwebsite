import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, hashPassword, estGerantOuDev } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!session || !estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json();
  const data = {};

  if (body.nom) data.nom = body.nom;
  if (body.courriel) {
    const existant = await prisma.user.findFirst({ where: { courriel: body.courriel, NOT: { id: params.id } } });
    if (existant) {
      return NextResponse.json({ erreur: "Ce courriel est déjà utilisé." }, { status: 409 });
    }
    data.courriel = body.courriel;
  }
  if (body.role && ["GERANT", "SECRETAIRE", "MECANICIEN"].includes(body.role)) data.role = body.role;
  if (typeof body.actif === "boolean") {
    if (params.id === session.id && body.actif === false) {
      return NextResponse.json({ erreur: "Tu ne peux pas désactiver ton propre compte." }, { status: 400 });
    }
    data.actif = body.actif;
  }
  if (body.motDePasse) {
    if (body.motDePasse.length < 4 || body.motDePasse.length > 12) {
      return NextResponse.json({ erreur: "Le mot de passe doit avoir entre 4 et 12 caractères." }, { status: 400 });
    }
    data.motDePasse = await hashPassword(body.motDePasse);
  }
  if (body.typeRemuneration && ["HORAIRE", "SALAIRE"].includes(body.typeRemuneration)) data.typeRemuneration = body.typeRemuneration;
  if (body.tauxHoraireEmploye !== undefined) data.tauxHoraireEmploye = body.tauxHoraireEmploye === "" ? null : Number(body.tauxHoraireEmploye);
  if (body.salaireAnnuel !== undefined) data.salaireAnnuel = body.salaireAnnuel === "" ? null : Number(body.salaireAnnuel);
  if (body.frequencePaie && ["HEBDOMADAIRE", "BIHEBDOMADAIRE", "BIMENSUEL", "MENSUEL"].includes(body.frequencePaie)) data.frequencePaie = body.frequencePaie;
  if (body.tauxVacances !== undefined && body.tauxVacances !== "") data.tauxVacances = Number(body.tauxVacances);
  if (body.telephone !== undefined) data.telephone = body.telephone || null;
  if (body.adresse !== undefined) data.adresse = body.adresse || null;
  if (body.assignation !== undefined) data.assignation = body.assignation || null;
  if (body.dateEmbauche !== undefined) data.dateEmbauche = body.dateEmbauche ? new Date(body.dateEmbauche) : null;
  if (body.numeroEmploye !== undefined) {
    const valeur = body.numeroEmploye || null;
    if (valeur) {
      const existant = await prisma.user.findFirst({ where: { numeroEmploye: valeur, NOT: { id: params.id } } });
      if (existant) {
        return NextResponse.json({ erreur: "Ce numéro d'employé est déjà utilisé." }, { status: 409 });
      }
    }
    data.numeroEmploye = valeur;
  }

  if (body.accesSections !== undefined) {
    // Réservé au développeur ou à un gérant avec le statut super-admin —
    // un gérant "normal" ne peut pas s'octroyer/octroyer des accès étendus
    let autorise = session.role === "DEVELOPPEUR";
    if (!autorise) {
      const moi = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
      autorise = moi?.estSuperAdmin || false;
    }
    if (!autorise) return NextResponse.json({ erreur: "Seul le super-administrateur peut modifier les accès." }, { status: 403 });
    data.accesSections = body.accesSections;
  }

  await prisma.user.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!session || !estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (params.id === session.id) {
    return NextResponse.json({ erreur: "Tu ne peux pas supprimer ton propre compte." }, { status: 400 });
  }

  const [entrees, photos] = await Promise.all([
    prisma.entreeTemps.count({ where: { employeId: params.id } }),
    prisma.photo.count({ where: { employeId: params.id } }),
  ]);

  if (entrees > 0 || photos > 0) {
    return NextResponse.json(
      { erreur: "Cet employé a un historique (temps travaillé ou photos ajoutées) — désactive-le plutôt que de le supprimer, pour ne pas perdre ces données." },
      { status: 409 }
    );
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
