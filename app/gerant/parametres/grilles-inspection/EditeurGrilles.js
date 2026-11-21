"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UNITES_MESURE, LIMITES_GRILLES as L, nbPointsGrille, normaliserGrilles, nouvelleCleGrille } from "@/lib/grillesInspection";
import { Pastille } from "@/app/components/StyleSection";

// Identifiants d'affichage des sections et des points (clés React), retirés
// à l'enregistrement
let compteur = 0;
const id = () => `e${++compteur}`;
const avecIds = (grilles) => grilles.map((g) => ({
  ...g,
  sections: g.sections.map((s) => ({ ...s, _id: id(), points: s.points.map((p) => ({ ...p, _id: id() })) })),
}));
const sansIds = (grilles) => grilles.map((g) => ({
  cle: g.cle, titre: g.titre, active: g.active,
  sections: g.sections.map((s) => ({ titre: s.titre, points: s.points.map((p) => ({ libelle: p.libelle, unite: p.unite })) })),
}));
const empreinte = (grilles) => JSON.stringify(sansIds(grilles));

function deplacer(liste, i, sens) {
  const j = i + sens;
  if (j < 0 || j >= liste.length) return;
  [liste[i], liste[j]] = [liste[j], liste[i]];
}

// Éditeur des grilles d'inspection du garage (Paramètres → Grilles d'inspection)
export default function EditeurGrilles({ grillesInitiales, personnalisees: personnaliseesInit }) {
  const [grilles, setGrilles] = useState(() => avecIds(grillesInitiales));
  const [sauvegarde, setSauvegarde] = useState(() => empreinte(grillesInitiales));
  const [personnalisees, setPersonnalisees] = useState(personnaliseesInit);
  const [ouverte, setOuverte] = useState(null); // cle de la grille déployée
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null); // { texte, erreur }
  const [confirmer, setConfirmer] = useState(null); // "retablir" | cle de la grille à supprimer

  const modifie = empreinte(grilles) !== sauvegarde;

  // Changements pas enregistrés : le navigateur demande avant de quitter
  useEffect(() => {
    if (!modifie) return;
    const avertir = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [modifie]);

  // Modifie une copie des grilles (petites données : la copie complète suffit)
  function modifier(fn) {
    setGrilles((avant) => {
      const copie = structuredClone(avant);
      fn(copie);
      return copie;
    });
    setMessage(null);
  }
  const modifierGrille = (cle, fn) => modifier((gs) => fn(gs.find((g) => g.cle === cle), gs));

  function ajouterGrille(modele) {
    const cle = nouvelleCleGrille();
    const titre = modele ? `${modele.titre} (copie)`.slice(0, L.titreGrille) : "Nouvelle grille";
    const sections = modele
      ? structuredClone(modele.sections).map((s) => ({ ...s, _id: id(), points: s.points.map((p) => ({ ...p, _id: id() })) }))
      : [{ _id: id(), titre: "Général", points: [{ _id: id(), libelle: "", unite: "" }] }];
    modifier((gs) => gs.push({ cle, titre, active: true, sections }));
    setOuverte(cle);
  }

  async function enregistrer() {
    setMessage(null);
    const verif = normaliserGrilles(sansIds(grilles));
    if (verif.erreur) return setMessage({ texte: verif.erreur, erreur: true });
    setEnCours(true);
    const res = await fetch("/api/parametres/grilles-inspection", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grilles: verif.grilles }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(false);
    if (!res?.ok) return setMessage({ texte: data?.erreur || "Rien n'a été enregistré : vérifie la connexion et réessaie.", erreur: true });
    setGrilles(avecIds(data.grilles));
    setSauvegarde(empreinte(data.grilles));
    setPersonnalisees(true);
    setMessage({ texte: "Grilles enregistrées. Elles servent aux prochaines inspections." });
  }

  async function retablir() {
    setConfirmer(null);
    setEnCours(true);
    const res = await fetch("/api/parametres/grilles-inspection", { method: "DELETE" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(false);
    if (!res?.ok) return setMessage({ texte: data?.erreur || "Rien n'a été changé : vérifie la connexion et réessaie.", erreur: true });
    setGrilles(avecIds(data.grilles));
    setSauvegarde(empreinte(data.grilles));
    setPersonnalisees(false);
    setOuverte(null);
    setMessage({ texte: "Grilles d'origine rétablies." });
  }

  return (
    <div className="conteneur-page" style={{ paddingBottom: 110 }}>
      <Link href="/gerant/parametres" style={{ display: "inline-block", color: "var(--text-muted)", fontSize: 12.5, textDecoration: "none", marginBottom: 10 }}>
        ← Paramètres
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", margin: "0 0 6px" }}>Grilles d&apos;inspection</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
        Les points que le technicien vérifie quand il commence une inspection sur un bon. Un changement vaut pour les prochaines inspections :
        celles déjà faites gardent leurs points.{personnalisees ? "" : " Ce sont les grilles d'origine ; modifie-les pour en faire celles du garage."}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {grilles.map((g) => (
          <Grille
            key={g.cle} grille={g} ouverte={ouverte === g.cle} seule={grilles.length === 1}
            onBasculer={() => setOuverte(ouverte === g.cle ? null : g.cle)}
            onModifier={(fn) => modifierGrille(g.cle, fn)}
            onDupliquer={() => ajouterGrille(g)}
            confirmerSuppression={confirmer === g.cle}
            onSupprimer={() => {
              if (confirmer !== g.cle) return setConfirmer(g.cle);
              setConfirmer(null);
              modifier((gs) => gs.splice(gs.findIndex((x) => x.cle === g.cle), 1));
            }}
            onAnnulerSuppression={() => setConfirmer(null)}
          />
        ))}
      </div>

      {grilles.length < L.grilles && (
        <button type="button" onClick={() => ajouterGrille(null)} style={{ ...boutonPointille, marginTop: 12 }}>
          + Nouvelle grille
        </button>
      )}

      <div style={{ marginTop: 22 }}>
        {confirmer === "retablir" ? (
          <div style={{ border: "1px solid var(--danger)", borderRadius: 12, padding: 12 }}>
            <p style={{ fontSize: 13.5, margin: "0 0 10px" }}>Remplacer les grilles du garage par celles d&apos;origine ? Les inspections déjà faites ne changent pas.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={retablir} disabled={enCours} style={{ ...boutonSecondaire, flex: 1, color: "var(--danger)", borderColor: "var(--danger)" }}>Oui, rétablir</button>
              <button type="button" onClick={() => setConfirmer(null)} style={{ ...boutonSecondaire, flex: 1 }}>Annuler</button>
            </div>
          </div>
        ) : personnalisees && (
          <button type="button" onClick={() => setConfirmer("retablir")} style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, color: "var(--text-muted)", textDecoration: "underline", cursor: "pointer" }}>
            Rétablir les grilles d&apos;origine
          </button>
        )}
      </div>

      {/* Barre d'enregistrement, toujours à portée */}
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: "var(--surface)", borderTop: "1px solid var(--border)",
        padding: "10px max(16px, env(safe-area-inset-right, 0px)) calc(10px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))",
      }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button" onClick={enregistrer} disabled={enCours || !modifie} className="bouton-3d"
            style={{ padding: "11px 18px", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: modifie ? "pointer" : "default", opacity: modifie ? 1 : 0.55 }}
          >
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
          <span role={message?.erreur ? "alert" : "status"} style={{ flex: 1, minWidth: 0, fontSize: 13, color: message?.erreur ? "var(--danger)" : message ? "var(--success)" : "var(--text-muted)" }}>
            {message ? message.texte : modifie ? "Changements pas encore enregistrés." : "Tout est enregistré."}
          </span>
        </div>
      </div>
    </div>
  );
}

