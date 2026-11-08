"use client";

import Link from "next/link";
import { Icone } from "./StyleSection";

// Liste des liens du menu, regroupés par thème — partagée par le menu de
// gauche (ordinateur) et le menu hamburger (cellulaire), pour qu'ils soient
// toujours identiques. Chaque lien porte son groupe et son icône (voir
// EnTete.js) ; un groupe sans lien permis n'apparaît pas.
export const ORDRE_GROUPES = ["Accueil", "Opérations", "Achats et stock", "Finances", "Équipe", "Configuration"];

// Lien actif = le plus long préfixe correspondant (ex. /secretaire/clients
// plutôt que /secretaire quand on est sur la fiche d'un client)
export function lienActif(liens, pathname) {
  return liens
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export default function MenuNavigation({ liens, actif, onNaviguer }) {
  const groupes = ORDRE_GROUPES
    .map((g) => ({ titre: g, liens: liens.filter((l) => (l.groupe || "Accueil") === g) }))
    .filter((g) => g.liens.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groupes.map((g) => (
        <div key={g.titre} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", padding: "0 12px 4px" }}>
            {g.titre}
          </div>
          {g.liens.map((l) => {
            const estActif = l.href === actif;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={onNaviguer}
                aria-current={estActif ? "page" : undefined}
                className={`menu-lien${estActif ? " actif" : ""}${l.accent ? " accentue" : ""}`}
              >
                <Icone nom={l.icone} taille={18} couleur={estActif ? "var(--accent-ombre)" : l.accent ? "var(--accent-ombre)" : "var(--text-muted)"} />
                <span style={{ flex: 1, minWidth: 0 }}>{l.label}</span>
                {l.badge > 0 && (
                  <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "var(--danger)", color: "#fff", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
                    {l.badge > 99 ? "99+" : l.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Carte du bas : la personne connectée et le bouton de déconnexion
export function CarteUtilisateur({ nom, role, onDeconnexion, version }) {
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px" }}>
        <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: "rgba(232,163,61,0.16)", color: "var(--accent-ombre)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800 }}>
          {(nom || "?").charAt(0).toUpperCase()}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nom}</span>
          <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{role}</span>
        </span>
        <button
          onClick={onDeconnexion}
          aria-label="Déconnexion" title="Déconnexion"
          style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--danger)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
        >
          <Icone nom="sortie" taille={18} />
        </button>
      </div>
      {version && <div style={{ fontSize: 10.5, color: "var(--text-muted)", padding: "8px 12px 0", fontFamily: "monospace" }}>{version}</div>}
    </div>
  );
}
