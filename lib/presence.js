// Qui est en ligne : selon la dernière activité notée dans le logiciel
// (User.derniereActivite, mise à jour par obtenirSession au plus aux 2 min,
// vidée à la déconnexion). Pas du temps réel : une personne qui ferme son
// navigateur sans se déconnecter reste « en ligne » jusqu'à 10 minutes.
// Aucune dépendance serveur.

const EN_LIGNE_MINUTES = 10;

function estEnLigne(derniereActivite, maintenant = new Date()) {
  return !!derniereActivite && maintenant - new Date(derniereActivite) < EN_LIGNE_MINUTES * 60 * 1000;
}

// « En ligne », « il y a 25 min », « aujourd'hui à 14 h 05 », « le 12 oct. »
function texteDerniereActivite(derniereActivite, maintenant = new Date()) {
  if (!derniereActivite) return "Jamais ou déconnecté";
  const date = new Date(derniereActivite);
  if (estEnLigne(date, maintenant)) return "En ligne";
  const minutes = Math.round((maintenant - date) / 60000);
  if (minutes < 60) return `Il y a ${minutes} min`;
  const fuseau = { timeZone: "America/Toronto" };
  const jour = (d) => d.toLocaleDateString("fr-CA", fuseau);
  if (jour(date) === jour(maintenant)) return `Aujourd'hui à ${date.toLocaleTimeString("fr-CA", { ...fuseau, hour: "numeric", minute: "2-digit" })}`;
  return `Le ${date.toLocaleDateString("fr-CA", { ...fuseau, day: "numeric", month: "short", year: date.getFullYear() === maintenant.getFullYear() ? undefined : "numeric" })}`;
}

module.exports = { EN_LIGNE_MINUTES, estEnLigne, texteDerniereActivite };
