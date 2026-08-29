"use client";

import { useRouter } from "next/navigation";

export default function BoutonDeconnexion() {
  const router = useRouter();

  async function seDeconnecter() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={seDeconnecter}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)", padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
    >
      Déconnexion
    </button>
  );
}
