"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES_DOCUMENTS, VISIBILITES } from "@/lib/coproprieteCalculs";
import { ChampsFormulaire, Erreur, boutonPrincipal, labelStyle, aujourdhui } from "../ui";

// Dépôt d'un document : fichier, titre, catégorie, date, qui le voit.
// fixe : valeurs imposées (ex. { uniteId, visibilite: "UNITE" } depuis la
// fiche d'une unité)
export default function FormulaireDocument({ unites = [], batiments = [], fixe = {}, onFini }) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState({ titre: "", categorie: fixe.uniteId ? "UNITE" : "PV_ASSEMBLEE", date: aujourdhui(), description: "", visibilite: fixe.visibilite || "COPROPRIETAIRES", uniteId: fixe.uniteId || "", batimentId: "" });
  const [fichier, setFichier] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (nom, v) => setValeurs((x) => ({ ...x, [nom]: v }));

  const champs = [
    { nom: "titre", label: "Titre (sinon, le nom du fichier)", pleineLargeur: true },
    { nom: "categorie", label: "Catégorie", type: "choix", options: CATEGORIES_DOCUMENTS },
    { nom: "date", label: "Date du document", type: "date" },
    ...(fixe.visibilite ? [] : [{ nom: "visibilite", label: "Qui le voit", type: "choix", options: VISIBILITES }]),
    ...(!fixe.uniteId && unites.length > 0 ? [{ nom: "uniteId", label: valeurs.visibilite === "UNITE" ? "Unité (obligatoire)" : "Unité concernée", type: "choix", vide: "—", options: unites.map((u) => ({ code: u.id, label: u.numero })) }] : []),
    ...(batiments.length > 0 ? [{ nom: "batimentId", label: "Bâtiment", type: "choix", vide: "—", options: batiments.map((b) => ({ code: b.id, label: b.nom })) }] : []),
    { nom: "description", label: "Description", type: "long", lignes: 2 },
  ];

  async function envoyer() {
    if (!fichier) return setErreur("Choisis le fichier.");
    setErreur("");
    setEnCours(true);
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...valeurs, ...fixe })) fd.append(k, v ?? "");
    fd.append("fichier", fichier);
    const res = await fetch("/api/copropriete/documents", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) return setErreur(data.erreur || "Envoi impossible.");
    router.refresh();
    onFini?.();
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <label style={labelStyle}>Fichier (PDF, Word, Excel, image… 20 Mo max.)</label>
      <input type="file" onChange={(e) => setFichier(e.target.files?.[0] || null)} style={{ fontSize: 13, marginBottom: 10 }} />
      <ChampsFormulaire champs={champs} valeurs={valeurs} maj={maj} />
      <Erreur texte={erreur} />
      <button type="button" onClick={envoyer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "Envoi…" : "Déposer le document"}</button>
    </div>
  );
}
