"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BandeauSection from "./BandeauSection";
import { Icone } from "./StyleSection";

// Onglets de la section Opérations, à largeur égale : 4 côte à côte sur
// ordinateur, 2 × 2 sur cellulaire. Le rapport de ventes y a sa place au
// même titre que les autres, pour une rangée symétrique.
const ONGLETS = [
  { href: "/secretaire/operations/soumissions", label: "Soumissions", icone: "crayon" },
  { href: "/secretaire", label: "Bons de commande", icone: "outils" },
  { href: "/secretaire/factures", label: "Factures", icone: "document" },
  { href: "/secretaire/factures/rapport-ventes", label: "Rapport de ventes", icone: "graphique" },
];

function estActif(pathname, href) {
  if (href === "/secretaire/operations/soumissions") return pathname.startsWith(href);
  return pathname === href;
}

export default function OperationsTabs() {
  const pathname = usePathname();

  return (
    <div className="conteneur-page-large" style={{ margin: "0 auto", padding: "12px 16px 0" }}>
      <BandeauSection icone="🔧" titre="Bons de commande / Factures" sousTitre="Crée les soumissions, les bons, assigne les mécaniciens, et facture." />
      <nav style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 4,
        padding: 4, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)",
      }}>
        {ONGLETS.map((o) => {
          const actif = estActif(pathname, o.href);
          return (
            <Link
              key={o.href}
              href={o.href}
              aria-current={actif ? "page" : undefined}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px 10px", borderRadius: 10, textDecoration: "none", whiteSpace: "nowrap",
                fontSize: 14, fontWeight: 700,
                background: actif ? "var(--accent)" : "transparent",
                color: actif ? "#221f18" : "var(--text-muted)",
              }}
            >
              <Icone nom={o.icone} taille={18} couleur={actif ? "#221f18" : "var(--accent-ombre)"} />
              {o.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
