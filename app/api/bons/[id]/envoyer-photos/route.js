import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { envoyerPhotosTaches } from "@/lib/avisClient";
import { CLIENT } from "@/lib/client";

// Envoie au client, par courriel, les photos prises pendant les tâches du bon
// (profil envoiPhotosCourriel) — au choix, depuis un bon facturé.
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (!CLIENT.envoiPhotosCourriel) {
    return NextResponse.json({ erreur: "Fonction non offerte." }, { status: 404 });
  }

  const { courriel } = await request.json().catch(() => ({}));
  const bon = await prisma.bonTravail.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      vehicule: true,
      problemes: { orderBy: { id: "asc" }, include: { photos: { orderBy: { ajouteeLe: "asc" } } } },
    },
  });
  if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });

  const photos = bon.problemes.flatMap((pr) => pr.photos.map((p) => ({ url: p.url, tache: pr.description })));
  if (photos.length === 0) return NextResponse.json({ erreur: "Aucune photo sur les tâches de ce bon." }, { status: 400 });

  const destinataire = String(courriel || "").trim() || bon.client.courriel;
  if (!destinataire) {
    return NextResponse.json({ erreur: "Aucun courriel — le client n'en a pas au dossier, ou entre-en un manuellement." }, { status: 400 });
  }
  try {
    const nombre = await envoyerPhotosTaches(bon, photos, destinataire);
    return NextResponse.json({ ok: true, destinataire, nombre });
  } catch (e) {
    return NextResponse.json({ erreur: "Échec de l'envoi : " + e.message }, { status: 500 });
  }
}
