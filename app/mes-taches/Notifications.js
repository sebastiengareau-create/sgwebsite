"use client";

import { useEffect, useState } from "react";

// Clé publique VAPID (texte base64url) → octets attendus par le navigateur
function enOctets(base64) {
  const complet = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(complet), (c) => c.charCodeAt(0));
}

function estIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function estInstallee() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

async function enregistrer(abonnement) {
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ abonnement: abonnement.toJSON(), appareil: navigator.userAgent }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).erreur || `Erreur (code ${res.status}).`);
}

// Activation des notifications sur ce téléphone — l'avis gratuit d'un bon
// envoyé (voir lib/notifications.js)
export default function Notifications({ clePublique }) {
  // "…" | "non-supporte" | "ios-installer" | "refuse" | "inactif" | "actif"
  const [etat, setEtat] = useState("…");
  const [info, setInfo] = useState("");
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setEtat(estIos() && !estInstallee() ? "ios-installer" : "non-supporte");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const abonnement = await reg.pushManager.getSubscription();
        if (abonnement && Notification.permission === "granted") {
          await enregistrer(abonnement); // rattache le téléphone à l'employé connecté
          setEtat("actif");
        } else {
          setEtat(Notification.permission === "denied" ? "refuse" : "inactif");
        }
      } catch {
        setEtat("inactif");
      }
    })();
  }, []);

  async function activer() {
    setOccupe(true);
    setInfo("");
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setEtat("refuse");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const abonnement = (await reg.pushManager.getSubscription())
        || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: enOctets(clePublique) }));
      await enregistrer(abonnement);
      setEtat("actif");
      await tester();
    } catch (e) {
      setInfo(`Activation impossible sur ce téléphone${e.message ? ` (${e.message})` : ""}.`);
    } finally {
      setOccupe(false);
    }
  }

  async function desactiver() {
    setOccupe(true);
    setInfo("");
    const reg = await navigator.serviceWorker.ready;
    const abonnement = await reg.pushManager.getSubscription();
    if (abonnement) {
      await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: abonnement.endpoint }) });
      await abonnement.unsubscribe().catch(() => {});
    }
    setEtat("inactif");
    setOccupe(false);
  }

  async function tester() {
    setInfo("");
    const res = await fetch("/api/push/test", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setInfo(res.ok ? "Notification test envoyée — elle devrait apparaître dans quelques secondes." : data.erreur || "Échec du test.");
  }

  if (etat === "…") return null;
  const actif = etat === "actif";

  return (
    <div className="carte carte-m" style={{ marginBottom: 12, borderLeft: `3px solid ${actif ? "#6FA96B" : "#C9A227"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{actif ? "🔔 Notifications activées" : "🔕 Notifications désactivées"}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {etat === "actif" && "Tu seras averti sur ce téléphone quand un bon t'est envoyé."}
            {etat === "inactif" && "Active-les pour être averti dès qu'un bon t'est envoyé."}
            {etat === "refuse" && "Bloquées pour ce site : autorise les notifications dans les réglages du navigateur, puis reviens ici."}
            {etat === "ios-installer" && "Sur iPhone : touche Partager (□↑) puis « Sur l'écran d'accueil », ouvre l'app depuis l'icône, et reviens ici."}
            {etat === "non-supporte" && "Ce navigateur ne permet pas les notifications — utilise Chrome (Android) ou Safari (iPhone)."}
          </div>
        </div>
        {etat === "inactif" && (
          <button className="bouton-3d" disabled={occupe} onClick={activer} style={{ fontSize: 12, padding: "8px 12px", borderRadius: 10, whiteSpace: "nowrap" }}>
            {occupe ? "…" : "Activer"}
          </button>
        )}
        {actif && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button className="bouton-3d-sombre" disabled={occupe} onClick={tester} style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8 }}>Tester</button>
            <button className="bouton-3d-sombre" disabled={occupe} onClick={desactiver} style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8 }}>Désactiver</button>
          </div>
        )}
      </div>
      {info && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>{info}</p>}
    </div>
  );
}
