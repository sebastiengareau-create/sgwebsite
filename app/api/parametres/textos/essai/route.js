import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { envoyerTexto, ErreurTexto } from "@/lib/textosAuto";

// Texto d'essai à un numéro choisi : { telephone }
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { telephone } = await request.json().catch(() => ({}));
  const { nomEntreprise } = await obtenirInfosEntreprise();
  try {
    const texto = await envoyerTexto({
      telephone, type: "ESSAI",
      corps: `Essai des textos automatiques${nomEntreprise ? ` de ${nomEntreprise}` : ""} : tout fonctionne.`,
      employe: session.role === "DEVELOPPEUR" ? { id: null, nom: session.nom } : { id: session.id, nom: session.nom },
    });
    return NextResponse.json({ texto: { id: texto.id, telephone: texto.telephone, statut: texto.statut } });
  } catch (e) {
    if (e instanceof ErreurTexto) return NextResponse.json({ erreur: e.message }, { status: e.statut });
    console.error("Texto d'essai non envoyé :", e);
    return NextResponse.json({ erreur: "Le texto n'a pas pu être envoyé." }, { status: 500 });
  }
}
