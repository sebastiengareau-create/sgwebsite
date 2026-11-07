"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useBulleDeplacable from "./useBulleDeplacable";

// Bouton « + » en bas à droite, sur toutes les pages (voir app/layout.js) :
// nouvelle soumission, nouveau bon, nouvelle pièce, nouveau client.
// Chaque choix n'apparaît qu'à qui a accès à sa section (Administrateur →
// Rôles et accès) ; sans aucun choix permis, le bouton n'est pas affiché.
// On le déplace en le glissant (position mémorisée sur l'appareil).
const OPTIONS = [
  { href: "/secretaire/operations/soumissions/nouvelle", label: "Nouvelle soumission", icone: "📝", section: "operations" },
  { href: "/secretaire/nouveau", label: "Nouveau bon", icone: "🔧", section: "operations" },
  { href: "/secretaire/inventaire?nouveau=1", label: "Nouvelle pièce", icone: "📦", section: "inventaire" },
  { href: "/secretaire/clients?nouveau=1", label: "Nouveau client", icone: "🧑‍🤝‍🧑", section: "clients" },
];

// Pages faites pour l'impression ou le PDF : pas de bouton par-dessus
const PAGES_SANS_BOUTON = [/^\/login/, /\/imprimer/, /\/talons?(\/|$)/, /\/facture$/, /^\/bons\/[^/]+\/commande/, /^\/gerant\/comptabilite\/rapports\/.+/];

export default function BoutonFlottantNouveau({ sections = [] }) {
  const pathname = usePathname() || "";
  const [ouvert, setOuvert] = useState(false);
  const { position, aDroite, placement, glissement, estUnClic, gestionnaires } = useBulleDeplacable({
    cle: "bouton-plus-position",
    defaut: { cote: "droite", bas: 20 },
    onDebut: () => setOuvert(false),
  });

  const options = OPTIONS.filter((o) => sections.includes(o.section));
  if (options.length === 0 || PAGES_SANS_BOUTON.some((motif) => motif.test(pathname))) return null;

  // Bouton placé dans le haut de l'écran : le menu s'ouvre vers le bas
  const versLeBas = typeof window !== "undefined" && position.bas > window.innerHeight / 2;

  const styleOption = {
    display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999,
    fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap",
  };

  return (
    <>
      {ouvert && (
        <div onClick={() => setOuvert(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
      )}
      <div
        className="bouton-flottant"
        style={{
          position: "fixed", ...placement, zIndex: 40, display: "flex", gap: 10,
          flexDirection: versLeBas ? "column-reverse" : "column", alignItems: aDroite ? "flex-end" : "flex-start",
        }}
      >
        {ouvert && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: aDroite ? "flex-end" : "flex-start" }}>
            {options.map((o) => (
              <Link key={o.href} href={o.href} onClick={() => setOuvert(false)} className="bouton-3d" style={styleOption}>
                <span>{o.icone}</span> {o.label}
              </Link>
            ))}
          </div>
        )}
        <button
          onClick={() => { if (estUnClic()) setOuvert((v) => !v); }}
          {...gestionnaires}
          className="bouton-3d"
          style={{
            width: 56, height: 56, borderRadius: "50%", fontSize: 26, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none",
            cursor: glissement ? "grabbing" : "pointer",
            transform: ouvert ? "rotate(45deg)" : "rotate(0)", transition: "transform 0.15s ease",
          }}
          aria-label="Créer"
          title="Glisse le bouton pour le déplacer"
        >
          +
        </button>
      </div>
    </>
  );
}
