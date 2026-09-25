"use client";

import { useEffect, useState } from "react";
import { LONGUEUR_NIV, LONGUEUR_MAX_PLAQUE, nettoyerNiv, nettoyerPlaque, validerNiv } from "@/lib/vehicules";

// Formulaire du dossier véhicule, réutilisé partout (création client, fiche
// client, nouveau bon). Quatre listes en cascade — année → marque → modèle →
// version — alimentées par /api/vehicules/catalogue, chacune avec « Autre… »
// pour entrer une valeur absente du catalogue ; puis le NIV (exactement 17
// caractères, décodable) et la plaque.
//
// valeur : { annee, marque, modele, version, niv, plaque } — onChange reçoit
// l'objet complet mis à jour.

export const VEHICULE_VIDE = { annee: "", marque: "", modele: "", version: "", niv: "", plaque: "" };

const AUTRE = "__autre__";

async function chargerListe(params) {
  const res = await fetch(`/api/vehicules/catalogue?${new URLSearchParams(params)}`);
  if (!res.ok) return null;
  return res.json();
}

export default function ChampsVehicule({ valeur, onChange }) {
  const v = { ...VEHICULE_VIDE, ...valeur };
  const annee = v.annee ? String(v.annee) : "";

  const [annees, setAnnees] = useState(null);
  const [marques, setMarques] = useState(null); // { populaires, autres }
  const [modeles, setModeles] = useState(null);
  const [versions, setVersions] = useState(null);
  const [decodage, setDecodage] = useState({ enCours: false, message: "" });

  useEffect(() => {
    chargerListe({}).then((d) => setAnnees(d?.annees || []));
  }, []);

  useEffect(() => {
    let annule = false;
    setMarques(null);
    chargerListe({ annee }).then((d) => {
      if (!annule) setMarques(d?.marques || { populaires: [], autres: [] });
    });
    return () => { annule = true; };
  }, [annee]);

  useEffect(() => {
    let annule = false;
    setModeles(null);
    if (!v.marque) return;
    chargerListe({ marque: v.marque, ...(annee && { annee }) }).then((d) => {
      if (!annule) setModeles(d?.modeles || []);
    });
    return () => { annule = true; };
  }, [annee, v.marque]);

  useEffect(() => {
    let annule = false;
    setVersions(null);
    if (!v.marque || !v.modele) return;
    chargerListe({ marque: v.marque, modele: v.modele }).then((d) => {
      if (!annule) setVersions(d?.versions || []);
    });
    return () => { annule = true; };
  }, [v.marque, v.modele]);

  function maj(changements) {
    onChange({ ...v, ...changements });
  }

  const nomsMarques = marques ? [...marques.populaires, ...marques.autres].map((m) => m.nom) : null;

  async function decoderNiv() {
    setDecodage({ enCours: true, message: "" });
    const res = await fetch(`/api/vehicules/niv?niv=${encodeURIComponent(v.niv)}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDecodage({ enCours: false, message: d.erreur || "Décodage impossible." });
      return;
    }
    const trouve = [d.annee, d.marque, d.modele, d.version].filter(Boolean);
    maj({
      annee: d.annee ? String(d.annee) : v.annee,
      marque: d.marque || v.marque,
      modele: d.modele || (d.marque && d.marque !== v.marque ? "" : v.modele),
      version: d.version || (d.modele && d.modele !== v.modele ? "" : v.version),
    });
    setDecodage({
      enCours: false,
      message: trouve.length
        ? `NIV décodé${d.source === "local" ? " (hors ligne — année et marque seulement)" : ""} : ${trouve.join(" ")}`
        : "Ce NIV n'a rien donné — choisis le véhicule dans les listes.",
    });
  }

  const verifNiv = validerNiv(v.niv);
  const nivComplet = nettoyerNiv(v.niv).length === LONGUEUR_NIV && !verifNiv.erreur;

  return (
    <div>
      <div style={grille}>
        <ListeOuAutre
          label="Année"
          valeur={annee}
          options={annees?.map(String)}
          onChange={(x) => maj({ annee: x })}
          placeholderAutre="ex : 1987"
          typeAutre="number"
        />
        <ListeOuAutre
          label="Marque"
          valeur={v.marque}
          options={nomsMarques}
          groupes={marques && [
            { label: "Marques courantes", options: marques.populaires.map((m) => m.nom) },
            { label: "Toutes les autres marques", options: marques.autres.map((m) => m.nom) },
          ]}
          onChange={(x) => maj({ marque: x, modele: "", version: "" })}
          placeholderAutre="Marque"
        />
        <ListeOuAutre
          label="Modèle"
          valeur={v.modele}
          options={v.marque ? modeles : []}
          desactive={!v.marque}
          aideDesactive="Choisis la marque d'abord"
          onChange={(x) => maj({ modele: x, version: "" })}
          placeholderAutre="Modèle"
        />
        <ListeOuAutre
          label="Version"
          valeur={v.version}
          options={v.modele ? versions : []}
          desactive={!v.modele}
          aideDesactive="Choisis le modèle d'abord"
          onChange={(x) => maj({ version: x })}
          placeholderAutre="ex : EX-L, XLT, Hybride…"
        />
      </div>

      <label className="etiquette">
        NIV (numéro d'identification du véhicule){" "}
        <span style={{ color: verifNiv.erreur && v.niv ? "var(--danger)" : "var(--text-muted)" }}>
          — {nettoyerNiv(v.niv).length}/{LONGUEUR_NIV} caractères
        </span>
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={v.niv}
          onChange={(e) => { maj({ niv: nettoyerNiv(e.target.value).slice(0, LONGUEUR_NIV) }); setDecodage({ enCours: false, message: "" }); }}
          maxLength={LONGUEUR_NIV}
          minLength={LONGUEUR_NIV}
          pattern={`[A-HJ-NPR-Z0-9]{${LONGUEUR_NIV}}`}
          title={`Exactement ${LONGUEUR_NIV} caractères — chiffres et lettres, sauf I, O et Q`}
          placeholder={`${LONGUEUR_NIV} caractères, ex : 2HGFC2F59KH000000`}
          className="champ"
          style={{ fontFamily: "monospace", letterSpacing: 1, flex: 1 }}
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={decoderNiv}
          disabled={!nivComplet || decodage.enCours}
          className="bouton-3d-sombre"
          style={{ padding: "0 12px", borderRadius: 8, fontSize: 12, whiteSpace: "nowrap", opacity: nivComplet ? 1 : 0.5 }}
          title="Remplir l'année, la marque, le modèle et la version à partir du NIV"
        >
          {decodage.enCours ? "…" : "🔍 Décoder"}
        </button>
      </div>
      {v.niv && verifNiv.erreur && <p style={messageErreur}>{verifNiv.erreur}</p>}
      {v.niv && verifNiv.avertissement && <p style={messageAvertissement}>⚠️ {verifNiv.avertissement}</p>}
      {decodage.message && <p style={messageInfo}>{decodage.message}</p>}

      <label className="etiquette">Plaque d'immatriculation</label>
      <input
        value={v.plaque}
        onChange={(e) => maj({ plaque: e.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, "") })}
        onBlur={() => maj({ plaque: nettoyerPlaque(v.plaque) })}
        maxLength={LONGUEUR_MAX_PLAQUE + 1}
        placeholder="ex : ABC 123"
        className="champ"
        style={{ fontFamily: "monospace", letterSpacing: 1, maxWidth: 180 }}
        autoCapitalize="characters"
        spellCheck={false}
      />
    </div>
  );
}

// Liste déroulante avec une option « Autre… » qui ouvre un champ libre.
// Une valeur absente de la liste (véhicule plus ancien, entrée à la main)
// s'affiche directement dans le champ libre.
function ListeOuAutre({ label, valeur, options, groupes, onChange, desactive, aideDesactive, placeholderAutre, typeAutre = "text" }) {
  const [autreChoisi, setAutreChoisi] = useState(false);
  const chargement = !desactive && options == null;
  const horsListe = !!valeur && Array.isArray(options) && !options.includes(valeur);
  const modeAutre = !desactive && (autreChoisi || horsListe);

  function choisir(x) {
    if (x === AUTRE) {
      setAutreChoisi(true);
      onChange("");
    } else {
      setAutreChoisi(false);
      onChange(x);
    }
  }

  return (
    <div style={{ minWidth: 0 }}>
      <label className="etiquette">{label}</label>
      {modeAutre ? (
        <div style={{ display: "flex", gap: 4 }}>
          <input
            type={typeAutre}
            value={valeur}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholderAutre}
            className="champ"
            style={{ flex: 1, minWidth: 0 }}
            autoFocus={autreChoisi}
          />
          <button
            type="button"
            onClick={() => { setAutreChoisi(false); onChange(""); }}
            title="Revenir à la liste"
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", cursor: "pointer", padding: "0 8px" }}
          >
            ☰
          </button>
        </div>
      ) : (
        <select
          value={valeur || ""}
          onChange={(e) => choisir(e.target.value)}
          disabled={desactive || chargement}
          className="champ"
        >
          <option value="">{desactive ? aideDesactive || "—" : chargement ? "Chargement…" : "— Choisir —"}</option>
          {groupes
            ? groupes.filter((g) => g.options.length > 0).map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </optgroup>
              ))
            : (options || []).map((o) => <option key={o} value={o}>{o}</option>)}
          {!desactive && !chargement && <option value={AUTRE}>Autre…</option>}
        </select>
      )}
    </div>
  );
}

const grille = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", columnGap: 8 };
const messageErreur = { color: "var(--danger)", fontSize: 11.5, margin: "4px 0 0" };
const messageAvertissement = { color: "var(--accent)", fontSize: 11.5, margin: "4px 0 0" };
const messageInfo = { color: "var(--text-muted)", fontSize: 11.5, margin: "4px 0 0" };
