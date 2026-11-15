import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { creerAvecNumero } from "@/lib/numerotation";
import { sessionElevage, normaliserSaillie, normaliserVelage, statutSaillieValide, verifierPere, prochainNumeroBete } from "@/lib/elevage";
import { genetiqueVeau } from "@/lib/elevageCalculs";

// Saillie ou insémination d'une femelle
export async function POST(request, props) {
  const params = await props.params;
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const femelle = await prisma.bete.findUnique({ where: { id: params.id }, select: { id: true, sexe: true } });
  if (!femelle) return NextResponse.json({ erreur: "Bête introuvable." }, { status: 404 });
  if (femelle.sexe !== "FEMELLE") return NextResponse.json({ erreur: "Seule une femelle peut être saillie." }, { status: 400 });
  const saillie = normaliserSaillie(await request.json());
  if (saillie.erreur) return NextResponse.json({ erreur: saillie.erreur }, { status: 400 });
  const taureau = await verifierPere(saillie.data.taureauId, femelle.id);
  if (taureau.erreur) return NextResponse.json({ erreur: taureau.erreur.replace("Le père", "Le géniteur").replace("Père", "Taureau") }, { status: 400 });
  await prisma.saillie.create({ data: { ...saillie.data, femelleId: femelle.id, creePar: session.nom } });
  return NextResponse.json({ ok: true });
}

// PATCH ?saillieId=… — { statut } : à confirmer, gestante ou non gestante ;
// { velage: { date, sexe, nom, poids } } : crée la fiche du veau (mère, père
// et génétique repris de la saillie) et marque la saillie vêlée
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const saillieId = new URL(request.url).searchParams.get("saillieId");
  const saillie = await prisma.saillie.findFirst({
    where: { id: saillieId || "", femelleId: params.id },
    include: { femelle: { select: { pourcentageWagyu: true } }, taureau: { select: { pourcentageWagyu: true } } },
  });
  if (!saillie) return NextResponse.json({ erreur: "Saillie introuvable." }, { status: 404 });
  const body = await request.json();

  if (body.velage) {
    if (saillie.veauId) return NextResponse.json({ erreur: "Le veau de cette saillie est déjà inscrit." }, { status: 409 });
    const velage = normaliserVelage(body.velage);
    if (velage.erreur) return NextResponse.json({ erreur: velage.erreur }, { status: 400 });
    if (velage.data.dateNaissance <= saillie.date) return NextResponse.json({ erreur: "Le vêlage doit venir après la saillie." }, { status: 400 });
    const veau = await creerAvecNumero(prochainNumeroBete, (numero) => prisma.$transaction(async (tx) => {
      const cree = await tx.bete.create({
        data: {
          ...velage.data, ...genetiqueVeau(saillie.femelle, saillie.taureau), numero, origine: "NEE_ICI",
          mereId: saillie.femelleId, pereId: saillie.taureauId, pere: saillie.semence, creePar: session.nom,
          ...(velage.poids && { pesees: { create: { date: velage.data.dateNaissance, poids: velage.poids, note: "À la naissance" } } }),
        },
      });
      await tx.saillie.update({ where: { id: saillie.id }, data: { statut: "VELEE", veauId: cree.id } });
      return cree;
    }));
    return NextResponse.json({ ok: true, veauId: veau.id, numero: veau.numero });
  }

  if (!statutSaillieValide(body.statut)) return NextResponse.json({ erreur: "Statut invalide." }, { status: 400 });
  if (saillie.veauId) return NextResponse.json({ erreur: "Cette saillie a donné un veau — retire d'abord sa fiche si elle est entrée par erreur." }, { status: 409 });
  await prisma.saillie.update({ where: { id: saillie.id }, data: { statut: body.statut } });
  return NextResponse.json({ ok: true });
}

// DELETE ?saillieId=… — la fiche du veau, s'il y en a une, reste
export async function DELETE(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const saillieId = new URL(request.url).searchParams.get("saillieId");
  const { count } = await prisma.saillie.deleteMany({ where: { id: saillieId || "", femelleId: params.id } });
  if (count === 0) return NextResponse.json({ erreur: "Saillie introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
