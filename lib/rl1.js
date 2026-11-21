// RL-1 (Revenu Québec). Revenu Québec n'accepte le fichier XML des relevés
// que d'un logiciel qu'il a certifié pour l'année : le concepteur
// (kontrolshop, pas chaque garage) s'inscrit comme partenaire auprès de la
// Direction des relations avec les partenaires, reçoit un identifiant de
// partenaire et de produit (16 caractères) et le schéma XML, réussit les
// fichiers d'essai, puis reçoit un numéro de certification (« RQ… »),
// à renouveler chaque année. Courriel : edi@revenuquebec.ca.
//
// Tant que la certification de l'année n'est pas inscrite ci-dessous, les
// RL-1 se saisissent dans Mon dossier pour les entreprises de Revenu
// Québec, à partir du sommaire de kontrolshop (lib/feuilletsFiscaux.js).
// Quand elle l'est, le fichier XML se branche ici, d'après le schéma remis
// par Revenu Québec.
export const CERTIFICATION_RQ = {
  annee: null, // année des relevés couverte par la certification
  idPartenaire: null,
  idProduit: null,
  noCertification: null,
};

export const rqValide = (no) => /^\d{10}RS\d{4}$/.test(String(no || "")) && !/0000$/.test(no);

// État du RL-1 pour l'année → { certifie, numeroRqValide }
export function etatRl1(annee, entreprise) {
  const c = CERTIFICATION_RQ;
  return {
    certifie: !!(c.annee === annee && c.idPartenaire && c.idProduit && c.noCertification),
    numeroRqValide: rqValide(entreprise.numeroEmployeurRq),
  };
}
