"use client";

import { useRouter } from "next/navigation";

export default function BoutonRetour() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/secretaire/operations/soumissions")}
      style={{
        background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)",
        padding: "10px 20px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer",
      }}
    >
      ← Retour aux soumissions
    </button>
  );
}
