import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { CLE, lireSites, domaine, texteVehicule } from "@/lib/recherchePieces";
import { estVr } from "@/lib/client";

// Recherche poussée d'une pièce sur le web pour le véhicule d'un bon : l'IA
// (Gemini, avec la recherche Google) cherche les numéros de pièce et où les
// trouver, en priorité chez les fournisseurs réglés dans Paramètres.

const LONGUEUR_MAX_PIECE = 150;
const DELAI_NHTSA_MS = 5000;

// Détails du NIV utiles pour les pièces (moteur, traction…) — la NHTSA
// décode aussi les véhicules vendus au Canada. null si indisponible.
async function detailsNiv(niv) {
  if (!niv || niv.length !== 17) return null;
  try {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${niv}?format=json`, {
      signal: AbortSignal.timeout(DELAI_NHTSA_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const r = (await res.json())?.Results?.[0];
    if (!r || !r.Make) return null;
    const champs = [
      ["Année", r.ModelYear],
      ["Marque", r.Make],
      ["Modèle", r.Model],
      ["Version", [r.Trim, r.Series].filter(Boolean).join(" ")],
      ["Carrosserie", r.BodyClass],
      ["Moteur", [r.DisplacementL && `${Number(r.DisplacementL).toFixed(1)} L`, r.EngineCylinders && `${r.EngineCylinders} cyl.`, r.EngineModel, r.EngineConfiguration].filter(Boolean).join(", ")],
      ["Carburant", r.FuelTypePrimary],
      ["Transmission", r.TransmissionStyle],
      ["Traction", r.DriveType],
      ["Fabricant du châssis", r.Manufacturer],
      ["Usine", [r.PlantCity, r.PlantCountry].filter(Boolean).join(", ")],
    ];
    return champs.filter(([, v]) => v && String(v).trim()).map(([k, v]) => `${k} : ${String(v).trim()}`).join("\n");
  } catch {
    return null;
  }
}

export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non authentifié." }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ erreur: "La recherche par IA n'est pas configurée (clé API manquante). Les liens vers les sites restent offerts." }, { status: 503 });
  }

  const { piece } = await request.json().catch(() => ({}));
  const recherche = String(piece || "").trim();
  if (!recherche) return NextResponse.json({ erreur: "Indique la pièce recherchée." }, { status: 400 });
  if (recherche.length > LONGUEUR_MAX_PIECE) return NextResponse.json({ erreur: `Recherche trop longue (${LONGUEUR_MAX_PIECE} caractères maximum).` }, { status: 400 });

  const bon = await prisma.bonTravail.findUnique({ where: { id: params.id }, include: { vehicule: true } });
  if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });
  const v = bon.vehicule;
  if (!v || !(v.niv || (v.marque && v.modele))) {
    return NextResponse.json({ erreur: "Le bon n'a pas de véhicule précisé (au moins marque et modèle, ou le NIV)." }, { status: 400 });
  }

  const ligneSites = await prisma.parametre.findUnique({ where: { cle: CLE } });
  const sites = lireSites(ligneSites?.valeur);
  const listeSites = sites.map((s) => `- ${s.nom} (${domaine(s.url) || s.url})`).join("\n");
  const decodage = await detailsNiv(v.niv);

  const consigne = `Tu es un commis aux pièces d'expérience dans un garage ${estVr ? "de véhicules récréatifs (VR)" : "automobile"} au Québec. Réponds en français, de façon concise.

Véhicule du client :
${texteVehicule(v) || "(non précisé)"}${v.niv ? `\nNIV : ${v.niv}` : ""}${decodage ? `\n\nDécodage du NIV (NHTSA) :\n${decodage}` : ""}

Pièce recherchée : ${recherche}

Fournisseurs habituels du garage (cherche d'abord sur ces sites) :
${listeSites || "(aucun)"}

Fais une recherche sur le web, puis donne :
1. Les précisions qui changent la pièce pour ce véhicule (moteur, traction, avant/arrière, version, date de fabrication…) et ce qu'il faut vérifier sur le véhicule s'il y a plusieurs possibilités.
2. Les numéros de pièce trouvés, sous forme de liste à puces : **marque et numéro** — description courte — fournisseur où il est offert (et le prix si tu l'as vu). Inclus le numéro d'origine (OEM) si tu le trouves.
3. Au besoin, une remarque utile (pièce souvent vendue en ensemble, pièces connexes à remplacer en même temps…).

Règles : n'invente JAMAIS un numéro de pièce ni un prix — donne seulement ceux vus dans tes résultats de recherche. Si tu n'es pas certain qu'un numéro convient à ce véhicule précis, dis-le. Si tu ne trouves rien de fiable, dis-le simplement. Pas de tableau, pas de titres Markdown : du texte court et des puces.`;

  const modele = process.env.GEMINI_MODEL_PIECES || "gemini-flash-latest";
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: consigne }] }],
        tools: [{ google_search: {} }],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) {
        return NextResponse.json({ erreur: "Trop de recherches en peu de temps (limite du plan gratuit) — attends environ une minute avant de réessayer." }, { status: 429 });
      }
      const detail = await res.text().catch(() => "");
      throw new Error(`GEMINI_HTTP_${res.status}:${detail.slice(0, 300)}`);
    }
    const data = await res.json();
    const candidat = data.candidates?.[0];
    const texte = (candidat?.content?.parts || []).map((p) => p.text || "").join("").trim();

    // Pages consultées par la recherche Google (liens vérifiables)
    const sources = [];
    for (const morceau of candidat?.groundingMetadata?.groundingChunks || []) {
      const uri = morceau.web?.uri;
      if (typeof uri === "string" && /^https:\/\//.test(uri) && !sources.some((s) => s.url === uri)) {
        sources.push({ url: uri, titre: String(morceau.web.title || "Source").slice(0, 80) });
      }
    }

    return NextResponse.json({
      reponse: texte || "Aucun résultat fiable trouvé pour cette pièce.",
      sources: sources.slice(0, 10),
      decodage: decodage || null,
    });
  } catch (e) {
    console.error("Erreur recherche de pièces:", e);
    return NextResponse.json({ erreur: "La recherche a rencontré une erreur. Réessaie dans un instant." }, { status: 500 });
  }
}
