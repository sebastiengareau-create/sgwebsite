// Service worker — reçoit les notifications envoyées par le serveur
// (lib/notifications.js), met à jour la pastille de l'icône de l'app (nombre
// de non lues) et ouvre la bonne page quand on les touche.
// Volontairement minimal : pas de cache hors ligne.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let donnees = {};
  try { donnees = event.data ? event.data.json() : {}; } catch { donnees = { corps: event.data && event.data.text() }; }
  event.waitUntil(Promise.all([
    self.registration.showNotification(donnees.titre || "Notification", {
      body: donnees.corps || "",
      icon: donnees.icone || "/icon-192.png",
      tag: donnees.tag,
      renotify: !!donnees.tag,
      data: { url: donnees.url || "/notifications" },
    }),
    majPastille(donnees.nonLues),
    // Pages ouvertes : la cloche se met à jour tout de suite
    self.clients.matchAll({ type: "window" }).then((fenetres) => fenetres.forEach((f) => f.postMessage({ type: "notification", nonLues: donnees.nonLues }))),
  ]));
});

// Pastille sur l'icône de l'app (iPhone : app ajoutée à l'écran d'accueil ;
// Android/ordinateur selon le navigateur) — ignorée si non prise en charge
function majPastille(nombre) {
  if (typeof nombre !== "number" || !self.navigator.setAppBadge) return Promise.resolve();
  return (nombre > 0 ? self.navigator.setAppBadge(nombre) : self.navigator.clearAppBadge()).catch(() => {});
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => f.url.startsWith(self.location.origin));
      if (ouverte) return ouverte.navigate(url).then((f) => (f || ouverte).focus());
      return self.clients.openWindow(url);
    })
  );
});
