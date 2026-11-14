"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Icone, TEINTES, Pastille, stylePanneau } from "../components/StyleSection";

// Pointage de quart (lib/quarts.js) : arrivée, dîner, pause, départ — le
// temps de présence, distinct des chronos par tâche juste en dessous.
const heure = (iso) => new Date(iso).toLocaleTimeString("fr-CA", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" });

function Duree({ depuis }) {
  const calcul = () => {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(depuis).getTime()) / 60000));
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
  };
  const [texte, setTexte] = useState(calcul);
  useEffect(() => {
    const id = setInterval(() => setTexte(calcul()), 30000);
    return () => clearInterval(id);
  }, [depuis]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{texte}</span>;
}

export default function MonQuart({ travail, coupure, nbChronos }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState("");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");

  async function pointer(action) {
    if (action === "depart" && !window.confirm(nbChronos > 0 ? "Pointer ton départ ? Tes chronos en cours seront arrêtés." : "Pointer ton départ ?")) return;
    setErreur(""); setInfo(""); setEnCours(action);
    const res = await fetch("/api/quarts/pointer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await res.json().catch(() => ({}));
    setEnCours("");
    if (!res.ok) { setErreur(data.erreur || `Erreur (code ${res.status}).`); return; }
    if (data.chronosArretes > 0) setInfo(`${data.chronosArretes} chrono${data.chronosArretes > 1 ? "s" : ""} de tâche arrêté${data.chronosArretes > 1 ? "s" : ""}.`);
    router.refresh();
  }

  const bouton = (action, libelle, { plein, danger } = {}) => (
    <button
      key={action} type="button" onClick={() => pointer(action)} disabled={!!enCours}
      style={{
        flex: "1 1 120px", padding: "12px 14px", borderRadius: 12, fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
        background: plein ? "var(--success)" : danger ? "var(--danger-fond)" : "var(--bg)",
        color: plein ? "#fff" : danger ? "var(--danger)" : "var(--text)",
        border: `1px solid ${plein ? "var(--success)" : danger ? "var(--danger)" : "var(--border)"}`, opacity: enCours ? 0.6 : 1,
      }}
    >
      {enCours === action ? "…" : libelle}
    </button>
  );

  const nomCoupure = coupure?.type === "DINER" ? "dîner" : "pause";
  const etat = !travail
    ? { texte: "Arrivée non pointée", detail: "Pointe ton arrivée pour commencer ta journée.", pastille: null }
    : coupure
      ? { texte: `En ${nomCoupure} depuis ${heure(coupure.debut)}`, detail: <>Quart commencé à {heure(travail.debut)}</>, pastille: { libelle: coupure.type === "DINER" ? "Dîner" : "Pause", couleur: TEINTES.ambre.couleur, fond: TEINTES.ambre.fond } }
      : { texte: `En quart depuis ${heure(travail.debut)}`, detail: <>Présent depuis <Duree depuis={travail.debut} /></>, pastille: { libelle: "Présent", couleur: "var(--success)", fond: "var(--success-fond)" } };

  return (
    <div style={{ ...stylePanneau, borderColor: travail && !coupure ? "var(--success)" : "var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: TEINTES.vert.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom="horloge" taille={20} couleur={TEINTES.vert.couleur} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Mon quart</div>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{etat.texte}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{etat.detail}</div>
        </div>
        {etat.pastille && <Pastille couleur={etat.pastille.couleur} fond={etat.pastille.fond}>{etat.pastille.libelle}</Pastille>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {!travail && bouton("arrivee", "Pointer mon arrivée", { plein: true })}
        {travail && coupure && bouton("retour", `Fin ${coupure.type === "DINER" ? "du dîner" : "de la pause"}`, { plein: true })}
        {travail && !coupure && bouton("diner", "Dîner")}
        {travail && !coupure && bouton("pause", "Pause")}
        {travail && bouton("depart", "Pointer mon départ", { danger: true })}
      </div>
      {!travail && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>Si tu démarres une tâche sans avoir pointé, ton quart s'ouvre tout seul à ce moment-là.</p>}
      {info && <div style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 8 }}>{info}</div>}
      {erreur && <div style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 8 }}>{erreur}</div>}
    </div>
  );
}
