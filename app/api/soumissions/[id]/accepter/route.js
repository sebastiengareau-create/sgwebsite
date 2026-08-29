import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

// Découpe grossièrement un texte libre "Honda Civic 2019" en marque/modèle/année
function analyserVehicule(texte) {
  if (!texte) return { marque: "Véhicule", modele: "", annee: null };
  const mots = texte.trim().split(/\s+/);
  const dernier = mots[mots.length - 1];
  const anneeTrouvee = /^\d{4}$/.test(dernier) ? Number(dernier) : null;
  const motsRestants = anneeTrouvee ? mots.slice(0, -1) : mots;
  return {
    marque: motsRestants[0] || "Véhicule",
    modele: motsRestants.slice(1).join(" ") || "",
    annee: anneeTrouvee,
  };
}

export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const soumission = await prisma.soumission.findUnique({
    where: { id: params.id },
    include: { taches: true },
  });
  if (!soumission) return NextResponse.json({ erreur: "Soumission introuvable." }, { status: 404 });
  if (soumission.bonId) {
    return NextResponse.json({ erreur: "Cette soumission a déjà été transformée en bon." }, { status: 409 });
  }

  // Client : réutilise celui déjà lié, sinon en crée un nouveau
  let clientId = soumission.clientId;
  if (!clientId) {
    const client = await prisma.client.create({
      data: { nom: soumission.clientNom, telephone: soumission.clientTelephone || null },
    });
    clientId = client.id;
  }

  const { marque, modele, annee } = analyserVehicule(soumission.vehiculeInfo);
  const vehicule = await prisma.vehicule.create({
    data: { marque, modele, annee, clientId },
  });

  const dernierBon = await prisma.bonTravail.findFirst({ orderBy: { numero: "desc" } });
  let prochainNum = 1;
  if (dernierBon) {
    const partieNum = parseInt(dernierBon.numero.split("-")[1], 10);
    if (!isNaN(partieNum)) prochainNum = partieNum + 1;
  }
  const numero = `2026-${String(1000 + prochainNum).slice(1)}`;

  const bon = await prisma.bonTravail.create({
    data: {
      numero,
      clientId,
      vehiculeId: vehicule.id,
      // Les pièces et le temps de la soumission n'étaient que des estimés —
      // seules les descriptions des tâches sont reprises ; le vrai suivi
      // (temps, pièces réellement utilisées) démarre à zéro sur le bon.
      problemes: { create: soumission.taches.map((t) => ({ description: t.description })) },
    },
  });

  await prisma.soumission.update({
    where: { id: soumission.id },
    data: { statut: "ACCEPTEE", bonId: bon.id },
  });

  return NextResponse.json({ bonId: bon.id, bonNumero: bon.numero });
}
