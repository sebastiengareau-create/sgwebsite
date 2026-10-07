// Banderole « B/O » d'un bon : une pièce commandée chez le fournisseur n'est
// pas encore reçue (PieceUtilisee.bo). Elle disparaît à la réception de la
// commande ; le bon ne se facture pas avant.
export function piecesBo(bon) {
  return (bon.problemes || []).flatMap((pr) => (pr.pieces || []).filter((l) => l.bo));
}

export default function BanderoleBo({ bon, compact = false, style }) {
  const lignes = piecesBo(bon);
  if (lignes.length === 0) return null;
  const noms = lignes.map((l) => l.piece?.nom).filter(Boolean);
  return (
    <div
      title={noms.length ? `En commande : ${noms.join(", ")}` : undefined}
      style={{
        background: "repeating-linear-gradient(135deg, #D9822B22 0 8px, #D9822B33 8px 16px)",
        border: "1px solid #D9822B", color: "#D9822B", borderRadius: compact ? 6 : 8,
        padding: compact ? "2px 8px" : "6px 10px", fontSize: compact ? 10.5 : 12, fontWeight: 700,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...style,
      }}
    >
      {compact
        ? <>📦 B/O — {lignes.length > 1 ? `${lignes.length} pièces` : "pièce"} en attente</>
        : <>📦 B/O — {lignes.length > 1 ? `${lignes.length} pièces en commande` : "pièce en commande"}, en attente de réception</>}
      {!compact && noms.length > 0 && <span style={{ fontWeight: 400 }}> : {noms.join(", ")}</span>}
    </div>
  );
}
