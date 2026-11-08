"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import MenuNavigation, { CarteUtilisateur, lienActif } from "./MenuNavigation";
import { Icone } from "./StyleSection";

// Menu de cellulaire : même contenu que le menu de gauche (MenuNavigation),
// dans un panneau qui glisse depuis la gauche. Échap ou un toucher à côté
// le ferme.
export default function MenuHamburger({ liens, version, nomEntreprise, nom, role }) {
  const [ouvert, setOuvert] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const nbBadges = liens.reduce((s, l) => s + (l.badge || 0), 0);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e) => { if (e.key === "Escape") setOuvert(false); };
    window.addEventListener("keydown", fermer);
    return () => window.removeEventListener("keydown", fermer);
  }, [ouvert]);

  async function seDeconnecter() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        aria-label="Menu"
        style={{
          position: "relative", width: 42, height: 42, borderRadius: 12, flexShrink: 0, cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
          background: "var(--surface)", border: "1px solid var(--border)",
        }}
      >
        <span style={{ width: 18, height: 2, background: "var(--text)", borderRadius: 2 }} />
        <span style={{ width: 18, height: 2, background: "var(--text)", borderRadius: 2 }} />
        <span style={{ width: 12, height: 2, background: "var(--accent)", borderRadius: 2, alignSelf: "flex-start", marginLeft: 12 }} />
        {nbBadges > 0 && <span style={{ position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: "50%", background: "var(--danger)", border: "2px solid var(--bg)" }} />}
      </button>

      {ouvert && (
        <div className="menu-fond" onClick={() => setOuvert(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, backdropFilter: "blur(2px)" }}>
          <nav
            className="menu-tiroir"
            aria-label="Menu principal"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", top: 0, left: 0, bottom: 0, width: "82%", maxWidth: 310,
              background: "var(--surface)", borderRight: "1px solid var(--border)",
              padding: "16px 12px", display: "flex", flexDirection: "column",
              boxShadow: "8px 0 24px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "0 4px 14px 12px" }}>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomEntreprise || "Menu"}</span>
              <button
                onClick={() => setOuvert(false)}
                aria-label="Fermer le menu"
                style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <MenuNavigation liens={liens} actif={lienActif(liens, pathname)} onNaviguer={() => setOuvert(false)} />
            </div>
            <CarteUtilisateur nom={nom} role={role} onDeconnexion={seDeconnecter} version={version} />
          </nav>
        </div>
      )}
    </>
  );
}
