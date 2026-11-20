import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur, bailComplet, reponseFichier } from "@/lib/immobilier";
import { obtenirInfosEntreprise } from "@/lib/config";
import { releveCompte } from "@/lib/pdfImmobilier";
import { envoyerReleve } from "@/lib/immobilierCourriel";

// GET : relevé de compte du bail en PDF (12 derniers mois)
export async function GET(request, props) {
  if (!(await sessionImmo())) return refus();
  const { id } = await props.params;
  const bail = await bailComplet(id);
  if (!bail) return erreur("Bail introuvable.", 404);
  const donnees = await releveCompte(bail, await obtenirInfosEntreprise());
  return reponseFichier({ nom: `Releve-de-compte-${new Date().toISOString().slice(0, 10)}.pdf`, typeMime: "application/pdf", taille: donnees.length, donnees }, request);
}

// POST : l'envoie par courriel aux locataires
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const r = await envoyerReleve(id, session.nom);
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, ...r }, { status: r.envoyes ? 200 : 502 });
}
