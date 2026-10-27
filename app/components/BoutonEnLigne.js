"use client";

import { useState } from "react";
import Link from "next/link";

// « Qui est en ligne ? » — la liste n'est demandée au serveur que lorsqu'on
// touche le bouton (pas à chaque ouverture de page, ni en temps réel).
// En ligne = actif dans le logiciel depuis 10 minutes ou moins.
export default function BoutonEnLigne() {
  const [etat, setEtat] = useState({ enCours: false, liste: null, erreur: "" });

  async function charger() {
    setEtat({ enCours: true, liste: etat.liste, erreur: "" });
    const res = await fetch("/api/presence", { cache: "no-store" });
    const donnees = await res.json().catch(() => ({}));
    setEtat(res.ok ? { enCours: false, liste: donnees.enLigne, erreur: "" } : { enCours: false, liste: null, erreur: donnees.erreur || "Erreur." });
  }

  return (
    <div className="carte carte-s" style={{ marginBottom: 16, fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: etat.liste?.length ? "var(--success)" : "var(--border)" }} />
          {etat.liste ? <strong>{etat.liste.length} en ligne</strong> : <span style={{ color: "var(--text-muted)" }}>Qui est connecté ?</span>}
        </span>
        <button onClick={charger} disabled={etat.enCours} className="bouton-3d-sombre" style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {etat.enCours ? "…" : etat.liste ? "↻ Actualiser" : "👥 Voir"}
        </button>
      </div>
      {etat.erreur && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{etat.erreur}</div>}
      {etat.liste && etat.liste.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
          {etat.liste.map((u) => (
            <Link key={u.id} href={`/gerant/employes/${u.id}`} style={{ display: "flex", justifyContent: "space-between", textDecoration: "none", color: "var(--text)", fontSize: 12.5 }}>
              <span>● {u.nom}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{u.minutes < 2 ? "à l'instant" : `il y a ${u.minutes} min`}</span>
            </Link>
          ))}
        </div>
      )}
      {etat.liste && etat.liste.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>Personne n'a été actif dans les 10 dernières minutes.</div>}
    </div>
  );
}
