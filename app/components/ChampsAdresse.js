"use client";

import { useEffect, useId, useRef, useState } from "react";
import { provinceDuCodePostal } from "@/lib/adresse";

// Champs d'adresse avec suggestions :
// - ChampAdresse : adresses réelles (Google Places, si une clé est configurée
//   dans Paramètres) ; un choix remplit tout le formulaire via onChoisir ;
// - ChampVille : municipalités du secteur postal puis du Québec (local) ;
// - ChampCodePostal : à la saisie du secteur (« J7Y »), onSecteur reçoit la
//   province et les villes du secteur.
// remplisseurAdresse() branche onChoisir et onSecteur sur les setters d'un
// formulaire. Les suggestions ne partent qu'après une frappe : ouvrir une
// fiche existante ne déclenche rien.

// Passe à false à la première réponse « pas de clé » : on cesse de demander
let googleActif = true;

// Jeton de session Google (regroupe les suggestions d'une même saisie pour
// la facturation) — crypto.randomUUID n'existe qu'en HTTPS ou sur localhost
function nouveauJeton() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join("-");
}

export function ChampAdresse({ valeur, onChange, onChoisir, style, className, onKeyDown, onBlur, ...props }) {
  const [suggestions, setSuggestions] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [indice, setIndice] = useState(-1);
  const saisie = useRef(false);
  const jeton = useRef(null);
  const champ = useRef(null);

  useEffect(() => {
    if (!saisie.current || !googleActif) return;
    const texte = String(valeur || "").trim();
    if (texte.length < 4) {
      setSuggestions([]);
      return;
    }
    const controle = new AbortController();
    const minuterie = setTimeout(async () => {
      jeton.current ||= nouveauJeton();
      const params = new URLSearchParams({ q: texte, jeton: jeton.current });
      const res = await fetch(`/api/adresse/suggestions?${params}`, { signal: controle.signal }).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (!res?.ok || !data) return;
      if (data.actif === false) {
        googleActif = false;
        return;
      }
      setSuggestions(data.suggestions || []);
      setIndice(-1);
      setOuvert(true);
    }, 300);
    return () => {
      clearTimeout(minuterie);
      controle.abort();
    };
  }, [valeur]);

  async function choisir(s) {
    saisie.current = false;
    setOuvert(false);
    setSuggestions([]);
    const params = new URLSearchParams({ id: s.id, jeton: jeton.current || "" });
    jeton.current = null;
    onChange(s.principal);
    const res = await fetch(`/api/adresse/details?${params}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok && data) onChoisir ? onChoisir(data) : onChange(data.adresse || s.principal);
  }

  function touche(e) {
    if (ouvert && suggestions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIndice((i) => (e.key === "ArrowDown" ? Math.min(i + 1, suggestions.length - 1) : Math.max(i - 1, -1)));
        return;
      }
      if (e.key === "Enter" && indice >= 0 && indice < suggestions.length) {
        e.preventDefault();
        choisir(suggestions[indice]);
        return;
      }
      if (e.key === "Escape") {
        setOuvert(false);
        return;
      }
    }
    onKeyDown?.(e);
  }

  const visible = ouvert && suggestions.length > 0;
  const haut = champ.current ? champ.current.offsetTop + champ.current.offsetHeight : 0;

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={champ}
        value={valeur || ""}
        onChange={(e) => {
          saisie.current = true;
          onChange(e.target.value);
        }}
        onKeyDown={touche}
        onBlur={(e) => {
          setOuvert(false);
          onBlur?.(e);
        }}
        autoComplete={googleActif ? "off" : undefined}
        style={style}
        className={className}
        {...props}
      />
      {visible && (
        <div
          style={{
            position: "absolute", top: haut + 2, left: 0, right: 0, zIndex: 50,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
            boxShadow: "0 6px 18px rgba(0,0,0,0.18)", overflow: "hidden",
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={s.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choisir(s)}
              onMouseEnter={() => setIndice(i)}
              style={{ padding: "7px 10px", cursor: "pointer", fontSize: 13, background: i === indice ? "var(--bg)" : "transparent" }}
            >
              <div style={{ color: "var(--text)" }}>{s.principal}</div>
              {s.secondaire && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.secondaire}</div>}
            </div>
          ))}
          <div style={{ padding: "3px 10px", fontSize: 10, color: "var(--text-muted)", textAlign: "right" }}>Suggestions : Google</div>
        </div>
      )}
    </div>
  );
}

export function ChampVille({ valeur, onChange, codePostal, onFocus, ...props }) {
  const id = useId();
  const [villes, setVilles] = useState([]);
  const [actif, setActif] = useState(false);

  useEffect(() => {
    if (!actif) return;
    const controle = new AbortController();
    const minuterie = setTimeout(async () => {
      const params = new URLSearchParams({ q: valeur || "", cp: codePostal || "" });
      const res = await fetch(`/api/adresse/villes?${params}`, { signal: controle.signal }).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (res?.ok && data) setVilles(data.villes || []);
    }, 200);
    return () => {
      clearTimeout(minuterie);
      controle.abort();
    };
  }, [actif, valeur, codePostal]);

  return (
    <>
      <input
        value={valeur || ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          setActif(true);
          onFocus?.(e);
        }}
        list={id}
        autoComplete="off"
        {...props}
      />
      <datalist id={id}>
        {villes.map((v) => <option key={v} value={v} />)}
      </datalist>
    </>
  );
}

export function ChampCodePostal({ valeur, onChange, onSecteur, ...props }) {
  const dernierSecteur = useRef(null);

  async function changer(texte) {
    const majuscules = texte.toUpperCase();
    onChange(majuscules);
    const secteur = majuscules.replace(/\s+/g, "").slice(0, 3);
    if (!onSecteur || !/^[A-Z]\d[A-Z]$/.test(secteur) || secteur === dernierSecteur.current) return;
    dernierSecteur.current = secteur;
    const res = await fetch(`/api/adresse/villes?${new URLSearchParams({ cp: secteur })}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    onSecteur({ province: provinceDuCodePostal(secteur), villes: (res?.ok && data?.secteur) || [] });
  }

  return <input value={valeur || ""} onChange={(e) => changer(e.target.value)} maxLength={7} autoComplete="off" {...props} />;
}

// Callbacks qui remplissent un formulaire d'adresse : l'adresse choisie dans
// les suggestions Google remplace les champs ; un secteur postal fixe la
// province, et la ville si elle est vide et que le secteur n'en a qu'une.
// setProvince est facultatif (formulaires sans province).
export function remplisseurAdresse({ ville, setAdresse, setVille, setProvince, setCodePostal }) {
  return {
    onChoisir: (a) => {
      if (a.adresse) setAdresse(a.adresse);
      if (a.ville) setVille(a.ville);
      if (a.province && setProvince) setProvince(a.province);
      if (a.codePostal) setCodePostal(a.codePostal);
    },
    onSecteur: ({ province, villes }) => {
      if (province && setProvince) setProvince(province);
      if (!String(ville || "").trim() && villes.length === 1) setVille(villes[0]);
    },
  };
}
