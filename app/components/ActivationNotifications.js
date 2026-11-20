"use client";

import { useEffect, useState } from "react";
import { Icone, TEINTES, BoutonAction } from "./StyleSection";

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

// Activation des notifications sur ce téléphone (voir lib/notifications.js)
// — page Notifications et « Mes tâches ». Obligatoires : une fois activées,
// pas de bouton pour les désactiver
export default function ActivationNotifications({ clePublique }) {
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

  async function tester() {
    setInfo("");
    const res = await fetch("/api/push/test", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setInfo(res.ok ? "Notification test envoyée — elle devrait apparaître dans quelques secondes." : data.erreur || "Échec du test.");
  }

  if (etat === "…") return null;
  const actif = etat === "actif";

  const teinte = actif ? TEINTES.vert : { couleur: "var(--avertissement)", fond: "var(--avertissement-fond)" };

  return (
    <div style={{ background: "var(--surface)", border: `1.5px solid ${teinte.couleur}`, borderRadius: 18, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: teinte.fond, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom={actif ? "cloche" : "bloque"} taille={20} couleur={teinte.couleur} />
        </span>
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{actif ? "Notifications activées" : "Notifications désactivées"}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            {etat === "actif" && "Tes notifications arrivent sur ce téléphone, même l'app fermée."}
            {etat === "inactif" && "Active-les pour être averti sur ce téléphone, même l'app fermée."}
            {etat === "refuse" && "Bloquées pour ce site : autorise les notifications dans les réglages du navigateur, puis reviens ici."}
            {etat === "ios-installer" && "Sur iPhone : touche Partager (□↑) puis « Sur l'écran d'accueil », ouvre l'app depuis l'icône, et reviens ici."}
            {etat === "non-supporte" && "Ce navigateur ne permet pas les notifications — utilise Chrome (Android) ou Safari (iPhone)."}
          </div>
        </div>
        {etat === "inactif" && (
          <button className="bouton-3d" disabled={occupe} onClick={activer} style={{ fontSize: 13.5, fontWeight: 700, padding: "10px 16px", borderRadius: 12, whiteSpace: "nowrap" }}>
            {occupe ? "…" : "Activer"}
          </button>
        )}
        {actif && (
          <BoutonAction icone="cloche" couleur="var(--success)" compact disabled={occupe} onClick={tester} style={{ padding: "8px 12px" }}>Tester</BoutonAction>
        )}
      </div>
      {info && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "10px 0 0" }}>{info}</p>}
    </div>
  );
}
