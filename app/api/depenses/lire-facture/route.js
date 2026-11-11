import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { lireFacture } from "@/lib/lectureFacture";

// Lit une facture de fournisseur (photo ou PDF) et retourne de quoi remplir
// le formulaire « Nouvelle dépense » — voir lib/lectureFacture.js. Rien
// n'est enregistré ici.
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const formulaire = await request.formData().catch(() => null);
  const fichier = formulaire?.get("fichier");
  if (!fichier || typeof fichier === "string") return NextResponse.json({ erreur: "Fichier manquant." }, { status: 400 });

  const [fournisseurs, categories] = await Promise.all([
    prisma.fournisseur.findMany({ where: { actif: true }, select: { id: true, nom: true } }),
    prisma.categorieDepense.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);

  try {
    const resultat = await lireFacture({
      tampon: Buffer.from(await fichier.arrayBuffer()),
      type: fichier.type,
      fournisseurs,
      categories,
      categorieDefautId: formulaire.get("categorieDefautId") || null,
    });
    return NextResponse.json(resultat);
  } catch (e) {
    if (e.message.startsWith("LECTURE:")) return NextResponse.json({ erreur: e.message.slice(8) }, { status: 422 });
    console.error("Lecture de facture :", e);
    return NextResponse.json({ erreur: "La lecture a échoué. Réessaie, ou entre la facture à la main." }, { status: 500 });
  }
}
