// Liens vers les fichiers joints par le client sur le site de réservation
// (modèle FichierRendezVous) — calendrier et bon créé à partir du rendez-vous.
export default function FichiersRendezVous({ fichiers, style }) {
  if (!fichiers?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, ...style }}>
      {fichiers.map((f) => (
        <a
          key={f.id}
          href={`/api/rendezvous/fichiers/${f.id}`}
          target="_blank"
          rel="noopener"
          style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px" }}
        >
          📎 {f.nom}
        </a>
      ))}
    </div>
  );
}
