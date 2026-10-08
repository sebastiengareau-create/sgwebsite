"use client";

import { useEffect, useRef, useState } from "react";

// Carte Leaflet (fonds OpenStreetMap), chargée à la demande depuis unpkg :
// rien à installer, et rien de chargé pour qui n'ouvre pas cet onglet.
const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist/leaflet";
let chargementLeaflet = null;
function chargerLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!chargementLeaflet) {
    chargementLeaflet = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = `${LEAFLET}.css`;
      document.head.appendChild(css);
      const script = document.createElement("script");
      script.src = `${LEAFLET}.js`;
      script.onload = () => resolve(window.L);
      script.onerror = () => { chargementLeaflet = null; reject(new Error("Impossible de charger la carte.")); };
      document.head.appendChild(script);
    });
  }
  return chargementLeaflet;
}

const PRECISION_MAX_TRAJET = 100; // m — points plus flous ignorés pour la distance

function distanceMetres(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function heure(iso) {
  return new Date(iso).toLocaleTimeString("fr-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit" });
}

function depuis(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

function aujourdhui() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
}

export default function CarteSuivi({ employes }) {
  const conteneur = useRef(null);
  const carte = useRef(null);
  const calque = useRef(null);
  const [erreur, setErreur] = useState("");
  const [dernieres, setDernieres] = useState([]);
  const [employeId, setEmployeId] = useState("");
  const [date, setDate] = useState(aujourdhui());
  const [trajet, setTrajet] = useState(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let annule = false;
    chargerLeaflet().then((L) => {
      if (annule || carte.current) return;
      carte.current = L.map(conteneur.current).setView([46.8, -71.2], 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "© OpenStreetMap",
      }).addTo(carte.current);
      calque.current = L.layerGroup().addTo(carte.current);
      setPret(true);
    }).catch((e) => setErreur(e.message));
    return () => { annule = true; carte.current?.remove(); carte.current = null; };
  }, []);

  // Dernière position de chacun, rafraîchie aux 30 s quand aucun trajet n'est affiché
  useEffect(() => {
    if (employeId) return;
    let actif = true;
    async function lire() {
      const res = await fetch("/api/positions");
      if (!res.ok || !actif) return;
      const data = await res.json();
      setDernieres(data.dernieres);
    }
    lire();
    const id = setInterval(lire, 30000);
    return () => { actif = false; clearInterval(id); };
  }, [employeId]);

  useEffect(() => {
    if (!employeId) { setTrajet(null); return; }
    let actif = true;
    fetch(`/api/positions?employeId=${encodeURIComponent(employeId)}&date=${date}`)
      .then((r) => r.json())
      .then((data) => { if (actif) setTrajet(data.points || []); });
    return () => { actif = false; };
  }, [employeId, date]);

  // Dessin : marqueurs des dernières positions, ou le trajet choisi
  useEffect(() => {
    if (!pret) return;
    const L = window.L;
    calque.current.clearLayers();

    if (!employeId) {
      const pts = dernieres.map((d) => {
        L.circleMarker([d.latitude, d.longitude], { radius: 8, color: "#17150f", weight: 2, fillColor: "#e0a526", fillOpacity: 1 })
          .bindTooltip(`${d.employe.nom} — ${depuis(d.enregistreLe)}`, { permanent: true, direction: "top", offset: [0, -8] })
          .addTo(calque.current);
        return [d.latitude, d.longitude];
      });
      if (pts.length === 1) carte.current.setView(pts[0], 14);
      else if (pts.length > 1) carte.current.fitBounds(pts, { padding: [40, 40] });
      return;
    }

    if (!trajet || trajet.length === 0) return;
    const ligne = trajet.map((p) => [p.latitude, p.longitude]);
    L.polyline(ligne, { color: "#4F82C0", weight: 4 }).addTo(calque.current);
    const debut = trajet[0];
    const fin = trajet[trajet.length - 1];
    L.circleMarker(ligne[0], { radius: 7, color: "#fff", weight: 2, fillColor: "#6FA96B", fillOpacity: 1 })
      .bindTooltip(`Départ ${heure(debut.enregistreLe)}`).addTo(calque.current);
    L.circleMarker(ligne[ligne.length - 1], { radius: 8, color: "#fff", weight: 2, fillColor: "#C0504F", fillOpacity: 1 })
      .bindTooltip(`Dernière position ${heure(fin.enregistreLe)}`, { permanent: true, direction: "top", offset: [0, -8] }).addTo(calque.current);
    carte.current.fitBounds(ligne, { padding: [40, 40], maxZoom: 16 });
  }, [pret, dernieres, trajet, employeId]);

  const precis = (trajet || []).filter((p) => p.precision === null || p.precision <= PRECISION_MAX_TRAJET);
  const km = precis.slice(1).reduce((s, p, i) => s + distanceMetres(precis[i], p), 0) / 1000;
  const bonsVisites = [...new Set((trajet || []).map((p) => p.envoi?.bon.numero).filter(Boolean))];

  return (
    <div className="conteneur-page-large" style={{ margin: "0 auto", padding: "0 16px 24px" }}>
      <div className="carte">
        <div className="titre-section">📍 Suivi GPS des employés</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
          Positions partagées par les employés depuis « Mes tâches » (seulement pendant qu'ils partagent). Gardées 90 jours.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <select className="champ" value={employeId} onChange={(e) => setEmployeId(e.target.value)} style={{ flex: "1 1 200px", width: "auto" }}>
            <option value="">Tous — dernière position (24 h)</option>
            {employes.map((e) => <option key={e.id} value={e.id}>Trajet de {e.nom}</option>)}
          </select>
          {employeId && (
            <input type="date" className="champ" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} style={{ flex: "0 1 170px", width: "auto" }} />
          )}
        </div>
        {erreur && <p style={{ color: "var(--danger)", fontSize: 12 }}>{erreur}</p>}
        <div ref={conteneur} style={{ height: 420, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg)" }} />
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          {!employeId && (dernieres.length === 0 ? "Personne n'a partagé sa position dans les dernières 24 h." : `${dernieres.length} employé(s) sur la carte · rafraîchi aux 30 s`)}
          {employeId && trajet && (trajet.length === 0
            ? "Aucune position enregistrée cette journée-là."
            : `${trajet.length} positions · de ${heure(trajet[0].enregistreLe)} à ${heure(trajet[trajet.length - 1].enregistreLe)} · ≈ ${km.toFixed(1)} km parcourus${bonsVisites.length ? ` · bons : ${bonsVisites.map((n) => `#${n}`).join(", ")}` : ""}`)}
        </div>
      </div>
    </div>
  );
}