function Grille({ grille, ouverte, seule, onBasculer, onModifier, onDupliquer, confirmerSuppression, onSupprimer, onAnnulerSuppression }) {
  const nb = nbPointsGrille({ sections: grille.sections.map((s) => ({ points: s.points.filter((p) => p.libelle.trim()) })) });
  return (
    <section style={{ background: "var(--surface)", border: `1px solid ${ouverte ? "var(--accent)" : "var(--border)"}`, borderRadius: 16 }}>
      <button
        type="button" onClick={onBasculer} aria-expanded={ouverte}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 16px", background: "none", border: "none", color: "var(--text)", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontSize: 13, color: "var(--text-muted)", width: 12 }}>{ouverte ? "▾" : "▸"}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 16, fontWeight: 800 }}>{grille.titre || "Sans nom"}</span>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{grille.sections.length} section{grille.sections.length > 1 ? "s" : ""} · {nb} point{nb > 1 ? "s" : ""}</span>
        </span>
        {grille.active
          ? <Pastille couleur="var(--success)" fond="var(--success-fond)">Offerte</Pastille>
          : <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">Retirée des bons</Pastille>}
      </button>

      {ouverte && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ flex: "1 1 220px", minWidth: 0 }}>
              <span style={etiquette}>Nom de la grille</span>
              <input
                value={grille.titre} maxLength={L.titreGrille} className="champ" style={{ fontSize: 15 }}
                onChange={(e) => onModifier((g) => { g.titre = e.target.value; })}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, paddingBottom: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={grille.active} onChange={(e) => onModifier((g) => { g.active = e.target.checked; })} style={{ width: 18, height: 18, accentColor: "var(--success)" }} />
              Offerte sur les bons
            </label>
          </div>

          {grille.sections.map((s, i) => (
            <Section
              key={s._id} section={s} premiere={i === 0} derniere={i === grille.sections.length - 1}
              onModifier={(fn) => onModifier((g) => fn(g.sections[i]))}
              onDeplacer={(sens) => onModifier((g) => deplacer(g.sections, i, sens))}
              onRetirer={() => onModifier((g) => { g.sections.splice(i, 1); })}
            />
          ))}

          {grille.sections.length < L.sections && (
            <button
              type="button" style={boutonPointille}
              onClick={() => onModifier((g) => { g.sections.push({ _id: id(), titre: "", points: [{ _id: id(), libelle: "", unite: "" }] }); })}
            >
              + Section
            </button>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4, borderTop: "1px solid var(--border)" }}>
            <button type="button" onClick={onDupliquer} style={{ ...boutonSecondaire, marginTop: 10 }}>Dupliquer la grille</button>
            {!seule && (confirmerSuppression ? (
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13 }}>Supprimer « {grille.titre} » ?</span>
                <button type="button" onClick={onSupprimer} style={{ ...boutonSecondaire, color: "var(--danger)", borderColor: "var(--danger)" }}>Oui, supprimer</button>
                <button type="button" onClick={onAnnulerSuppression} style={boutonSecondaire}>Annuler</button>
              </span>
            ) : (
              <button type="button" onClick={onSupprimer} style={{ ...boutonSecondaire, marginTop: 10, color: "var(--danger)" }}>Supprimer la grille</button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Section({ section, premiere, derniere, onModifier, onDeplacer, onRetirer }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--bg)" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
        <input
          value={section.titre} maxLength={L.titreSection} placeholder="Nom de la section (ex. Freins)" aria-label="Nom de la section"
          className="champ" style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700 }}
          onChange={(e) => onModifier((s) => { s.titre = e.target.value; })}
        />
        <BoutonIcone libelle="Monter la section" onClick={() => onDeplacer(-1)} disabled={premiere}>↑</BoutonIcone>
        <BoutonIcone libelle="Descendre la section" onClick={() => onDeplacer(1)} disabled={derniere}>↓</BoutonIcone>
        <BoutonIcone libelle="Retirer la section" onClick={onRetirer} danger>✕</BoutonIcone>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {section.points.map((p, j) => (
          // Sur un écran étroit, l'unité et les flèches passent sous le nom du point
          <div key={p._id} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
            <input
              value={p.libelle} maxLength={L.libelle} placeholder="Point à vérifier" aria-label="Point à vérifier"
              className="champ" style={{ flex: "1 1 220px", minWidth: 0, fontSize: 14 }}
              onChange={(e) => onModifier((s) => { s.points[j].libelle = e.target.value; })}
            />
            <span style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
            <select
              value={p.unite} aria-label={`Unité de mesure : ${p.libelle || "point"}`} className="champ" style={{ width: 84, flexShrink: 0, fontSize: 13, padding: "9px 4px" }}
              onChange={(e) => onModifier((s) => { s.points[j].unite = e.target.value; })}
            >
              {UNITES_MESURE.map((u) => <option key={u} value={u}>{u || "—"}</option>)}
            </select>
            <BoutonIcone libelle="Monter le point" onClick={() => onModifier((s) => deplacer(s.points, j, -1))} disabled={j === 0}>↑</BoutonIcone>
            <BoutonIcone libelle="Descendre le point" onClick={() => onModifier((s) => deplacer(s.points, j, 1))} disabled={j === section.points.length - 1}>↓</BoutonIcone>
            <BoutonIcone libelle="Retirer le point" onClick={() => onModifier((s) => { s.points.splice(j, 1); })} danger>✕</BoutonIcone>
            </span>
          </div>
        ))}
      </div>
      {section.points.length < L.points && (
        <button type="button" style={{ ...boutonPointille, marginTop: 8 }} onClick={() => onModifier((s) => { s.points.push({ _id: id(), libelle: "", unite: "" }); })}>
          + Point
        </button>
      )}
    </div>
  );
}

function BoutonIcone({ libelle, onClick, disabled, danger, children }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={libelle} title={libelle}
      style={{
        flexShrink: 0, width: 32, height: 34, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 14, fontWeight: 700,
        color: danger ? "var(--danger)" : "var(--text)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, padding: 0,
      }}
    >
      {children}
    </button>
  );
}

const etiquette = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 };
const boutonSecondaire = { padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const boutonPointille = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px dashed var(--border)", background: "none", color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer" };
