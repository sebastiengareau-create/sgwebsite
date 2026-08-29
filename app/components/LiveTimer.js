"use client";

import { useState, useEffect } from "react";

function tempsEcoule(debutISO) {
  const s = Math.floor((Date.now() - new Date(debutISO).getTime()) / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

export default function LiveTimer({ debut }) {
  const [t, setT] = useState(tempsEcoule(debut));
  useEffect(() => {
    const id = setInterval(() => setT(tempsEcoule(debut)), 1000);
    return () => clearInterval(id);
  }, [debut]);
  return (
    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "monospace" }}>
      {t}
    </span>
  );
}
