"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Menu permanent à gauche sur ordinateur (masqué sous 1100 px par le CSS —
// voir .barre-laterale dans globals.css). Mêmes liens que le menu hamburger.
export default function BarreLaterale({ liens, nomEntreprise }) {
  const pathname = usePathname();
  const router = useRouter();

  // Lien actif = le plus long préfixe correspondant (ex. /secretaire/clients
  // plutôt que /secretaire quand on est sur la fiche d'un client)
  const actif = liens
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  async function seDeconnecter() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="barre-laterale" aria-label="Menu principal">
      <div style={{ fontSize: 14, fontWeight: 800, padding: "4px 12px 14px", color: "var(--accent)" }}>{nomEntreprise}</div>
      {liens.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`barre-laterale-lien${l.href === actif ? " actif" : ""}${l.accent ? " accentue" : ""}`}
        >
          <span style={{ fontSize: 16 }}>{l.icone}</span>
          {l.label}
        </Link>
      ))}
      <div style={{ flex: 1 }} />
      <button
        onClick={seDeconnecter}
        className="barre-laterale-lien"
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", width: "100%", textAlign: "left" }}
      >
        <span style={{ fontSize: 16 }}>🚪</span>
        Déconnexion
      </button>
    </nav>
  );
}
