// Jours fériés, chômés et payés au Québec (Loi sur les normes du travail,
// art. 60, et Loi sur la fête nationale) — les huit jours qui donnent droit
// à l'indemnité calculée dans lib/heuresPaie.js.

// Date de Pâques (dimanche), calendrier grégorien — algorithme de Meeus
function paques(annee) {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(annee, mois - 1, jour));
}

const versStr = (date) => date.toISOString().slice(0, 10);
const decaler = (date, jours) => new Date(date.getTime() + jours * 86400000);
const jourSemaine = (date) => date.getUTCDay(); // 0 = dimanche

// n-ième lundi d'un mois (mois de 1 à 12)
function niemeLundi(annee, mois, n) {
  const premier = new Date(Date.UTC(annee, mois - 1, 1));
  const versLundi = (8 - jourSemaine(premier)) % 7;
  return decaler(premier, versLundi + 7 * (n - 1));
}

// Liste des jours fériés d'une année : [{ dateStr: "AAAA-MM-JJ", nom }].
// `conge de Pâques` : le Vendredi saint ou le lundi de Pâques, au choix de
// l'employeur ("VENDREDI" par défaut, ou "LUNDI").
function joursFeriesQuebec(annee, { paques: congePaques = "VENDREDI" } = {}) {
  const dimanchePaques = paques(annee);
  // Lundi qui précède le 25 mai
  const le25Mai = new Date(Date.UTC(annee, 4, 25));
  const patriotes = decaler(le25Mai, -(((jourSemaine(le25Mai) + 6) % 7) || 7));
  // Fête nationale : le 24 juin ; un dimanche, le congé est reporté au 25
  const le24Juin = new Date(Date.UTC(annee, 5, 24));
  const feteNationale = jourSemaine(le24Juin) === 0 ? decaler(le24Juin, 1) : le24Juin;
  // Fête du Canada : le 1er juillet ; un dimanche, le 2 juillet
  const le1erJuillet = new Date(Date.UTC(annee, 6, 1));
  const feteCanada = jourSemaine(le1erJuillet) === 0 ? decaler(le1erJuillet, 1) : le1erJuillet;

  return [
    { date: new Date(Date.UTC(annee, 0, 1)), nom: "Jour de l'An" },
    congePaques === "LUNDI"
      ? { date: decaler(dimanchePaques, 1), nom: "Lundi de Pâques" }
      : { date: decaler(dimanchePaques, -2), nom: "Vendredi saint" },
    { date: patriotes, nom: "Journée nationale des patriotes" },
    { date: feteNationale, nom: "Fête nationale" },
    { date: feteCanada, nom: "Fête du Canada" },
    { date: niemeLundi(annee, 9, 1), nom: "Fête du Travail" },
    { date: niemeLundi(annee, 10, 2), nom: "Action de grâces" },
    { date: new Date(Date.UTC(annee, 11, 25)), nom: "Jour de Noël" },
  ].map((f) => ({ dateStr: versStr(f.date), nom: f.nom }));
}

// Jours fériés compris entre deux dates "AAAA-MM-JJ", bornes incluses
function joursFeriesEntre(debutStr, finStr, options) {
  const feries = [];
  for (let annee = Number(debutStr.slice(0, 4)); annee <= Number(finStr.slice(0, 4)); annee++) {
    feries.push(...joursFeriesQuebec(annee, options).filter((f) => f.dateStr >= debutStr && f.dateStr <= finStr));
  }
  return feries;
}

module.exports = { joursFeriesQuebec, joursFeriesEntre };
