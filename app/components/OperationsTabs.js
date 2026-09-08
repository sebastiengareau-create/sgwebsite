"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BandeauSection from "./BandeauSection";

const ONGLETS = [
  { href: "/secretaire/operations/soumissions", label: "Soumissions", icone: "📝" },
  { href: "/secretaire", label: "Bons de commande", icone: "🔧" },
  { href: "/secretaire/factures", label: "Facture", icone: "🧾" },
];

export default function OperationsTabs() {
  const pathname = usePathname();

  return (
    <div className="conteneur-page-large" style={{ margin: "0 auto", padding: "12px 16px 0" }}>
      <BandeauSection icone="🔧" titre="Bons de commande / Facture" sousTitre="Crée les soumissions, les bons, assigne les mécaniciens, et facture." />
      <div style={{ display: "flex", justifyContent: "center", gap: 8, overflowX: "auto", paddingBottom: 14 }}>
        {ONGLETS.map((o) => {
          const actif = pathname === o.href || (o.href === "/secretaire/operations/soumissions" && pathname.startsWith("/secretaire/operations/soumissions"));
          return (
            <Link
              key={o.href}
              href={o.href}
              className={actif ? "bouton-3d" : "bouton-3d-sombre"}
              style={{
                fontSize: 12, fontWeight: 700, padding: "9px 14px", borderRadius: 12, whiteSpace: "nowrap", textDecoration: "none",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span>{o.icone}</span>{o.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
