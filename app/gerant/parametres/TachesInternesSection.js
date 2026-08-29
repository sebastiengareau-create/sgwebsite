"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TachesInternesSection({ tachesInitiales }) {
  const router = useRouter();
  const [taches, setTaches] = useState(tachesInitiales);
  const [nouveauNom, setNouveauNom] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [modificationId, setModificationId] = useState(null);
  const [nomModifie, setNomModifie] = useState("");

  async function ajouter(e) {
    e.preventDefault();
    if (!nouveauNom.trim()) return;
    setEnCours(true);
    const res = await fetch("/api/taches-internes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: nouveauNom }),
    });
    setEnCours(false);
    if (res.ok) {
      const tache = await res.json();
      setTaches((prev) => [...prev, tache]);
      setNouveauNom("");
      router.refresh();
    }
  }

  async function sauvegarderNom(id) {
    if (!nomModifie.trim()) return;
    await fetch(`/api/taches-internes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: nomModifie }),
    });
    setTaches((prev) => prev.map((t) => (t.id === id ? { ...t, nom: nomModifie } : t)));
    setModificationId(null);
    router.refresh();
  }

  async function basculerActif(id, actif) {
    await fetch(`/api/taches-internes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !actif }),
    });
    setTaches((prev) => prev.map((t) => (t.id === id ? { ...t, actif: !actif } : t)));
    router.refresh();
  }

  return (
    <div className="conteneur-page-large" style={{ margin: "20px auto 0", padding: "0 16px" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Tâches internes</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Pour suivre les mécaniciens même quand ils ne sont pas sur un bon client (nettoyage, formation, entretien
          de l'atelier…). Ces heures comptent comme présence, mais jamais comme facturable.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {taches.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, opacity: t.actif ? 1 : 0.5 }}>
              {modificationId === t.id ? (
                <>
                  <input
                    value={nomModifie}
                    onChange={(e) => setNomModifie(e.target.value)}
                    autoFocus
                    style={{ flex: 1, padding: "7px 9px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
                  />
                  <button onClick={() => sauvegarderNom(t.id)} style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>✓</button>
                  <button onClick={() => setModificationId(null)} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 13, textDecoration: t.actif ? "none" : "line-through" }}>{t.nom}</span>
                  <button
                    onClick={() => { setModificationId(t.id); setNomModifie(t.nom); }}
                    style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => basculerActif(t.id, t.actif)}
                    style={{ fontSize: 11, color: t.actif ? "var(--danger)" : "var(--success)", background: "none", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}
                  >
                    {t.actif ? "Annuler" : "Réactiver"}
                  </button>
                </>
              )}
            </div>
          ))}
          {taches.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucune tâche interne encore.</p>}
        </div>

        <form onSubmit={ajouter} style={{ display: "flex", gap: 8 }}>
          <input
            value={nouveauNom}
            onChange={(e) => setNouveauNom(e.target.value)}
            placeholder="Ex : Nettoyage de l'atelier"
            style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
          />
          <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            + Ajouter
          </button>
        </form>
      </div>
    </div>
  );
}
