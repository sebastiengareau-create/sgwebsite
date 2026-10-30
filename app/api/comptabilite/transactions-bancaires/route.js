import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { importerReleve, erreurPourReponse } from "@/lib/transactionsBancaires";

const TAILLE_MAX = 5 * 1024 * 1024;

// Importe un fichier de relevé (OFX/QFX/QBO/CSV) dans un compte de trésorerie
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const formData = await request.formData();
  const fichier = formData.get("fichier");
  const compteTresorerieId = formData.get("compteTresorerieId");
  if (!fichier || typeof fichier === "string") return NextResponse.json({ erreur: "Choisis un fichier." }, { status: 400 });
  if (!compteTresorerieId) return NextResponse.json({ erreur: "Choisis un compte." }, { status: 400 });
  if (fichier.size > TAILLE_MAX) return NextResponse.json({ erreur: "Fichier trop volumineux (5 Mo maximum)." }, { status: 400 });

  try {
    const resultat = await importerReleve({
      compteTresorerieId,
      octets: Buffer.from(await fichier.arrayBuffer()),
      nomFichier: fichier.name,
      numeroCompte: formData.get("numeroCompte") || null,
      nomUtilisateur: session.nom,
    });
    return NextResponse.json(resultat);
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
