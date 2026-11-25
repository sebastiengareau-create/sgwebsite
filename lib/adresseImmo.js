// Adresse civique séparée en numéro et rue, pour les cases du bail
// « 220 rue Richelieu » → ["220", "rue Richelieu"]
export function separerAdresse(adresse) {
  const a = String(adresse || "").trim();
  const m = /^(\d+[A-Za-z]?(?:[-–]\d+[A-Za-z]?)?)[\s,]+(.+)$/.exec(a);
  return m ? [m[1], m[2]] : ["", a];
}

