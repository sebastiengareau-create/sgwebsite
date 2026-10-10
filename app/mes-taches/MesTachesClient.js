"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STATUTS_ENVOI } from "@/lib/statutsEnvoi";
import { dateCourteQuebec, heureQuebec } from "@/lib/regroupementDates";
import ActivationNotifications from "../components/ActivationNotifications";

// Prochaine étape proposée à l'employé selon où en est l'envoi
const PROCHAINE = {
  ENVOYE: { statut: "EN_ROUTE", label: "🚗 Je pars (en route)" },
  VU: { statut: "EN_ROUTE", label: "🚗 Je pars (en route)" },
  EN_ROUTE: { statut: "SUR_PLACE", label: "📍 Je suis arrivé" },
  SUR_PLACE: { statut: "TERMINE", label: "✅ Tâche terminée" },
};

const CLE_PARTAGE = "partage_gps_actif";
const INTERVALLE_ENVOI = 20000; // ms entre deux paquets envoyés au serveur
const ECART_MIN_MS = 10000; // au plus un point aux 10 s…
const ECART_MIN_M = 25; // …sauf s'il a bougé de plus de 25 m

function lireStockage() {
  try { return localStorage.getItem(CLE_PARTAGE) === "1"; } catch { return false; }
}
function ecrireStockage(actif) {
  try { actif ? localStorage.setItem(CLE_PARTAGE, "1") : localStorage.removeItem(CLE_PARTAGE); } catch {}
}

function metres(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const x = rad(b.lng - a.lng) * Math.cos(rad((a.lat + b.lat) / 2));
  const y = rad(b.lat - a.lat);
  return Math.sqrt(x * x + y * y) * 6371000;
}

// Partage de la position : suit le GPS du téléphone tant que la page est
// ouverte (un navigateur ne peut pas suivre en arrière-plan), garde l'écran
// allumé si possible, et envoie les points par paquets — ceux pris hors
// ligne partent au retour du réseau.
function usePartagePosition(envoiId) {
  const [actif, setActif] = useState(false);
  const [etat, setEtat] = useState("");
  const tampon = useRef([]);
  const dernier = useRef(null);
  const envoiCourant = useRef(envoiId);
  envoiCourant.current = envoiId;

  useEffect(() => { if (lireStockage()) setActif(true); }, []);

  useEffect(() => {
    if (!actif) return;
    if (!("geolocation" in navigator)) {
      setEtat("Ce téléphone ne permet pas la localisation.");
      setActif(false);
      return;
    }

    let verrou = null;
    async function garderEcranAllume() {
      try { if ("wakeLock" in navigator && document.visibilityState === "visible") verrou = await navigator.wakeLock.request("screen"); } catch {}
    }

    async function vider(viaBeacon = false) {
      if (tampon.current.length === 0) return;
      const points = tampon.current.splice(0, 200);
      const corps = JSON.stringify({ points, envoiId: envoiCourant.current });
      if (viaBeacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/positions", new Blob([corps], { type: "application/json" }));
        return;
      }
      try {
        const res = await fetch("/api/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: corps });
        if (!res.ok) throw new Error();
        setEtat(`Position envoyée à ${new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`);
      } catch {
        tampon.current = [...points, ...tampon.current].slice(-1000); // réessayé au prochain envoi
        setEtat("Hors ligne — les positions seront envoyées au retour du réseau.");
      }
    }

    const surveillance = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy, vitesse: pos.coords.speed, t: pos.timestamp };
        const d = dernier.current;
        if (d && p.t - d.t < ECART_MIN_MS && metres(d, p) < ECART_MIN_M) return;
        dernier.current = p;
        tampon.current.push(p);
        if (!d) vider(); // premier point : tout de suite
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setEtat("Localisation refusée — autorise-la pour ce site dans les réglages du navigateur.");
          setActif(false);
          ecrireStockage(false);
        } else {
          setEtat("Signal GPS introuvable pour l'instant…");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    const minuterie = setInterval(() => vider(), INTERVALLE_ENVOI);
    function visibilite() {
      if (document.visibilityState === "hidden") vider(true);
      else garderEcranAllume();
    }
    document.addEventListener("visibilitychange", visibilite);
    garderEcranAllume();
    setEtat("Recherche du signal GPS…");

    return () => {
      navigator.geolocation.clearWatch(surveillance);
      clearInterval(minuterie);
      document.removeEventListener("visibilitychange", visibilite);
      verrou?.release().catch(() => {});
      vider(true);
      dernier.current = null;
    };
  }, [actif]);

  function changer(valeur) {
    ecrireStockage(valeur);
    setActif(valeur);
    if (!valeur) setEtat("");
  }
  return { actif, etat, demarrer: () => changer(true), arreter: () => changer(false) };
}

