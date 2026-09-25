import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { nettoyerNiv, validerNiv, anneeDepuisNiv } from "@/lib/vehicules";
import { cleMarque, nomMarque, marqueDepuisNiv, modeleCanonique } from "@/lib/catalogueVehicules";

// Décode un NIV pour préremplir le dossier véhicule :
//
//   GET /api/vehicules/niv?niv=2HGFC2F59KH000000
//   → { niv, avertissement?, annee, marque, modele, version, source: "NHTSA" | "local" }
//
// Interroge d'abord le décodeur public de la NHTSA (gratuit, sans clé) pour
// le modèle et la version ; s'il ne répond pas, on se rabat sur ce que le NIV
// dit à lui seul (année au 10e caractère, constructeur aux 3 premiers).
const DELAI_NHTSA_MS = 5000;

export async function GET(request) {
  const cleRecue = request.headers.get("x-webhook-secret");
  const cleAttendue = process.env.GARAGE_BOOKING_WEBHOOK_SECRET;
  const parCle = !!cleAttendue && cleRecue === cleAttendue;
  if (!parCle && !(await obtenirSession())) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  const niv = nettoyerNiv(new URL(request.url).searchParams.get("niv"));
  const verif = validerNiv(niv);
  if (!niv || verif.erreur) {
    return NextResponse.json({ erreur: verif.erreur || "NIV manquant." }, { status: 400 });
  }

  const local = { annee: anneeDepuisNiv(niv), marque: marqueDepuisNiv(niv), modele: null, version: null };
  const distant = await decoderNhtsa(niv);
  const resultat = distant
    ? {
        annee: distant.annee || local.annee,
        marque: distant.marque || local.marque,
        modele: distant.modele,
        version: distant.version,
        source: "NHTSA",
      }
    : { ...local, source: "local" };

  return NextResponse.json({ niv, avertissement: verif.avertissement || null, ...resultat });
}

async function decoderNhtsa(niv) {
  try {
    const reponse = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${niv}?format=json`, {
      signal: AbortSignal.timeout(DELAI_NHTSA_MS),
      cache: "no-store",
    });
    if (!reponse.ok) return null;
    const r = (await reponse.json())?.Results?.[0];
    if (!r || !r.Make) return null;
    const cle = cleMarque(r.Make);
    const marque = cle ? nomMarque(cle) : r.Make;
    const annee = Number(r.ModelYear) || null;
    return {
      annee,
      marque,
      modele: r.Model ? modeleCanonique(marque, r.Model) : null,
      version: [r.Trim, r.Series].map((v) => (v || "").trim()).find(Boolean) || null,
    };
  } catch {
    return null;
  }
}
