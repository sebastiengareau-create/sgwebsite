// Petits composants visuels communs — le style vit dans globals.css
// (.titre-section, .ligne-info), pour qu'un changement de look se fasse à
// un seul endroit.

export function TitreSection({ children }) {
  return <div className="titre-section">{children}</div>;
}

// Ligne « libellé ……… valeur » d'une fiche détail ; "—" si la valeur est vide
export function LigneInfo({ label, valeur }) {
  return (
    <div className="ligne-info">
      <span>{label}</span>
      <span>{valeur || "—"}</span>
    </div>
  );
}
