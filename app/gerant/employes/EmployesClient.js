"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EmployesClient({ employes, moi, nomsRoles }) {
  const router = useRouter();
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);

  return (
    <div className="conteneur-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20 }}>Gestion des employés</h1>
        <button
          onClick={() => setAfficherFormulaire((v) => !v)}
          className="bouton-3d"
          style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}
        >
          {afficherFormulaire ? "Annuler" : "+ Nouveau compte"}
        </button>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        Touche un employé pour voir sa fiche complète — coordonnées, rémunération, historique de paie.
      </p>

      {afficherFormulaire && (
        <FormulaireCreation onCree={() => { setAfficherFormulaire(false); router.refresh(); }} nomsRoles={nomsRoles} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {employes.map((e) => (
          <Link key={e.id} href={`/gerant/employes/${e.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div
              className="bouton-3d-sombre"
              style={{ borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12, opacity: e.actif ? 1 : 0.5 }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(180deg, var(--accent-clair), var(--accent))",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#17150f",
              }}>
                {e.nom.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {e.nom} {e.id === moi && <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 400 }}>(toi)</span>}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.assignation || e.courriel}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent)" }}>{nomsRoles[e.role] || e.role}</span>
                {!e.actif && <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--danger)" }}>Désactivé</span>}
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: 16 }}>›</span>
            </div>
          </Link>
        ))}
        {employes.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun employé encore.</p>}
      </div>
    </div>
  );
}

function FormulaireCreation({ onCree, nomsRoles }) {
  const [nom, setNom] = useState("");
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [role, setRole] = useState("MECANICIEN");
  const [pin, setPin] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/utilisateurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, courriel, motDePasse, role, pin: pin || undefined }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création.");
      return;
    }
    onCree();
  }

  return (
    <form onSubmit={creer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 4 }}>
      <input required placeholder="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
      <input required type="email" placeholder="Courriel" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
      <input required type="password" placeholder="Mot de passe (min. 6 caractères)" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} style={champStyle} />
      <select value={role} onChange={(e) => setRole(e.target.value)} style={champStyle}>
        <option value="MECANICIEN">{nomsRoles.MECANICIEN}</option>
        <option value="SECRETAIRE">{nomsRoles.SECRETAIRE}</option>
        <option value="GERANT">{nomsRoles.GERANT}</option>
      </select>
      <input placeholder="Code PIN (optionnel, 4 chiffres)" value={pin} onChange={(e) => setPin(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", marginTop: 10, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
        {enCours ? "Création…" : "Créer le compte"}
      </button>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
