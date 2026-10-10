"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// « il y a 5 min », « il y a 2 h », « 12 oct. »
export function depuis(date) {
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 24 * 60) return `il y a ${Math.round(minutes / 60)} h`;
  return new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short" }).format(new Date(date));
}

// Cloche 🔔 de l'en-tête : nombre de notifications non lues et les
// dernières reçues (voir lib/notifications.js). Revérifiée chaque minute.
export default function Cloche({ nonLuesInitial }) {
  const [nonLues, setNonLues] = useState(nonLuesInitial);
  const [notifications, setNotifications] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const router = useRouter();
  const boite = useRef(null);

  const charger = useCallback(async () => {
    const res = await fetch("/api/notifications").catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setNotifications(data.notifications);
    setNonLues(data.nonLues);
  }, []);

  useEffect(() => {
    const minuterie = setInterval(() => { if (!document.hidden) charger(); }, 60000);
    return () => clearInterval(minuterie);
  }, [charger]);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e) => { if (boite.current && !boite.current.contains(e.target)) setOuvert(false); };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [ouvert]);

  function basculer() {
    if (!ouvert) charger();
    setOuvert(!ouvert);
  }

  async function marquerLues(corps) {
    await fetch("/api/notifications/lues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }).catch(() => {});
  }

  async function ouvrir(n) {
    setOuvert(false);
    if (!n.lue) {
      setNonLues((x) => Math.max(0, x - 1));
      setNotifications((liste) => liste.map((x) => (x.id === n.id ? { ...x, lue: true } : x)));
      await marquerLues({ ids: [n.id] });
    }
    if (n.url) router.push(n.url);
  }

  async function toutLire() {
    setNonLues(0);
    setNotifications((liste) => liste?.map((x) => ({ ...x, lue: true })));
    await marquerLues({ toutes: true });
  }

  return (
    <div ref={boite} style={{ position: "relative" }}>
      <button
        onClick={basculer}
        className="bouton-3d-sombre"
        aria-label={nonLues > 0 ? `Notifications (${nonLues} non lues)` : "Notifications"}
        style={{ width: 40, height: 40, borderRadius: 12, fontSize: 18, position: "relative", flexShrink: 0 }}
      >
        🔔
        {nonLues > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9,
            background: "var(--danger)", color: "#fff", fontSize: 10.5, fontWeight: 700, lineHeight: "18px", boxSizing: "border-box",
          }}>
            {nonLues > 99 ? "99+" : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <div style={{
          position: "absolute", right: 0, top: 48, width: "min(340px, calc(100vw - 32px))", maxHeight: "70vh", overflowY: "auto",
          background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.4)", zIndex: 40,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Notifications</span>
            {nonLues > 0 && (
              <button onClick={toutLire} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", padding: 0 }}>
                Tout marquer lu
              </button>
            )}
          </div>

          {notifications === null && <p style={{ fontSize: 12, color: "var(--text-muted)", padding: 12, margin: 0 }}>Chargement…</p>}
          {notifications?.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", padding: 12, margin: 0 }}>Aucune notification pour l'instant.</p>}
          {notifications?.slice(0, 10).map((n) => (
            <button
              key={n.id}
              onClick={() => ouvrir(n)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderBottom: "1px solid var(--border)",
                background: n.lue ? "transparent" : "var(--surface)", color: "var(--text)", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: n.lue ? 500 : 700 }}>{n.titre}</span>
                {!n.lue && <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--accent)", flexShrink: 0, marginTop: 4 }} />}
              </div>
              {n.corps && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{n.corps}</div>}
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3 }}>{depuis(n.creeLe)}</div>
            </button>
          ))}

          <Link href="/notifications" onClick={() => setOuvert(false)} style={{ display: "block", textAlign: "center", padding: 10, fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>
            Tout voir →
          </Link>
        </div>
      )}
    </div>
  );
}
