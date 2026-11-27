// Routes de la photo d'un immeuble ou d'un bâtiment (lib/photoBatiment.js) :
//   GET            → la photo gardée
//   GET ?vue=rue   → la vue de la rue de Google Street View, demandée à
//                    Google par le serveur (la clé reste ici), jamais gardée
//                    en base : les conditions de Google l'interdisent. Le
//                    navigateur la garde une semaine.
//   POST { dataUrl } → prend ou remplace la photo ; DELETE → la retire.
// La clé est celle de Google — adresses (lib/googlePlaces.js) : l'API
// « Street View Static API » doit y être activée.
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { lireCle } from "./googlePlaces";
import { adresseComplete } from "./photoBatiment";

const TAILLE_MAX = 4 * 1024 * 1024; // caractères de la data URL
const STREET_VIEW = "https://maps.googleapis.com/maps/api/streetview";

const json = (corps, status = 200) => NextResponse.json(corps, { status });

// Vue de la rue offerte : une clé Google est configurée
export async function vueRueDisponible() {
  return Boolean(await lireCle().catch(() => ""));
}

async function vueRue(adresse) {
  const cle = await lireCle().catch(() => "");
  if (!cle) return json({ erreur: "Aucune clé Google configurée." }, 404);
  if (!adresse) return json({ erreur: "Aucune adresse." }, 404);
  const lieu = /canada/i.test(adresse) ? adresse : `${adresse}, Canada`;
  const parametres = (extra) => new URLSearchParams({ location: lieu, source: "outdoor", key: cle, ...extra }).toString();
  try {
    // Métadonnées (gratuites) : y a-t-il une vue près de cette adresse ?
    const meta = await fetch(`${STREET_VIEW}/metadata?${parametres({})}`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
    if (meta.status !== "OK") {
      return json({ erreur: meta.status === "ZERO_RESULTS" || meta.status === "NOT_FOUND" ? "Aucune vue de la rue pour cette adresse." : `Google Street View : ${meta.error_message || meta.status}` }, 404);
    }
    // Sans cap donné, Google tourne la caméra vers l'adresse
    const res = await fetch(`${STREET_VIEW}?${parametres({ size: "640x400", fov: "80", return_error_code: "true" })}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return json({ erreur: `Google Street View : erreur ${res.status}` }, 404);
    return new NextResponse(Buffer.from(await res.arrayBuffer()), {
      headers: { "Content-Type": res.headers.get("content-type") || "image/jpeg", "Cache-Control": "private, max-age=604800" },
    });
  } catch {
    return json({ erreur: "Google ne répond pas." }, 504);
  }
}

// champ : "immeubleId" | "batimentId" ; session() → session ou null ;
// trouver(id) → { adresse, ville?, codePostal? } ou null
export function routesPhotoBatiment({ champ, session, trouver }) {
  async function GET(request, props) {
    if (!(await session())) return json({ erreur: "Accès refusé." }, 403);
    const { id } = await props.params;
    if (new URL(request.url).searchParams.get("vue") === "rue") {
      const x = await trouver(id);
      if (!x) return json({ erreur: "Introuvable." }, 404);
      return vueRue(adresseComplete(x));
    }
    const photo = await prisma.photoBatiment.findUnique({ where: { [champ]: id }, select: { url: true } });
    const m = photo?.url.match(/^data:(image\/[a-z+]+);base64,(.*)$/s);
    if (!m) return json({ erreur: "Photo introuvable." }, 404);
    return new NextResponse(Buffer.from(m[2], "base64"), { headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=86400" } });
  }

  async function POST(request, props) {
    const s = await session();
    if (!s) return json({ erreur: "Accès refusé." }, 403);
    const { id } = await props.params;
    const { dataUrl } = await request.json().catch(() => ({}));
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl || "")) return json({ erreur: "Photo manquante." }, 400);
    if (dataUrl.length > TAILLE_MAX) return json({ erreur: "Photo trop lourde." }, 413);
    if (!(await trouver(id))) return json({ erreur: "Introuvable." }, 404);
    const photo = await prisma.photoBatiment.upsert({
      where: { [champ]: id },
      create: { [champ]: id, url: dataUrl, ajoutePar: s.nom },
      update: { url: dataUrl, ajoutePar: s.nom, ajouteeLe: new Date() },
      select: { ajouteeLe: true },
    });
    return json(photo);
  }

  async function DELETE(request, props) {
    if (!(await session())) return json({ erreur: "Accès refusé." }, 403);
    const { id } = await props.params;
    await prisma.photoBatiment.deleteMany({ where: { [champ]: id } });
    return json({ ok: true });
  }

  return { GET, POST, DELETE };
}
