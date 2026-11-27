"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { compresserImage } from "@/lib/images";
import { LARGEUR_PHOTO_BATIMENT, QUALITE_PHOTO_BATIMENT, lienGoogleMaps, urlPhoto, urlVueRue } from "@/lib/photoBatiment";
import { useChoixPhoto } from "./ChoixPhoto";
import { BoutonAction, TEINTES } from "./StyleSection";

const dateCourte = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });

// Photo d'un immeuble ou d'un bâtiment (lib/photoBatiment.js), en bannière
// sur sa fiche. Sans photo, la vue de la rue de Google Street View quand une
// clé Google est configurée (vueRue) et que l'adresse est connue.
// urlApi : /api/immobilier/immeubles/<id>/photo ou
// /api/copropriete/batiments/<id>/photo ; photoLe : date de la photo ou null.
export default function PhotoBatiment({ urlApi, photoLe: initiale, adresse, vueRue, hauteur = 240 }) {
  const router = useRouter();
  const [photoLe, setPhotoLe] = useState(initiale || null);
  const [echecRue, setEchecRue] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const choix = useChoixPhoto(([f]) => prendre(f));

  const rue = !photoLe && vueRue && adresse && !echecRue;
  const src = photoLe ? urlPhoto(urlApi, photoLe) : rue ? urlVueRue(urlApi, adresse) : null;

  async function prendre(file) {
    setErreur("");
    setEnCours(true);
    try {
      const res = await fetch(urlApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: await compresserImage(file, LARGEUR_PHOTO_BATIMENT, QUALITE_PHOTO_BATIMENT) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setErreur(data.erreur || `Le serveur a refusé la photo (code ${res.status}).`);
      setPhotoLe(data.ajouteeLe);
      router.refresh();
    } catch (e) {
      setErreur("Impossible de traiter cette photo : " + e.message);
    } finally {
      setEnCours(false);
    }
  }

  async function retirer() {
    if (!window.confirm(vueRue && adresse ? "Retirer la photo ? La vue de la rue de Google la remplacera." : "Retirer la photo ?")) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(urlApi, { method: "DELETE" }).catch(() => null);
    setEnCours(false);
    if (!res?.ok) return setErreur("Impossible de retirer la photo.");
    setPhotoLe(null);
    setEchecRue(false);
    router.refresh();
  }

  const vide = !adresse
    ? "Aucune photo. Ajoute l'adresse pour voir la rue, ou prends une photo."
    : vueRue
      ? echecRue ? "Aucune vue de la rue disponible pour cette adresse : prends une photo." : "Aucune photo."
      : "Aucune photo.";

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ position: "relative", height: hauteur, borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface-alt, var(--surface))" }}>
        {src ? (
          <a href={src} target="_blank" rel="noreferrer" title="Voir en grand" style={{ display: "block", width: "100%", height: "100%", cursor: "zoom-in" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={src} src={src} alt={rue ? "Vue de la rue" : "Photo du bâtiment"}
              onError={() => { if (rue) setEchecRue(true); }}
              style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
            />
          </a>
        ) : (
          <button
            type="button" onClick={choix.ouvrir} disabled={enCours}
            style={{ width: "100%", height: "100%", border: "none", background: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: 16 }}
          >
            <span style={{ fontSize: 40 }}>🏢</span>
            <span>{vide}</span>
          </button>
        )}
        {rue && (
          <span style={{ position: "absolute", left: 10, bottom: 10, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>
            Vue de la rue · Google Street View
          </span>
        )}
        {photoLe && (
          <span style={{ position: "absolute", left: 10, bottom: 10, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>
            Photo du {dateCourte(photoLe)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        <BoutonAction icone="camera" compact onClick={choix.ouvrir} disabled={enCours} couleur={TEINTES.bleu.couleur}>
          {enCours ? "…" : photoLe ? "Remplacer la photo" : "Ajouter une photo"}
        </BoutonAction>
        {photoLe && <BoutonAction icone="poubelle" compact couleur="var(--danger)" onClick={retirer} disabled={enCours}>Retirer</BoutonAction>}
        {adresse && (
          <a href={lienGoogleMaps(adresse)} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", textDecoration: "none", marginLeft: 4 }}>
            🗺️ Voir sur Google Maps
          </a>
        )}
      </div>
      {erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 12.5, margin: "8px 0 0" }}>{erreur}</p>}
      {choix.element}
    </div>
  );
}

// Petite image pour les listes : la photo, sinon la vue de la rue ; rien si
// ni l'une ni l'autre (ou si Google n'a pas de vue)
export function VignetteBatiment({ urlApi, photoLe, adresse, vueRue, taille = 56 }) {
  const [echec, setEchec] = useState(false);
  const src = photoLe ? urlPhoto(urlApi, photoLe) : vueRue && adresse ? urlVueRue(urlApi, adresse) : null;
  if (!src || echec) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src} alt="" loading="lazy" onError={() => setEchec(true)}
      style={{ display: "block", width: taille, height: taille, objectFit: "cover", borderRadius: 10, flexShrink: 0, border: "1px solid var(--border)" }}
    />
  );
}
