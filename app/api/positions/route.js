import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { limitesJourQuebec } from "@/lib/temps";
import { STATUTS_ACTIFS } from "@/lib/statutsEnvoi";

const CONSERVATION_JOURS = 90;
const MAX_POINTS = 200; // par envoi du téléphone (il regroupe les points hors ligne)

function nombre(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Le téléphone de l'employé envoie ses positions, par petits paquets,
// pendant qu'il partage sa position dans « Mes tâches ».
export async function POST(request) {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });
  const employe = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true } });
  if (!employe) return NextResponse.json({ erreur: "Seul un compte employé peut partager sa position." }, { status: 403 });

  const { points, envoiId } = await request.json().catch(() => ({}));
  if (!Array.isArray(points) || points.length === 0) return NextResponse.json({ ok: true, enregistres: 0 });

  // Rattaché à l'envoi seulement s'il est bien à cet employé et encore actif
  const envoi = envoiId
    ? await prisma.envoiBon.findFirst({ where: { id: envoiId, employeId: employe.id, statut: { in: STATUTS_ACTIFS } }, select: { id: true } })
    : null;

  const maintenant = Date.now();
  const donnees = points.slice(0, MAX_POINTS).map((p) => ({
    latitude: nombre(p?.lat), longitude: nombre(p?.lng), precision: nombre(p?.precision), vitesse: nombre(p?.vitesse), t: nombre(p?.t),
  })).filter((p) =>
    p.latitude !== null && Math.abs(p.latitude) <= 90 &&
    p.longitude !== null && Math.abs(p.longitude) <= 180 &&
    p.t !== null && p.t <= maintenant + 5 * 60000 && p.t >= maintenant - 24 * 3600000 &&
    (p.precision === null || p.precision <= 1000)
  ).map(({ t, ...p }) => ({ ...p, employeId: employe.id, envoiId: envoi?.id || null, enregistreLe: new Date(t) }));

  if (donnees.length > 0) await prisma.positionGps.createMany({ data: donnees });
  await prisma.positionGps.deleteMany({
    where: { employeId: employe.id, enregistreLe: { lt: new Date(maintenant - CONSERVATION_JOURS * 86400000) } },
  });
  return NextResponse.json({ ok: true, enregistres: donnees.length });
}

// Gérant seulement.
//   ?employeId=…&date=AAAA-MM-JJ → trajet de l'employé cette journée-là
//   (sans paramètre)             → dernière position de chacun (24 h)
export async function GET(request) {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const employeId = searchParams.get("employeId");
  const date = searchParams.get("date");

  if (employeId) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return NextResponse.json({ erreur: "Date invalide." }, { status: 400 });
    const { debut, fin } = limitesJourQuebec(date);
    const points = await prisma.positionGps.findMany({
      where: { employeId, enregistreLe: { gte: debut, lte: fin } },
      orderBy: { enregistreLe: "asc" },
      select: { latitude: true, longitude: true, precision: true, vitesse: true, enregistreLe: true, envoi: { select: { bon: { select: { numero: true } } } } },
    });
    return NextResponse.json({ points });
  }

  const dernieres = await prisma.positionGps.findMany({
    where: { enregistreLe: { gte: new Date(Date.now() - 24 * 3600000) } },
    orderBy: [{ employeId: "asc" }, { enregistreLe: "desc" }],
    distinct: ["employeId"],
    select: { employeId: true, latitude: true, longitude: true, precision: true, enregistreLe: true, employe: { select: { nom: true } } },
  });
  return NextResponse.json({ dernieres });
}
