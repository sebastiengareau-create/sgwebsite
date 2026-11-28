"use client";

// Cartes des immeubles (tableau de bord et page Immeubles) : la photo de
// l'immeuble, sinon la vue de la rue de Google, sinon sa façade illustrée
// (RueIllustree.js) ; puis un carré par logement de la couleur de son état, les
// loyers du mois et ce qui demande de l'attention.

import { useState } from "react";
import Link from "next/link";
import { TYPES_IMMEUBLE, argent, trouver, bailActuel, nomsLocataires, nomLogement, tauxOccupation } from "@/lib/immobilierCalculs";
import { etatLogement } from "@/lib/immobilierVisuel";
import { adresseComplete, urlPhoto, urlVueRue } from "@/lib/photoBatiment";
import { FacadeIllustree, ETATS_FENETRE } from "../components/RueIllustree";

const HABITABLES = ["LOGEMENT", "COMMERCIAL"];

// Couleur d'un état dans l'interface (les mêmes que les fenêtres de la rue)
export const COULEURS_ETAT = { OK: "#f0b429", RETARD: "#e5533f", SURVEILLER: "#3f9ae8", VACANT: null, SANS: null };

// { [logementId]: { etat, texte } } pour la rue et les façades
export function infosLogements(immeubles, comptes) {
  const infos = {};
  for (const i of immeubles) {
    for (const l of i.logements) {
      const b = bailActuel(l);
      const etat = etatLogement(b, b && comptes[b.id]);
      infos[l.id] = { etat, texte: [nomLogement(l), b ? nomsLocataires(b) : null, ETATS_FENETRE[etat].label.toLowerCase()].filter(Boolean).join(" · ") };
    }
  }
  return infos;
}

// Légende des couleurs : [[etat, nombre]…] présents ; libelles : noms des
// états propres au module (ex. Copropriété), sinon ceux de l'Immobilier
export function LegendeEtats({ infos, clair, libelles = {} }) {
  const compte = {};
  for (const { etat } of Object.values(infos)) compte[etat] = (compte[etat] || 0) + 1;
  const ordre = ["OK", "SURVEILLER", "RETARD", "VACANT", "SANS"].filter((e) => compte[e]);
  if (ordre.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12, color: clair ? "rgba(255,255,255,0.88)" : "var(--text-muted)" }}>
      {ordre.map((e) => (
        <span key={e} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <CarreEtat etat={e} />
          {libelles[e] || ETATS_FENETRE[e].label} ({compte[e]})
        </span>
      ))}
    </div>
  );
}

export function CarreEtat({ etat, taille = 10, titre }) {
  const couleur = COULEURS_ETAT[etat];
  return (
    <span
      title={titre} aria-label={titre}
      style={{
        display: "inline-block", width: taille, height: taille, borderRadius: 3, flexShrink: 0,
        background: couleur || "transparent", border: couleur ? "none" : "1.5px dashed var(--text-muted)", boxSizing: "border-box",
      }}
    />
  );
}

// La photo, sinon la vue de la rue, sinon la façade illustrée. urlApi : route
// de la photo (Immobilier par défaut ; /api/copropriete/batiments/<id>/photo)
export function ImageImmeuble({ immeuble, infos, moment, saison, vueRue, hauteur, urlApi }) {
  const [echec, setEchec] = useState(false);
  const adresse = adresseComplete(immeuble);
  const api = urlApi || `/api/immobilier/immeubles/${immeuble.id}/photo`;
  const src = immeuble.photo?.ajouteeLe ? urlPhoto(api, immeuble.photo.ajouteeLe) : vueRue && adresse ? urlVueRue(api, adresse) : null;
  if (src && !echec) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" loading="lazy" onError={() => setEchec(true)} style={{ display: "block", width: "100%", height: hauteur, objectFit: "cover" }} />
    );
  }
  return <FacadeIllustree immeuble={immeuble} infos={infos} moment={moment} saison={saison} hauteur={hauteur} />;
}

// immeuble : { id, nom, type, adresse, ville, photo, logements: [{ id, numero, type, etage, loyerVise, baux }] } ;
// net : revenu net de l'année (facultatif) ; reparations : nombre ouvertes (facultatif)
export function CarteImmeuble({ immeuble: i, infos, comptes, moment, saison, vueRue, net, annee, reparations, hauteurImage = 140 }) {
  const type = trouver(TYPES_IMMEUBLE, i.type);
  const unites = i.logements.filter((l) => HABITABLES.includes(l.type));
  const baux = i.logements.map(bailActuel).filter(Boolean);
  const loyers = baux.reduce((s, b) => s + b.loyer, 0);
  const retard = baux.reduce((s, b) => s + (comptes[b.id]?.enRetard || 0), 0);
  const loues = unites.filter((l) => bailActuel(l)).length;
  const lieu = [i.adresse, i.ville].filter(Boolean).join(", ");
  return (
    <Link
      href={`/immobilier/immeubles/${i.id}`} className="carte-immeuble"
      style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", minWidth: 0 }}
    >
      <div style={{ position: "relative" }}>
        <ImageImmeuble immeuble={i} infos={infos} moment={moment} saison={saison} vueRue={vueRue} hauteur={hauteurImage} />
        <span style={{ position: "absolute", left: 10, top: 10, fontSize: 11.5, fontWeight: 800, padding: "4px 9px", borderRadius: 999, background: "rgba(255,255,255,0.92)", color: "#2b2040", boxShadow: "0 1px 4px rgba(0,0,0,0.18)" }}>
          {type?.icone} {type?.label.split(" (")[0].split(" /")[0]}
        </span>
        {retard > 0.005 && (
          <span style={{ position: "absolute", left: 10, bottom: 12, fontSize: 11.5, fontWeight: 800, padding: "4px 9px", borderRadius: 999, background: "#e5533f", color: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
            {argent(retard)} en retard
          </span>
        )}
      </div>
      <div style={{ padding: "11px 13px 13px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.nom}</div>
          {lieu && <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lieu}</div>}
        </div>
        {unites.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }} aria-label="État des logements">
            {unites.map((l) => <CarreEtat key={l.id} etat={infos[l.id]?.etat || "VACANT"} titre={infos[l.id]?.texte} taille={12} />)}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 12.5, marginTop: "auto", flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-muted)" }}>
            {unites.length > 0 ? `${loues} / ${unites.length} loué${loues > 1 ? "s" : ""}` : "Aucun logement"}
            {unites.length > 0 && ` · ${String(tauxOccupation(i.logements)).replace(".", ",")} %`}
            {reparations ? ` · 🛠️ ${reparations}` : ""}
          </span>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{argent(loyers)}<span style={{ fontWeight: 500, fontSize: 11.5, color: "var(--text-muted)" }}> / mois</span></span>
        </div>
        {net != null && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Net {annee} : <strong style={{ color: net < 0 ? "var(--danger)" : "var(--success)" }}>{net >= 0 ? "+" : ""}{argent(net)}</strong>
          </div>
        )}
      </div>
    </Link>
  );
}

export function GrilleImmeubles({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))", gap: 12 }}>{children}</div>;
}
