// Regroupement de bons / factures par journée (heure du Québec) — utilisé
// par les listes côté client, donc aucune dépendance serveur ici.

const FUSEAU = "America/Toronto";

// "YYYY-MM-DD" du jour calendaire au Québec
function cleJourQuebec(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
}

function decalerCle(cle, delta) {
  const [an, mois, jour] = cle.split("-").map(Number);
  const d = new Date(Date.UTC(an, mois - 1, jour + delta, 12));
  return d.toISOString().slice(0, 10);
}

// Date de référence d'un bon : sa date prévue (entrée à la création, ou
// celle du rendez-vous s'il vient du calendrier), sinon sa création.
function dateBon(bon) {
  return bon.datePrevue || bon.creeLe;
}

// Un bon est "planifié" quand il n'est pas commencé et que sa date prévue
// tombe un jour après aujourd'hui
function bonEstAVenir(bon, aujourdHui = cleJourQuebec(new Date())) {
  return bon.statut === "EN_ATTENTE" && !!bon.datePrevue && cleJourQuebec(bon.datePrevue) > aujourdHui;
}

function libelleJour(cle, aujourdHui = cleJourQuebec(new Date())) {
  if (cle === aujourdHui) return "Aujourd'hui";
  if (cle === decalerCle(aujourdHui, 1)) return "Demain";
  if (cle === decalerCle(aujourdHui, -1)) return "Hier";
  const [an] = cle.split("-").map(Number);
  const libelle = new Date(`${cle}T12:00:00Z`).toLocaleDateString("fr-CA", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long",
    year: an !== Number(aujourdHui.slice(0, 4)) ? "numeric" : undefined,
  });
  return libelle.charAt(0).toUpperCase() + libelle.slice(1);
}

// Regroupe des éléments par journée. Ordre : les jours à venir d'abord (le
// plus proche en premier), puis aujourd'hui et le passé (le plus récent en
// premier). Retourne [{ cle, libelle, aVenir, elements }].
function regrouperParJour(elements, obtenirDate) {
  const aujourdHui = cleJourQuebec(new Date());
  const groupes = new Map();
  for (const el of elements) {
    const cle = cleJourQuebec(obtenirDate(el));
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(el);
  }
  const cles = [...groupes.keys()];
  const futurs = cles.filter((c) => c > aujourdHui).sort();
  const passes = cles.filter((c) => c <= aujourdHui).sort().reverse();
  return [...futurs, ...passes].map((cle) => ({
    cle,
    libelle: libelleJour(cle, aujourdHui),
    aVenir: cle > aujourdHui,
    elements: groupes.get(cle).sort((a, b) => {
      const ecart = new Date(obtenirDate(a)) - new Date(obtenirDate(b));
      return cle > aujourdHui ? ecart : -ecart;
    }),
  }));
}

// "YYYY-MM-DDTHH:MM" en heure du Québec — valeur d'un <input type="datetime-local">
function valeurDateHeureLocale(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(date)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function heureQuebec(date) {
  return new Date(date).toLocaleTimeString("fr-CA", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit" });
}

export { cleJourQuebec, decalerCle, dateBon, bonEstAVenir, libelleJour, regrouperParJour, heureQuebec, valeurDateHeureLocale };
