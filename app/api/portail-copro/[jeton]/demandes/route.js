import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coproprietaireParJeton, unitesDuCoproprietaire, normaliserModele, preparerFichierCopro, creerDemande, erreur } from "@/lib/copropriete";
import { notifier } from "@/lib/notifications";

const MAX_FICHIERS = 6;

// Demande de réparation ou signalement fait par un copropriétaire depuis son
// portail (multipart/form-data) : type, titre, description, categorie,
// priorite (URGENTE seulement s'il le dit), uniteId (une des siennes) ou
// emplacement (partie commune), et jusqu'à 6 photos « fichier »
export async function POST(request, props) {
  const { jeton } = await props.params;
  const c = await coproprietaireParJeton(jeton);
  if (!c) return erreur("Lien invalide.", 404);
  const formulaire = await request.formData().catch(() => null);
  if (!formulaire) return erreur("Formulaire invalide.");
  const champs = Object.fromEntries([...formulaire.entries()].filter(([, v]) => typeof v === "string"));
  const permis = ["type", "titre", "description", "categorie", "priorite", "uniteId", "emplacement"];
  const r = normaliserModele("demande", Object.fromEntries(permis.filter((k) => k in champs).map((k) => [k, champs[k]])), { creation: true });
  if (r.erreur) return erreur(r.erreur);
  if (r.data.uniteId && !(await unitesDuCoproprietaire(c.id)).includes(r.data.uniteId)) return erreur("Unité invalide.");
  if (r.data.priorite && !["URGENTE", "NORMALE"].includes(r.data.priorite)) r.data.priorite = "NORMALE";

  const fichiers = [];
  for (const f of formulaire.getAll("fichier").filter((f) => typeof f !== "string" && f.size > 0).slice(0, MAX_FICHIERS)) {
    const p = await preparerFichierCopro(f);
    if (p.erreur) return erreur(p.erreur);
    fichiers.push({ ...p, ajoutePar: c.nom });
  }
  if (!r.data.batimentId && r.data.uniteId) {
    r.data.batimentId = (await prisma.uniteCopro.findUnique({ where: { id: r.data.uniteId }, select: { batimentId: true } }))?.batimentId || null;
  }

  const demande = await creerDemande({
    ...r.data, coproprietaireId: c.id, source: "PORTAIL", statut: "NOUVELLE", creePar: c.nom,
    ...(fichiers.length > 0 && { fichiers: { create: fichiers } }),
  });
  await notifier("DEMANDE_COPRO", {
    titre: `${r.data.priorite === "URGENTE" ? "🚨 URGENT — " : ""}Demande ${demande.numero} de ${c.nom}`,
    corps: r.data.titre,
    url: `/copropriete/demandes/${demande.id}`,
    tag: `demande-copro-${demande.id}`,
  });
  return NextResponse.json({ ok: true, numero: demande.numero });
}
