// Conditions générales en petits caractères au bas de la soumission, du bon
// de travail et de la facture imprimés — texte réglé dans Administrateur →
// Informations de l'entreprise (même chose dans le PDF, lib/pdfFacture.js).
export default function ConditionsGenerales({ texte }) {
  if (!texte?.trim()) return null;
  return (
    <div style={{ marginTop: 28, paddingTop: 8, borderTop: "1px solid #ddd", fontSize: 8, lineHeight: 1.35, color: "#666", whiteSpace: "pre-wrap", textAlign: "justify" }}>
      {texte.trim()}
    </div>
  );
}
