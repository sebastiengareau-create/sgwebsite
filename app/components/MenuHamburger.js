"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function MenuHamburger({ liens }) {
  const [ouvert, setOuvert] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  async function seDeconnecter() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className="bouton-3d-sombre"
        aria-label="Menu"
        style={{ width: 40, height: 40, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0 }}
      >
        <span style={{ width: 18, height: 2, background: "var(--accent)", borderRadius: 2 }} />
        <span style={{ width: 18, height: 2, background: "var(--accent)", borderRadius: 2 }} />
        <span style={{ width: 18, height: 2, background: "var(--accent)", borderRadius: 2 }} />
      </button>

      {ouvert && (
        <div
          onClick={() => setOuvert(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 50, backdropFilter: "blur(2px)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", top: 0, left: 0, bottom: 0, width: "78%", maxWidth: 300,
              background: "var(--bg)", borderRight: "1px solid var(--border)",
              padding: 16, display: "flex", flexDirection: "column", gap: 8,
              boxShadow: "8px 0 24px rgba(0,0,0,0.4)", overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Menu</span>
              <button
                onClick={() => setOuvert(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer", padding: 4 }}
              >
                ✕
              </button>
            </div>

            {liens.map((l) => {
              const actif = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOuvert(false)}
                  className={actif ? "bouton-3d" : "bouton-3d-sombre"}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12,
                    textDecoration: "none", fontSize: 14, fontWeight: 600,
                    ...(l.accent && !actif ? { background: "linear-gradient(180deg, rgba(232,163,61,0.18), rgba(232,163,61,0.08))", color: "var(--accent)" } : {}),
                  }}
                >
                  <span style={{ fontSize: 17 }}>{l.icone}</span>
                  {l.label}
                </Link>
              );
            })}

            <div style={{ flex: 1 }} />

            <button
              onClick={seDeconnecter}
              className="bouton-3d-sombre"
              style={{ padding: "12px 14px", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "var(--danger)", marginTop: 12 }}
            >
              🚪 Déconnexion
            </button>
          </div>
        </div>
      )}
    </>
  );
}
