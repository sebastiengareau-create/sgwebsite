"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdministrateurClient({ modules, verrouilleInit, estDeveloppeur, themeInit, tailleTexteInit }) {
  const router = useRouter();
  const [enCoursId, setEnCoursId] = useState(null);
  const [verrouille, setVerrouille] = useState(verrouilleInit);
  const [verrouillageEnCours, setVerrouillageEnCours] = useState(false);
  const [theme, setTheme] = useState(themeInit);
  const [themeEnCours, setThemeEnCours] = useState(false);
  const [tailleTexte, setTailleTexte] = useState(tailleTexteInit);
  const [tailleEnCours, setTailleEnCours] = useState(false);

  async function choisirTheme(nouveauTheme) {
    if (nouveauTheme === theme) return;
    setThemeEnCours(true);
    setTheme(nouveauTheme);
    await fetch("/api/parametres", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme_developpeur: nouveauTheme }),
    });
    setThemeEnCours(false);
    router.refresh();
  }

  async function choisirTailleTexte(nouvelleTaille) {
    if (nouvelleTaille === tailleTexte) return;
    setTailleEnCours(true);
    setTailleTexte(nouvelleTaille);
    await fetch("/api/parametres", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taille_texte_developpeur: nouvelleTaille }),
    });
    setTailleEnCours(false);
    router.refresh();
  }

  async function basculerVerrouillage() {
    const nouveauStatut = !verrouille;
    if (nouveauStatut) {
      if (!window.confirm("Verrouiller l'accès complet à ce logiciel maintenant ? Plus personne (sauf toi) ne pourra rien faire tant que ce ne sera pas décoché.")) return;
    }
    setVerrouillageEnCours(true);
    await fetch("/api/administrateur/verrouillage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verrouille: nouveauStatut }),
    });
    setVerrouille(nouveauStatut);
    setVerrouillageEnCours(false);
    router.refresh();
  }

  async function toggle(moduleId, nouveauStatut) {
    setEnCoursId(moduleId);
    await fetch("/api/administrateur/modules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: moduleId, actif: nouveauStatut }),
    });
    setEnCoursId(null);
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>⚙️ Administrateur</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
        Visible seulement par toi. Active ou désactive des modules complets sur cette installation —
        utile pour ajuster ce qu'un client voit, une fois ce logiciel revendu à d'autres garages.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {modules.map((m) => (
          <div key={m.id} className="carte carte-m" style={{ opacity: m.pasEncoreConstruit ? 0.5 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.description}</div>
              </div>
              <button
                onClick={() => toggle(m.id, !m.actif)}
                disabled={enCoursId === m.id || m.pasEncoreConstruit}
                style={{
                  width: 46, height: 26, borderRadius: 999, border: "none", position: "relative", cursor: m.pasEncoreConstruit ? "not-allowed" : "pointer",
                  background: m.actif ? "var(--success)" : "var(--bg)",
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: "absolute", top: 3, left: m.actif ? 23 : 3, width: 20, height: 20, borderRadius: "50%",
                  background: "white", transition: "left 0.15s",
                }} />
              </button>
            </div>
            {m.pasEncoreConstruit && (
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>Pas encore construit — l'interrupteur n'a pas d'effet pour l'instant.</div>
            )}
          </div>
        ))}
      </div>

      {estDeveloppeur && (
        <div style={{ marginTop: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Affichage (toi seulement)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => choisirTheme("sombre")}
              disabled={themeEnCours}
              className={theme !== "clair" ? "bouton-3d" : "bouton-3d-sombre"}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}
            >
              🌙 Sombre
            </button>
            <button
              type="button"
              onClick={() => choisirTheme("clair")}
              disabled={themeEnCours}
              className={theme === "clair" ? "bouton-3d" : "bouton-3d-sombre"}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}
            >
              ☀️ Clair
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => choisirTailleTexte("normal")}
              disabled={tailleEnCours}
              className={tailleTexte !== "grand" ? "bouton-3d" : "bouton-3d-sombre"}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
            >
              Texte normal
            </button>
            <button
              type="button"
              onClick={() => choisirTailleTexte("grand")}
              disabled={tailleEnCours}
              className={tailleTexte === "grand" ? "bouton-3d" : "bouton-3d-sombre"}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}
            >
              Texte plus gros
            </button>
          </div>
        </div>
      )}

      <Link
        href="/gerant/administrateur/sauvegarde"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", marginTop: 16, padding: 14, borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700 }}
      >
        💾 Sauvegarde des données
      </Link>

      <Link
        href="/gerant/administrateur/acces"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", marginTop: 10, padding: 14, borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700 }}
      >
        🔑 Rôles et accès des employés
      </Link>

      <Link
        href="/gerant/administrateur/entreprise"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", marginTop: 10, padding: 14, borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700 }}
      >
        🏢 Informations de l'entreprise
      </Link>

      <div style={{ marginTop: 20, background: "var(--surface)", border: "1px solid var(--danger)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--danger)", fontWeight: 700, marginBottom: 6 }}>
          Zone sensible
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Verrouiller l'accès complet</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
              Ex. en cas de défaut de paiement — bloque toute l'installation pour tout le monde (sauf toi) et affiche
              un message pour contacter info@sgwebsite.online.
            </div>
          </div>
          <button
            onClick={basculerVerrouillage}
            disabled={verrouillageEnCours}
            style={{
              width: 46, height: 26, borderRadius: 999, border: "none", position: "relative", cursor: "pointer",
              background: verrouille ? "var(--danger)" : "var(--bg)", flexShrink: 0,
            }}
          >
            <span style={{ position: "absolute", top: 3, left: verrouille ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "white", transition: "left 0.15s" }} />
          </button>
        </div>
        {verrouille && (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "var(--danger)" }}>
            🔒 Actuellement verrouillé — personne d'autre que toi ne peut utiliser le logiciel.
          </div>
        )}
      </div>

      <Link
        href="/gerant/administrateur/reinitialisation"
        style={{ display: "block", textAlign: "center", marginTop: 10, padding: 14, borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700, background: "none", border: "1px dashed var(--danger)", color: "var(--danger)" }}
      >
        🧨 Réinitialisation — effacer les données
      </Link>
    </div>
  );
}
