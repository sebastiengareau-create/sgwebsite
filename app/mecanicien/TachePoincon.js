"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

function tempsEcoule(debutISO) {
  const s = Math.floor((Date.now() - new Date(debutISO).getTime()) / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function LiveTimer({ debut }) {
  const [t, setT] = useState(tempsEcoule(debut));
  useEffect(() => {
    const id = setInterval(() => setT(tempsEcoule(debut)), 1000);
    return () => clearInterval(id);
  }, [debut]);
  return <span style={{ fontSize: 13, fontWeight: 800, color: "var(--success)", fontVariantNumeric: "tabular-nums", marginRight: 8 }}>{t}</span>;
}

export default function TachePoincon({ problemeId, actif, debut }) {
  const router = useRouter();
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  async function toggle() {
    setErreur("");
    setChargement(true);
    const res = await fetch(`/api/taches/${problemeId}/poinconner`, { method: "POST" });
    setChargement(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || `Erreur (code ${res.status}).`);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {actif && debut && <LiveTimer debut={debut} />}
      <button
        onClick={toggle}
        disabled={chargement}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          background: actif ? "var(--danger-fond)" : "var(--success)",
          color: actif ? "var(--danger)" : "#fff",
          border: `1px solid ${actif ? "var(--danger)" : "var(--success)"}`,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: actif ? 2 : 999, background: "currentColor" }} />
        {chargement ? "…" : actif ? "Arrêter" : "Démarrer"}
      </button>
      {erreur && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{erreur}</div>}
    </div>
  );
}
