import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesPaieActif } from "@/lib/accesPaie";
import { versEnregistrement, versFormulaire, partiesDuReleve, verifier } from "@/lib/releveEmploi";

// PUT : enregistre le formulaire (brouillon seulement) → { releve, erreurs }
// PATCH : { transmis: true, numeroSerie } marque le relevé transmis à RE Web ;
//         { transmis: false } le remet en brouillon
// DELETE : supprime un brouillon
async function charger(props) {
  const session = await obtenirSession();
  if (!(await accesPaieActif(session))) return { reponse: NextResponse.json({ erreur: "Accès refusé." }, { status: 403 }) };
  const { id } = await props.params;
  const releve = await prisma.releveEmploi.findUnique({ where: { id } });
  if (!releve) return { reponse: NextResponse.json({ erreur: "Relevé introuvable." }, { status: 404 }) };
  return { session, releve };
}

export async function PUT(request, props) {
  const { reponse, releve } = await charger(props);
  if (reponse) return reponse;
  if (releve.statut === "TRANSMIS") return NextResponse.json({ erreur: "Ce relevé est déjà transmis : remets-le en brouillon pour le modifier (une modification se fait aussi dans RE Web)." }, { status: 409 });
  const formulaire = await request.json().catch(() => null);
  if (!formulaire || typeof formulaire !== "object") return NextResponse.json({ erreur: "Formulaire illisible." }, { status: 400 });
  const donnees = versEnregistrement(formulaire);
  for (const cle of ["premierJour", "dernierJourPaye", "finDernierePeriode"]) {
    if (!donnees[cle]) return NextResponse.json({ erreur: "Les trois dates (B10, B11, B12) sont requises." }, { status: 400 });
  }
  const maj = await prisma.releveEmploi.update({ where: { id: releve.id }, data: donnees });
  const f = versFormulaire(maj);
  return NextResponse.json({ releve: f, erreurs: verifier(f, await partiesDuReleve(maj.employeId)) });
}

export async function PATCH(request, props) {
  const { reponse, releve } = await charger(props);
  if (reponse) return reponse;
  const { transmis, numeroSerie } = await request.json().catch(() => ({}));
  if (transmis) {
    const serie = String(numeroSerie || "").trim().toUpperCase();
    if (serie && !/^[WM]\d{8}$/.test(serie)) return NextResponse.json({ erreur: "Numéro de série de RE Web : une lettre (W ou M) et 8 chiffres." }, { status: 400 });
    const maj = await prisma.releveEmploi.update({ where: { id: releve.id }, data: { statut: "TRANSMIS", transmisLe: new Date(), numeroSerie: serie || null } });
    return NextResponse.json({ releve: versFormulaire(maj) });
  }
  const maj = await prisma.releveEmploi.update({ where: { id: releve.id }, data: { statut: "BROUILLON", transmisLe: null } });
  return NextResponse.json({ releve: versFormulaire(maj) });
}

export async function DELETE(request, props) {
  const { reponse, releve } = await charger(props);
  if (reponse) return reponse;
  if (releve.statut === "TRANSMIS") return NextResponse.json({ erreur: "Un relevé transmis ne se supprime pas." }, { status: 409 });
  await prisma.releveEmploi.delete({ where: { id: releve.id } });
  return NextResponse.json({ ok: true });
}
