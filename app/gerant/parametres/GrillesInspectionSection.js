import Link from "next/link";
import { TitrePanneau, stylePanneau, TEINTES } from "../../components/StyleSection";

// Paramètres → Grilles d'inspection (module Inspection numérique) : résumé
// des grilles et lien vers leur éditeur
export default function GrillesInspectionSection({ grilles, personnalisees }) {
  return (
    <div className="conteneur-page-large" style={{ margin: "0 auto", padding: "0 16px" }}>
      <div style={stylePanneau}>
        <TitrePanneau
          icone="liste" teinte={TEINTES.bleu} titre="Grilles d'inspection"
          sousTitre={personnalisees ? "Grilles du garage" : "Grilles d'origine"}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {grilles.map((g) => (
            <div key={g.cle} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
              <span style={{ fontWeight: 700, color: g.active ? "var(--text)" : "var(--text-muted)" }}>{g.titre}</span>
              <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{g.nbPoints} points{g.active ? "" : " · retirée des bons"}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
          Les points que le technicien vérifie quand il commence une inspection sur un bon, et les seuils qui proposent l'état d'un point selon sa mesure (plaquettes, pneus, batterie). Un changement vaut pour les prochaines inspections.
        </p>
        <Link href="/gerant/parametres/grilles-inspection" className="bouton-3d" style={{ display: "inline-block", padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          Modifier les grilles
        </Link>
      </div>
    </div>
  );
}
