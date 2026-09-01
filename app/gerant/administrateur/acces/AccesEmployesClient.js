"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SECTIONS = [
  { cle: "operations", label: "🔧 Bons de commande / Factures" },
  { cle: "calendrier", label: "📅 Calendrier" },
  { cle: "clients", label: "🧑‍🤝‍🧑 Clients" },
  { cle: "fournisseurs", label: "🏢 Fournisseurs" },
  { cle: "inventaire", label: "📦 Inventaire" },
  { cle: "comptabilite", label: "💰 Comptabilité" },
  { cle: "paie", label: "🧾 Paie" },
];
const ROLES_CONFIGURABLES = ["SECRETAIRE", "MECANICIEN"];

export default function AccesEmployesClient({ employes, defautsRolesInit, nomsRolesInit }) {
  const router = useRouter();
  const [defautsRoles, setDefautsRoles] = useState(defautsRolesInit);
  const [nomsRoles, setNomsRoles] = useState(nomsRolesInit);
  const [enCoursRole, setEnCoursRole] = useState(null);
  const [editionNomRole, setEditionNomRole] = useState(null); // rôle en train d'être renommé
  const [nouveauNom, setNouveauNom] = useState("");

  async function basculerDefautRole(role, cle) {
    const actuelles = defautsRoles[role] || [];
    const nouvelles = actuelles.includes(cle) ? actuelles.filter((s) => s !== cle) : [...actuelles, cle];

    setEnCoursRole(role);
    const res = await fetch("/api/administrateur/role-defaut", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, sections: nouvelles }),
    });
    setEnCoursRole(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur.");
      return;
    }
    setDefautsRoles((prev) => ({ ...prev, [role]: nouvelles }));
    router.refresh();
  }

  async function renommerRole(role) {
    if (!nouveauNom.trim()) return;
    setEnCoursRole(role);
    const res = await fetch("/api/administrateur/nom-role", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, nom: nouveauNom }),
    });
    setEnCoursRole(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur.");
      return;
    }
    setNomsRoles((prev) => ({ ...prev, [role]: nouveauNom.trim() }));
    setEditionNomRole(null);
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/administrateur" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Administrateur</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>🔑 Rôles et accès</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
        Renomme un rôle (ex : "Mécanicien" → "Plombier" pour une autre sorte d'entreprise), et choisis ce qu'il
        contrôle — s'applique à tous les employés qui ont ce rôle.
      </p>

      {["GERANT", ...ROLES_CONFIGURABLES].map((role) => (
        <div key={role} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: role === "GERANT" ? 0 : 12 }}>
            {editionNomRole === role ? (
              <div style={{ display: "flex", gap: 6, flex: 1 }}>
                <input
                  value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} autoFocus
                  style={{ flex: 1, padding: "6px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
                />
                <button onClick={() => renommerRole(role)} disabled={enCoursRole === role} style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>✓</button>
                <button onClick={() => setEditionNomRole(null)} style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
              </div>
            ) : (
              <>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{nomsRoles[role]}</span>
                <button
                  onClick={() => { setEditionNomRole(role); setNouveauNom(nomsRoles[role]); }}
                  style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}
                >
                  ✏️ Renommer
                </button>
              </>
            )}
          </div>

          {role === "GERANT" ? (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>Accès complet à tout, toujours — non modifiable.</p>
          ) : (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {SECTIONS.map((s) => {
                const actif = (defautsRoles[role] || []).includes(s.cle);
                return (
                  <button
                    key={s.cle}
                    onClick={() => basculerDefautRole(role, s.cle)}
                    disabled={enCoursRole === role}
                    style={{
                      padding: "7px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      border: actif ? "1px solid var(--accent)" : "1px solid var(--border)",
                      background: actif ? "rgba(232,163,61,0.15)" : "var(--bg)",
                      color: actif ? "var(--accent)" : "var(--text-muted)",
                    }}
                  >
                    {actif ? "✓ " : ""}{s.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 20, marginBottom: 8 }}>Employés par rôle</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {employes.map((e) => (
          <div key={e.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13 }}>{e.nom}</span>
            <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>{nomsRoles[e.role] || e.role}</span>
          </div>
        ))}
        {employes.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Aucun employé encore.</p>}
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
        Pour changer le rôle d'un employé précis, va dans sa fiche via <Link href="/gerant/employes" style={{ color: "var(--accent)" }}>Employés</Link>.
      </p>
    </div>
  );
}
