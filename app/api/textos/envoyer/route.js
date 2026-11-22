import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { envoyerTexto, textosActifs, lireReglagesTextos, ErreurTexto } from "@/lib/textosAuto";
import { numeroLisible, numeroE164 } from "@/lib/textos";

// Envoie un texto depuis l'appli (module Textos automatiques) :
// { telephone, corps, type, clientId?, bonId?, rendezVousId? }.
// type « MESSAGE » : réponse écrite dans une conversation (page Textos) ;
// les autres viennent des boutons « 💬 Texto » et exigent l'envoi direct
// (Paramètres → Textos automatiques).
const SECTIONS = ["operations", "clients", "calendrier", "pneus"];

export async function POST(request) {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });
  const acces = await Promise.all(SECTIONS.map((s) => aAccesSection(session, s)));
  if (!acces.some(Boolean)) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const { telephone, corps, type = "LIEN", clientId, bonId, rendezVousId } = await request.json().catch(() => ({}));
  if (!(await textosActifs())) return NextResponse.json({ erreur: "Les textos automatiques ne sont pas actifs." }, { status: 409 });
  if (type !== "MESSAGE" && !(await lireReglagesTextos()).envoiDirect) {
    return NextResponse.json({ erreur: "L'envoi depuis l'appli n'est pas actif (Paramètres → Textos automatiques)." }, { status: 409 });
  }

  try {
    const texto = await envoyerTexto({
      telephone, corps, type,
      clientId: typeof clientId === "string" ? clientId : null,
      bonId: typeof bonId === "string" ? bonId : null,
      rendezVousId: typeof rendezVousId === "string" ? rendezVousId : null,
      employe: session.role === "DEVELOPPEUR" ? { id: null, nom: session.nom } : { id: session.id, nom: session.nom },
    });
    // « Véhicule prêt » envoyé à la main : noté sur le bon, comme l'avis par courriel
    if (type === "VEHICULE_PRET" && texto.bonId) {
      await prisma.bonTravail.update({ where: { id: texto.bonId }, data: { avisPretLe: new Date(), avisPretA: `texto au ${numeroLisible(numeroE164(telephone))}` } }).catch(() => {});
    }
    return NextResponse.json({ texto: { id: texto.id, telephone: texto.telephone, corps: texto.corps, statut: texto.statut, creeLe: texto.creeLe } });
  } catch (e) {
    if (e instanceof ErreurTexto) return NextResponse.json({ erreur: e.message }, { status: e.statut });
    console.error("Texto non envoyé :", e);
    return NextResponse.json({ erreur: "Le texto n'a pas pu être envoyé." }, { status: 500 });
  }
}
