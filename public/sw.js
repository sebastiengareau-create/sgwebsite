// Service worker — reçoit les notifications envoyées par le serveur
// (lib/notifications.js) et ouvre la bonne page quand on les touche.
// Volontairement minimal : pas de cache hors ligne.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let donnees = {};
  try { donnees = event.data ? event.data.json() : {}; } catch { donnees = { corps: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(donnees.titre || "Nouvelle tâche", {
      body: donnees.corps || "",
      icon: donnees.icone || "/icon-192.png",
      tag: donnees.tag,
      renotify: !!donnees.tag,
      data: { url: donnees.url || "/mes-taches" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/mes-taches", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => f.url.startsWith(self.location.origin));
      if (ouverte) return ouverte.navigate(url).then((f) => (f || ouverte).focus());
      return self.clients.openWindow(url);
    })
  );
});
