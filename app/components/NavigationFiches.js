"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { voisinsFiche } from "@/lib/navigationFiches";

// Boutons « ← Précédent / Suivant → » en bas d'une fiche, pour passer
// rapidement d'une fiche à l'autre. L'ordre suivi est celui de la liste
// telle qu'on l'a vue (recherche et filtres compris), mémorisé par la liste
// avec memoriserOrdreFiches ; sinon (lien direct, autre onglet), l'ordre par
// défaut de la liste, calculé par la page serveur (voisinsParDefaut).

const prefixe = (cle) => `ordre-fiches:${cle}`;

export function memoriserOrdreFiches(cle, ids) {
  try { sessionStorage.setItem(prefixe(cle), JSON.stringify(ids)); } catch {}
}

// À appeler dans une liste avec les identifiants affichés, dans l'ordre
export function useOrdreFiches(cle, ids) {
  const signature = ids.join(",");
  useEffect(() => {
    memoriserOrdreFiches(cle, signature ? signature.split(",") : []);
  }, [cle, signature]);
}

export default function NavigationFiches({ cle, idCourant, base, voisinsParDefaut }) {
  const [voisins, setVoisins] = useState(voisinsParDefaut);

  useEffect(() => {
    let memorises = null;
    try { memorises = voisinsFiche(JSON.parse(sessionStorage.getItem(prefixe(cle)) || "[]"), idCourant); } catch {}
    setVoisins(memorises || voisinsParDefaut);
  }, [cle, idCourant, voisinsParDefaut]);

  if (!voisins || voisins.total < 2) return null;

  return (
    <div className="conteneur-page" style={{ paddingTop: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <BoutonFiche href={voisins.precedent && `${base}/${voisins.precedent}`}>← Précédent</BoutonFiche>
        <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{voisins.position} / {voisins.total}</span>
        <BoutonFiche href={voisins.suivant && `${base}/${voisins.suivant}`}>Suivant →</BoutonFiche>
      </div>
    </div>
  );
}

function BoutonFiche({ href, children }) {
  const style = { flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13, textAlign: "center", textDecoration: "none" };
  if (!href) return <span className="bouton-3d-sombre" style={{ ...style, opacity: 0.4 }}>{children}</span>;
  return <Link href={href} className="bouton-3d-sombre" style={{ ...style, color: "var(--text)" }}>{children}</Link>;
}
