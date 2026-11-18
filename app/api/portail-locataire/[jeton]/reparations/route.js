import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { locataireParJeton, bauxDuLocataire, normaliserModele, preparerFichier, creerReparation, erreur } from "@/lib/immobilier";
import { notifier } from "@/lib/notifications";

const MAX_FICHIERS = 6;

// Demande de réparation d'un locataire depuis son portail (multipart) :
// titre, description, categorie, urgente, logementId (un de ses logements
// actuels) ou rien (parties communes de son immeuble), jusqu'à 6 photos
export async function POST(request, props) {
  const { jeton } = await props.params;
  const l = await locataireParJeton(jeton);
  if (!l) return erreur("Lien invalide.", 404);
  const formulaire = await request.formData().catch(() => null);
  if (!formulaire) return erreur("Formulaire invalide.");
  const champs = Object.fromEntries([...formulaire.entries()].filter(([, v]) => typeof v === "string"));
  const actifs = (await bauxDuLocataire(l.id)).filter((b) => b.statut === "ACTIF");
  if (actifs.length === 0) return erreur("Aucun bail en cours : communiquez avec le propriétaire.");
  let bail = actifs[0];
  if (champs.logementId) {
    bail = actifs.find((b) => b.logementId === champs.logementId);
    if (!bail) return erreur("Logement invalide.");
  }
  const r = normaliserModele("reparation", {
    titre: champs.titre, description: champs.description, categorie: champs.categorie || "",
    immeubleId: bail.logement.immeubleId, logementId: champs.logementId ? bail.logementId : "",
    priorite: champs.urgente === "oui" ? "URGENTE" : "NORMALE",
  }, { creation: true });
  if (r.erreur) return erreur(r.erreur);
  const fichiers = [];
  for (const f of formulaire.getAll("fichier").filter((f) => typeof f !== "string" && f.size > 0).slice(0, MAX_FICHIERS)) {
    const p = await preparerFichier(f);
    if (p.erreur) return erreur(p.erreur);
    fichiers.push({ ...p, ajoutePar: l.nom });
  }
  const rep = await creerReparation({
    ...r.data, locataireId: l.id, source: "PORTAIL", statut: "NOUVELLE", creePar: l.nom,
    ...(fichiers.length > 0 && { fichiers: { create: fichiers } }),
  });
  await notifier("DEMANDE_IMMO", {
    titre: `${r.data.priorite === "URGENTE" ? "🚨 URGENT — " : ""}Réparation ${rep.numero} demandée par ${l.nom}`,
    corps: r.data.titre,
    url: `/immobilier/reparations/${rep.id}`,
    tag: `reparation-immo-${rep.id}`,
  });
  return NextResponse.json({ ok: true, numero: rep.numero });
}
