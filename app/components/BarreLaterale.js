"use client";

import { usePathname, useRouter } from "next/navigation";
import MenuNavigation, { CarteUtilisateur, lienActif } from "./MenuNavigation";

// Menu permanent à gauche sur ordinateur (masqué sous 1100 px par le CSS —
// voir .barre-laterale dans globals.css). Mêmes liens, mêmes groupes que le
// menu hamburger (MenuNavigation).
export default function BarreLaterale({ liens, nomEntreprise, version, nom, role }) {
  const pathname = usePathname();
  const router = useRouter();

  async function seDeconnecter() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="barre-laterale" aria-label="Menu principal">
      <div style={{ fontSize: 15, fontWeight: 800, padding: "4px 12px 16px", color: "var(--text)", letterSpacing: "-0.01em" }}>{nomEntreprise}</div>
      <div style={{ flex: 1, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
        <MenuNavigation liens={liens} actif={lienActif(liens, pathname)} />
      </div>
      <CarteUtilisateur nom={nom} role={role} onDeconnexion={seDeconnecter} version={version} />
    </nav>
  );
}
