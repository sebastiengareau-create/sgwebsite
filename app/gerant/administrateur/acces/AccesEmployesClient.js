"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../../components/BandeauSection";
import { TEINTES, TitrePanneau, stylePanneau, Panneau, Pastille } from "../../../components/StyleSection";

const SECTIONS = [
  { cle: "operations", label: "🔧 Bons de commande / Factures" },
  { cle: "calendrier", label: "📅 Calendrier" },
  { cle: "clients", label: "🧑‍🤝‍🧑 Clients" },
  { cle: "fournisseurs", label: "🏢 Fournisseurs" },
  { cle: "inventaire", label: "📦 Inventaire" },
  { cle: "elevage", label: "🐂 Élevage — troupeau, découpe, vente de viande" },
  { cle: "copropriete", label: "🏢 Copropriété — unités, charges, entretien, documents" },
  { cle: "comptabilite", label: "💰 Comptabilité" },
  { cle: "paie", label: "🧾 Paie" },
  { cle: "employes", label: "👥 Employés" },
  { cle: "documents", label: "📄 Documents — lettres et courriels" },
  { cle: "vue-ensemble", label: "📊 Vue d'ensemble" },
  { cle: "jobs-temps-reel", label: "📈 Productivité par employés" },
  { cle: "jobs-deplacement", label: "🚐 Jobs en déplacement" },
  { cle: "horodateur", label: "⏱️ Horodateur" },
  { cle: "parametres", label: "⚙️ Paramètres" },
  { cle: "notifications", label: "🔔 Notifications — envoyer des messages" },
];
// NIVEAU4 (accès total, toujours) reste seul non configurable — GERANT est
// maintenant configurable comme les autres, mais part avec tout activé par
// défaut (voir DEFAUTS_INITIAUX_ROLE dans lib/auth.js).
const ROLE_ACCES_TOTAL = "NIVEAU4";
const ROLES_CONFIGURABLES = ["GERANT", "SECRETAIRE", "MECANICIEN"];

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

  // Une teinte par rôle, reprise sur les employés en bas de la page
  const ROLES = [ROLE_ACCES_TOTAL, ...ROLES_CONFIGURABLES];
  const PALETTE = [TEINTES.rouge, TEINTES.ambre, TEINTES.bleu, TEINTES.vert];
  const teinteRole = (role) => PALETTE[Math.max(0, ROLES.indexOf(role)) % PALETTE.length];
  const nbEmployes = (role) => employes.filter((e) => e.role === role).length;

  return (
    <div className="conteneur-page">
      <Link href="/gerant/administrateur" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Administrateur</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="🔑" titre="Rôles et accès" sousTitre="Renomme un rôle et choisis ce qu'il contrôle — s'applique à tous les employés qui ont ce rôle." />
      </div>

      {ROLES.map((role) => {
        const teinte = teinteRole(role);
        const sections = defautsRoles[role] || [];
        const n = nbEmployes(role);
        return (
          <div key={role} style={{ ...stylePanneau, position: "relative", overflow: "hidden", paddingLeft: 22 }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: teinte.couleur }} />
            {editionNomRole === role ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
                <input
                  value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") renommerRole(role); if (e.key === "Escape") setEditionNomRole(null); }}
                  style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 15, fontWeight: 700 }}
                />
                <button onClick={() => renommerRole(role)} disabled={enCoursRole === role} style={{ ...boutonPetit, background: "var(--accent)", borderColor: "var(--accent)", color: "#221f18" }}>Enregistrer</button>
                <button onClick={() => setEditionNomRole(null)} style={boutonPetit}>Annuler</button>
              </div>
            ) : (
              <TitrePanneau
                icone={role === ROLE_ACCES_TOTAL ? "cadenas" : "utilisateurs"} teinte={teinte} titre={nomsRoles[role]}
                sousTitre={role === ROLE_ACCES_TOTAL
                  ? `Accès complet à tout, toujours — non modifiable · ${n} employé${n > 1 ? "s" : ""}`
                  : `${sections.length} section${sections.length > 1 ? "s" : ""} sur ${SECTIONS.length} · ${n} employé${n > 1 ? "s" : ""}`}
                droite={
                  <button onClick={() => { setEditionNomRole(role); setNouveauNom(nomsRoles[role]); }} style={boutonPetit}>
                    ✏️ Renommer
                  </button>
                }
              />
            )}

            {role !== ROLE_ACCES_TOTAL && (
              // 4 colonnes sur ordinateur, 2 sur cellulaire : 16 sections = rangées complètes
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(max(140px, 22%), 1fr))", gap: 8 }}>
                {SECTIONS.map((s) => {
                  const actif = sections.includes(s.cle);
                  return (
                    <button
                      key={s.cle}
                      onClick={() => basculerDefautRole(role, s.cle)}
                      disabled={enCoursRole === role}
                      aria-pressed={actif}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                        padding: "10px 12px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer",
                        border: actif ? `1.5px solid ${teinte.couleur}` : "1px solid var(--border)",
                        background: actif ? teinte.fond : "var(--bg)",
                        color: actif ? "var(--text)" : "var(--text-muted)",
                      }}
                    >
                      <span style={{
                        flexShrink: 0, width: 20, height: 20, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: actif ? teinte.couleur : "transparent", border: actif ? "none" : "1.5px solid var(--border)", color: "#fff", fontSize: 13, fontWeight: 800,
                      }}>
                        {actif ? "✓" : ""}
                      </span>
                      <span style={{ minWidth: 0 }}>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <Panneau titre="Employés par rôle">
        {employes.map((e, i) => {
          const t = teinteRole(e.role);
          return (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: t.fond, color: t.couleur, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>
                {e.nom.charAt(0).toUpperCase()}
              </span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, minWidth: 0 }}>{e.nom}</span>
              <Pastille couleur={t.couleur} fond={t.fond}>{nomsRoles[e.role] || e.role}</Pastille>
            </div>
          );
        })}
        {employes.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun employé encore.</p>}
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "12px 0 0" }}>
          Pour changer le rôle d'un employé précis, va dans sa fiche via <Link href="/gerant/employes" style={{ color: "var(--accent-ombre)", fontWeight: 700 }}>Employés</Link>.
        </p>
      </Panneau>
    </div>
  );
}

const boutonPetit = {
  flexShrink: 0, fontSize: 13, fontWeight: 700, color: "var(--text)", background: "var(--bg)",
  border: "1px solid var(--border)", padding: "8px 12px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap",
};
