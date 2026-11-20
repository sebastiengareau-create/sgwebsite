"use client";

import { useEffect, useState } from "react";
import { FORMATS_ETIQUETTES_ELEVAGE } from "@/lib/elevageCalculs";
import { champStyle, labelStyle, boutonPrincipal, boutonLien, Erreur } from "./ui";

const CLE_FORMAT = "etiquettes_elevage_format";

// Réglages d'impression d'une planche d'étiquettes (format, nombre, position
// de départ sur une feuille entamée), puis ouverture du PDF dans un nouvel
// onglet, prêt à imprimer.
//  - type "viande" : paquets de la découpe d'une bête (recus, enStock : les
//    totaux ; lotIds : seulement certaines coupes) ;
//  - type "bete" : étiquette d'enclos, QR vers la fiche.
export default function EtiquettesElevage({ type, beteId, lotIds, recus = 0, enStock = 0, onFermer }) {
  const [format, setFormat] = useState(FORMATS_ETIQUETTES_ELEVAGE[0].code);
  const [mode, setMode] = useState("recus"); // viande : "recus" | "stock"
  const [nombre, setNombre] = useState("1"); // bête
  const [depart, setDepart] = useState("1");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  // Le format choisi est retenu sur cet appareil (une imprimante par poste)
  useEffect(() => {
    try {
      const memorise = localStorage.getItem(CLE_FORMAT);
      if (FORMATS_ETIQUETTES_ELEVAGE.some((f) => f.code === memorise)) setFormat(memorise);
    } catch {}
  }, []);

  const parFeuille = FORMATS_ETIQUETTES_ELEVAGE.find((f) => f.code === format)?.parFeuille || 30;
  const copies = type === "bete" ? Math.max(1, parseInt(nombre) || 1) : mode;
  const total = type === "bete" ? copies : mode === "stock" ? enStock : recus;
  const positionDepart = Math.min(parFeuille, Math.max(1, parseInt(depart) || 1));
  const feuilles = Math.ceil((total + positionDepart - 1) / parFeuille);

  async function imprimer() {
    setErreur("");
    try { localStorage.setItem(CLE_FORMAT, format); } catch {}
    // L'onglet est ouvert tout de suite, au clic : ouvert après la réponse
    // du serveur, il serait bloqué comme une fenêtre surgissante (iPhone).
    const onglet = window.open("", "_blank");
    setEnCours(true);
    const res = await fetch("/api/elevage/etiquettes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, beteId, lotIds, copies, format, depart: positionDepart, origine: window.location.origin }),
    });
    setEnCours(false);
    if (!res.ok) {
      onglet?.close();
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création des étiquettes.");
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    if (onglet) {
      onglet.location.href = url;
    } else {
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = "etiquettes.pdf";
      lien.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const option = (code, libelle) => (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
      <input type="radio" checked={mode === code} onChange={() => setMode(code)} />
      {libelle}
    </label>
  );

  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 12, padding: 12, margin: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 13.5 }}>🏷️ {type === "bete" ? "Étiquette de la bête" : "Étiquettes des paquets"}</strong>
        {onFermer && <button onClick={onFermer} style={{ ...boutonLien, color: "var(--text-muted)", fontSize: 13 }}>✕</button>}
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        {type === "bete"
          ? "Pour l'enclos ou le cartable d'étable : le code QR ouvre la fiche de la bête dans l'appli (pesée, soin…)."
          : "Une étiquette à coller sur chaque paquet reçu du boucher. Le code QR montre au client d'où vient sa viande, et sert à vendre le paquet en le scannant."}
      </p>

      <label style={labelStyle}>Planche d'étiquettes</label>
      <select value={format} onChange={(e) => setFormat(e.target.value)} style={champStyle}>
        {FORMATS_ETIQUETTES_ELEVAGE.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
      </select>

      {type === "bete" ? (
        <>
          <label style={labelStyle}>Nombre d'étiquettes</label>
          <input type="number" min={1} max={100} value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ ...champStyle, width: 90 }} />
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {option("recus", `Une par paquet reçu (${recus})`)}
          {option("stock", `Une par paquet encore en stock (${enStock})`)}
        </div>
      )}

      <label style={labelStyle}>Feuille déjà entamée ? Commencer à l'étiquette n° (1 à {parFeuille}, de gauche à droite)</label>
      <input type="number" min={1} max={parFeuille} value={depart} onChange={(e) => setDepart(e.target.value)} style={{ ...champStyle, width: 90 }} />
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
        À l'impression, choisis « Taille réelle » (100 %), pas « Ajuster à la page ».
      </p>

      <Erreur texte={erreur} />
      <button onClick={imprimer} disabled={enCours || total === 0} className="bouton-3d" style={boutonPrincipal}>
        {enCours ? "Préparation…" : total === 0 ? "Aucune étiquette à imprimer" : `Imprimer ${total} étiquette${total > 1 ? "s" : ""} (${feuilles} feuille${feuilles > 1 ? "s" : ""})`}
      </button>
    </div>
  );
}
