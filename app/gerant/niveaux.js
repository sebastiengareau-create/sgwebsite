// Couleurs des lignes et cartes du tableau de bord (vue d'ensemble) : une
// bande à gauche (couleur) sur un fond teinté (fond). L'état est toujours
// aussi écrit en texte à côté, pour ne pas dépendre de la couleur seule.
export const NIVEAUX = {
  danger: { couleur: "var(--danger)", fond: "var(--danger-fond)" },
  avertissement: { couleur: "var(--avertissement)", fond: "var(--avertissement-fond)" },
  info: { couleur: "var(--success)", fond: "var(--success-fond)" },
  bon: { couleur: "var(--success)", fond: "var(--success-fond)" },
  bleu: { couleur: "var(--bleu)", fond: "var(--bleu-fond)" },
  neutre: { couleur: "var(--border)", fond: "transparent" },
};

// Durée d'un poinçon encore ouvert : orange après 8 h, rouge après 10 h
// (probablement un oubli de dépoinçonner).
export function niveauHorodateur(debut, maintenant = new Date()) {
  const heures = (maintenant.getTime() - new Date(debut).getTime()) / 3600000;
  if (heures >= 10) return { niveau: "danger", etat: "Oubli ?" };
  if (heures >= 8) return { niveau: "avertissement", etat: "Long" };
  return { niveau: "neutre", etat: null };
}