export default function MesTachesClient({ envois, clePublique }) {
  const router = useRouter();
  const [occupe, setOccupe] = useState(null);
  const [erreur, setErreur] = useState("");

  const actifs = envois.filter((e) => PROCHAINE[e.statut]);
  const termines = envois.filter((e) => e.statut === "TERMINE");
  const enDeplacement = actifs.find((e) => e.statut === "EN_ROUTE") || actifs.find((e) => e.statut === "SUR_PLACE");
  const partage = usePartagePosition(enDeplacement?.id || null);

  async function avancer(envoi) {
    const etape = PROCHAINE[envoi.statut];
    setErreur("");
    setOccupe(envoi.id);
    const res = await fetch(`/api/envois/${envoi.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: etape.statut }),
    });
    setOccupe(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || `Erreur (code ${res.status}).`);
      return;
    }
    if (etape.statut === "EN_ROUTE") partage.demarrer();
    if (etape.statut === "TERMINE" && actifs.length === 1) partage.arreter();
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>📲 Mes tâches</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>Les bons qui t'ont été envoyés. Indique où tu en es à chaque étape.</p>

      <ActivationNotifications clePublique={clePublique} />

      <div className="carte carte-m" style={{ marginBottom: 16, borderLeft: `3px solid ${partage.actif ? "#6FA96B" : "var(--border)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{partage.actif ? "🟢 Position partagée avec le bureau" : "📍 Partage de position arrêté"}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {partage.etat || "Démarre automatiquement quand tu pars vers un client."}
            </div>
          </div>
          <button
            className={partage.actif ? "bouton-3d-sombre" : "bouton-3d"}
            onClick={partage.actif ? partage.arreter : partage.demarrer}
            style={{ fontSize: 12, padding: "8px 12px", borderRadius: 10, whiteSpace: "nowrap" }}
          >
            {partage.actif ? "Arrêter" : "Partager"}
          </button>
        </div>
        {partage.actif && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>
            Garde cette page ouverte pendant le déplacement : si tu changes d'application ou que l'écran se verrouille, le suivi s'interrompt jusqu'à ton retour.
          </p>
        )}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12 }}>{erreur}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {actifs.map((e) => <CarteEnvoi key={e.id} envoi={e} occupe={occupe === e.id} onAvancer={() => avancer(e)} />)}
        {actifs.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune tâche en attente. 👍</p>}
      </div>

      {termines.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="titre-section">Terminées aujourd'hui ({termines.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {termines.map((e) => <CarteEnvoi key={e.id} envoi={e} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function CarteEnvoi({ envoi, occupe, onAvancer }) {
  const { bon } = envoi;
  const statut = STATUTS_ENVOI[envoi.statut];
  const etape = PROCHAINE[envoi.statut];
  const adresse = [bon.client.adresse, bon.client.ville, bon.client.codePostal].filter(Boolean).join(", ");
  const vehicule = bon.vehicule && [bon.vehicule.annee, bon.vehicule.marque, bon.vehicule.modele].filter(Boolean).join(" ");

  return (
    <div className="carte carte-m" style={{ borderLeft: `3px solid ${statut.color}`, opacity: etape ? 1 : 0.7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>#{bon.numero}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: statut.color }}>● {statut.label}</span>
      </div>
      <div style={{ fontWeight: 600 }}>{bon.client.nom}</div>
      {vehicule && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>🚘 {vehicule}{bon.vehicule.plaque ? ` · ${bon.vehicule.plaque}` : ""}</div>}
      {bon.datePrevue && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>🕒 {dateCourteQuebec(bon.datePrevue)} à {heureQuebec(bon.datePrevue)}</div>}
      {adresse && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`}
          target="_blank"
          rel="noreferrer"
          style={{ display: "block", fontSize: 12, color: "var(--accent)", textDecoration: "none", marginTop: 2 }}
        >
          📍 {adresse} — itinéraire
        </a>
      )}
      {bon.client.telephone && (
        <a href={`tel:${bon.client.telephone}`} style={{ display: "block", fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>
          📞 {bon.client.telephone}
        </a>
      )}
      {bon.problemes.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
          {bon.problemes.map((p) => <li key={p.id}>{p.description}</li>)}
        </ul>
      )}
      {envoi.message && <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--text-muted)", marginTop: 6 }}>Note du bureau : « {envoi.message} »</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }}>
        <Link href={`/bons/${bon.id}`} style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>Voir la fiche complète →</Link>
        {etape && (
          <button className="bouton-3d" disabled={occupe} onClick={onAvancer} style={{ fontSize: 12, padding: "9px 14px", borderRadius: 10, fontWeight: 700 }}>
            {occupe ? "…" : etape.label}
          </button>
        )}
      </div>
    </div>
  );
}
