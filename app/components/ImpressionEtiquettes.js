"use client";

import { useEffect, useState } from "react";
import { FORMATS_ETIQUETTES } from "@/lib/codesBarres";

const CLE_FORMAT = "etiquettes_format";

// Réglages d'impression d'étiquettes (format Zebra ou Avery 5160, nombre de
// copies, position de départ sur une feuille entamée), puis ouverture du PDF
// dans un nouvel onglet, prêt à imprimer.
// pieces : [{ id, qte }]. uneSeule : fiche d'une pièce (nombre de copies libre).
// nomEntreprise : imprimé en première ligne, montré ici pour qu'on sache
// d'avance ce qui sortira.
export default function ImpressionEtiquettes({ pieces, uneSeule = false, nomEntreprise, onFermer }) {
  const [format, setFormat] = useState(FORMATS_ETIQUETTES[0].code);
  const [modeCopies, setModeCopies] = useState("une"); // "une" | "stock" | "nombre"
  const [nombre, setNombre] = useState("1");
  const [depart, setDepart] = useState("1");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  // Le format choisi est retenu sur cet appareil (une imprimante par poste).
  useEffect(() => {
    try {
      const memorise = localStorage.getItem(CLE_FORMAT);
      if (FORMATS_ETIQUETTES.some((f) => f.code === memorise)) setFormat(memorise);
    } catch {}
  }, []);

  const estFeuille = FORMATS_ETIQUETTES.find((f) => f.code === format)?.feuille;
  const copies = modeCopies === "stock" ? "stock" : modeCopies === "nombre" ? Math.max(1, parseInt(nombre) || 1) : 1;
  const total = pieces.reduce((s, p) => s + (copies === "stock" ? Math.max(0, p.qte) : copies), 0);

  async function imprimer() {
    setErreur("");
    try { localStorage.setItem(CLE_FORMAT, format); } catch {}
    // L'onglet est ouvert tout de suite, au clic : ouvert après la réponse
    // du serveur, il serait bloqué comme une fenêtre surgissante (iPhone).
    const onglet = window.open("", "_blank");
    setEnCours(true);
    const res = await fetch("/api/inventaire/etiquettes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        elements: pieces.map((p) => ({ id: p.id, copies })),
        format,
        depart: estFeuille ? Math.min(30, Math.max(1, parseInt(depart) || 1)) : 1,
        origine: window.location.origin,
      }),
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

  const optionCopies = (code, libelle) => (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
      <input type="radio" name="copies" checked={modeCopies === code} onChange={() => setModeCopies(code)} />
      {libelle}
    </label>
  );

  return (
    <div className="carte carte-m" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>🏷️ Imprimer {uneSeule ? "l'étiquette" : `les étiquettes (${pieces.length} pièce${pieces.length > 1 ? "s" : ""})`}</strong>
        {onFermer && <button onClick={onFermer} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>✕</button>}
      </div>

      {nomEntreprise && (
        <p style={{ fontSize: 11.5, margin: "0 0 8px", color: "var(--text-muted)" }}>
          Première ligne : <strong style={{ color: "var(--text)" }}>{nomEntreprise}</strong>
          <span> (Administrateur → Informations de l'entreprise)</span>
        </p>
      )}

      <label style={labelStyle}>Imprimante / format</label>
      <select value={format} onChange={(e) => setFormat(e.target.value)} style={champStyle}>
        {FORMATS_ETIQUETTES.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
      </select>

      <label style={labelStyle}>Nombre d'étiquettes</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
        {optionCopies("une", uneSeule ? "Une seule (pour la tablette)" : "Une par pièce (pour les tablettes)")}
        {optionCopies("stock", "Une par unité en stock (pour coller sur chaque pièce)")}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {optionCopies("nombre", uneSeule ? "Nombre :" : "Nombre par pièce :")}
          <input
            type="number" min={1} value={nombre}
            onChange={(e) => { setNombre(e.target.value); setModeCopies("nombre"); }}
            style={{ ...champStyle, width: 70, marginBottom: 0, padding: "5px 8px" }}
          />
        </div>
      </div>

      {estFeuille && (
        <>
          <label style={labelStyle}>Feuille déjà entamée ? Commencer à l'étiquette n° (1 à 30, de gauche à droite)</label>
          <input type="number" min={1} max={30} value={depart} onChange={(e) => setDepart(e.target.value)} style={{ ...champStyle, width: 90 }} />
          <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "0 0 8px" }}>
            À l'impression, choisis « Taille réelle » (100 %), pas « Ajuster à la page ».
          </p>
        </>
      )}
      {!estFeuille && (
        <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "0 0 8px" }}>
          Une page par étiquette, à la taille du rouleau. À l'impression, choisis la Zebra et « Taille réelle ».
        </p>
      )}

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{erreur}</p>}
      <button onClick={imprimer} disabled={enCours || total === 0} className="bouton-3d" style={{ width: "100%", padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
        {enCours ? "Préparation…" : total === 0 ? "Aucune étiquette (stock à zéro)" : `Imprimer ${total} étiquette${total > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}

const champStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 3 };
