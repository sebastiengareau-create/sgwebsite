import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";

// Ouvre un fichier joint à un rendez-vous (depuis le calendrier ou le bon
// créé à partir du rendez-vous). Tout employé connecté, comme pour un bon.
export async function GET(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });

  const fichier = await prisma.fichierRendezVous.findUnique({ where: { id: params.id } });
  if (!fichier) {
    return NextResponse.json({ erreur: "Fichier introuvable — les fichiers sont effacés 12 mois après le rendez-vous." }, { status: 404 });
  }

  // Images et PDF s'ouvrent dans le navigateur ; les documents Word — ou
  // tout fichier avec ?telecharger=1 (bouton ⬇️) — se téléchargent
  const telecharger = new URL(request.url).searchParams.has("telecharger");
  const enLigne = !telecharger && (fichier.typeMime.startsWith("image/") || fichier.typeMime === "application/pdf");
  const nomAscii = fichier.nom.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "fichier";
  return new Response(fichier.donnees, {
    headers: {
      "Content-Type": fichier.typeMime,
      "Content-Length": String(fichier.taille),
      "Content-Disposition": `${enLigne ? "inline" : "attachment"}; filename="${nomAscii}"; filename*=UTF-8''${encodeURIComponent(fichier.nom)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
