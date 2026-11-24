import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { CLE_PRIX_SAISON, CLE_PLAN, CLE_SEUILS, CLE_CONDITIONS, refusPneus, lireReglagesPneus } from "@/lib/pneus";
import { normaliserPlan, normaliserSeuils } from "@/lib/pneusCalculs";

// Réglages de l'entreposage de pneus, chacun facultatif : { prixSaison
// (vide : aucune ligne ajoutée au bon), plan ({ rangees }), seuils (usure et
// âge), conditions (texte du reçu ; vide : le texte par défaut) }. Réservé à
// l'accès « Paramètres ». → tous les réglages
export async function PUT(request) {
  const session = await obtenirSession();
  const refus = await refusPneus(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  if (!(await aAccesSection(session, "parametres"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const corps = await request.json().catch(() => ({}));
  const ecrire = [];
  const garder = (cle, valeur) => ecrire.push(prisma.parametre.upsert({ where: { cle }, update: { valeur }, create: { cle, valeur } }));

  if ("prixSaison" in corps) {
    const texte = String(corps.prixSaison ?? "").replace(/\s/g, "").replace(",", ".");
    const prix = texte === "" ? null : Number(texte);
    if (prix !== null && !(Number.isFinite(prix) && prix >= 0 && prix <= 10000)) return NextResponse.json({ erreur: "Prix invalide." }, { status: 400 });
    garder(CLE_PRIX_SAISON, prix === null ? "" : String(Math.round(prix * 100) / 100));
  }
  if ("plan" in corps) {
    const { plan, erreur } = normaliserPlan(corps.plan);
    if (erreur) return NextResponse.json({ erreur }, { status: 400 });
    garder(CLE_PLAN, JSON.stringify(plan));
  }
  if ("seuils" in corps) {
    const { seuils, erreur } = normaliserSeuils(corps.seuils);
    if (erreur) return NextResponse.json({ erreur }, { status: 400 });
    garder(CLE_SEUILS, JSON.stringify(seuils));
  }
  if ("conditions" in corps) garder(CLE_CONDITIONS, String(corps.conditions ?? "").trim().slice(0, 3000));

  await prisma.$transaction(ecrire);
  return NextResponse.json(await lireReglagesPneus());
}
