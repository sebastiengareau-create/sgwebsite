import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesFeuillesTemps, journaliser, chargerFeuillesTemps } from "@/lib/quarts";
import { dateAujourdhuiQuebec } from "@/lib/temps";

const FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const montant = (n) => `${(Number(n) || 0).toFixed(2)} $`;

// Période de feuille de temps : approuver et verrouiller, rouvrir, ou
// inscrire la prime d'un employé. Tout est consigné au journal.
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await accesFeuillesTemps(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const { debut, fin, action, employeId, prime, raison } = await request.json();
  if (!FORMAT.test(debut || "") || !FORMAT.test(fin || "") || fin < debut) {
    return NextResponse.json({ erreur: "Période invalide." }, { status: 400 });
  }
  const cle = { debut_fin: { debut, fin } };
  const periode = await prisma.periodeTemps.findUnique({ where: cle });
  const verrouillee = periode?.statut === "VERROUILLEE";

  if (action === "verrouiller") {
    if (verrouillee) return NextResponse.json({ ok: true });
    if (fin >= dateAujourdhuiQuebec()) return NextResponse.json({ erreur: "La période n'est pas terminée : elle se verrouille à partir du lendemain de sa dernière journée." }, { status: 409 });
    // Une autre période verrouillée ne doit pas chevaucher celle-ci
    const chevauche = await prisma.periodeTemps.findFirst({ where: { statut: "VERROUILLEE", debut: { lte: fin }, fin: { gte: debut } } });
    if (chevauche) return NextResponse.json({ erreur: `Une période déjà verrouillée (${chevauche.debut} au ${chevauche.fin}) chevauche celle-ci.` }, { status: 409 });
    const { feuilles } = await chargerFeuillesTemps(debut, fin);
    const bloquees = feuilles.filter((f) => f.nbBloquantes > 0);
    if (bloquees.length > 0) {
      return NextResponse.json({ erreur: `À corriger avant de verrouiller (départ non pointé, chevauchement) : ${bloquees.map((f) => f.employe.nom).join(", ")}.` }, { status: 409 });
    }
    await prisma.$transaction(async (tx) => {
      const donnees = { statut: "VERROUILLEE", approuvePar: session.nom, approuveLe: new Date() };
      await tx.periodeTemps.upsert({ where: cle, update: donnees, create: { debut, fin, ...donnees } });
      await journaliser(session, { jour: debut, action: "VERROUILLAGE", nouvelle: `Période du ${debut} au ${fin} approuvée et verrouillée` }, tx);
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "rouvrir") {
    if (!verrouillee) return NextResponse.json({ ok: true });
    if (!String(raison || "").trim()) return NextResponse.json({ erreur: "Inscris la raison de la réouverture." }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      await tx.periodeTemps.update({ where: cle, data: { statut: "OUVERTE", approuvePar: null, approuveLe: null } });
      await journaliser(session, { jour: debut, action: "REOUVERTURE", ancienne: `Période du ${debut} au ${fin} verrouillée par ${periode.approuvePar || "?"}`, raison: String(raison).trim() }, tx);
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "prime") {
    if (verrouillee) return NextResponse.json({ erreur: "Cette période est verrouillée." }, { status: 409 });
    const valeur = Math.round((Number(prime) || 0) * 100) / 100;
    if (valeur < 0) return NextResponse.json({ erreur: "Prime invalide." }, { status: 400 });
    const employe = await prisma.user.findUnique({ where: { id: employeId || "" }, select: { id: true, nom: true } });
    if (!employe) return NextResponse.json({ erreur: "Employé introuvable." }, { status: 404 });
    const primes = { ...(periode?.primes || {}) };
    const avant = Number(primes[employe.id]) || 0;
    if (avant === valeur) return NextResponse.json({ ok: true });
    if (valeur > 0) primes[employe.id] = valeur; else delete primes[employe.id];
    await prisma.$transaction(async (tx) => {
      await tx.periodeTemps.upsert({ where: cle, update: { primes }, create: { debut, fin, primes } });
      await journaliser(session, { employe, jour: debut, action: "PRIME", ancienne: montant(avant), nouvelle: montant(valeur) }, tx);
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erreur: "Action inconnue." }, { status: 400 });
}
