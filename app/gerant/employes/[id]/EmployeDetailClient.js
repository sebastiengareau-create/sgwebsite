"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EmployeDetailClient({ employe, paies, estMoi, paieActif, soldeVacances, nomsRoles }) {
  const router = useRouter();
  const [modeEdition, setModeEdition] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const [nom, setNom] = useState(employe.nom);
  const [courriel, setCourriel] = useState(employe.courriel || "");
  const [role, setRole] = useState(employe.role);
  const [telephone, setTelephone] = useState(employe.telephone || "");
  const [adresse, setAdresse] = useState(employe.adresse || "");
  const [assignation, setAssignation] = useState(employe.assignation || "");
  const [numeroEmploye, setNumeroEmploye] = useState(employe.numeroEmploye || "");
  const [dateEmbauche, setDateEmbauche] = useState(employe.dateEmbauche ? new Date(employe.dateEmbauche).toISOString().slice(0, 10) : "");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [typeRemuneration, setTypeRemuneration] = useState(employe.typeRemuneration || "HORAIRE");
  const [tauxHoraireEmploye, setTauxHoraireEmploye] = useState(employe.tauxHoraireEmploye ?? "");
  const [salaireAnnuel, setSalaireAnnuel] = useState(employe.salaireAnnuel ?? "");
  const [frequencePaie, setFrequencePaie] = useState(employe.frequencePaie || "BIHEBDOMADAIRE");
  const [tauxVacances, setTauxVacances] = useState(employe.tauxVacances ?? 4);

  async function sauvegarder() {
    setErreur("");
    setEnCours(true);
    const body = { nom, courriel, role, telephone, adresse, assignation, numeroEmploye, dateEmbauche, typeRemuneration, tauxHoraireEmploye, salaireAnnuel, frequencePaie, tauxVacances };
    if (nouveauMotDePasse) body.motDePasse = nouveauMotDePasse;
    const res = await fetch(`/api/utilisateurs/${employe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setModeEdition(false);
    setNouveauMotDePasse("");
    router.refresh();
  }

  async function toggleActif() {
    setEnCours(true);
    await fetch(`/api/utilisateurs/${employe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !employe.actif }),
    });
    setEnCours(false);
    router.refresh();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer définitivement le compte de ${employe.nom} ? Irréversible.`)) return;
    setEnCours(true);
    const res = await fetch(`/api/utilisateurs/${employe.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    router.push("/gerant/employes");
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/employes" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux employés</Link>

      {/* Carte profil */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginTop: 10, marginBottom: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(180deg, var(--accent-clair), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#17150f", flexShrink: 0 }}>
            {employe.nom.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{employe.nom} {estMoi && <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>(toi)</span>}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{employe.courriel}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <span className="bouton-3d" style={{ display: "inline-block", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{nomsRoles[employe.role] || employe.role}</span>
          {!employe.actif && (
            <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "var(--danger)", color: "white" }}>Désactivé</span>
          )}
        </div>
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {modeEdition ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <SectionTitre>Profil</SectionTitre>
          <label style={labelStyle}>Nom</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
          <label style={labelStyle}>Courriel</label>
          <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
          <label style={labelStyle}>Rôle</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={champStyle}>
            <option value="MECANICIEN">{nomsRoles.MECANICIEN}</option>
            <option value="SECRETAIRE">{nomsRoles.SECRETAIRE}</option>
            <option value="GERANT">{nomsRoles.GERANT}</option>
          </select>
          <label style={labelStyle}>Téléphone</label>
          <input value={telephone} onChange={(e) => setTelephone(e.target.value)} style={champStyle} />
          <label style={labelStyle}>Adresse</label>
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} style={champStyle} />
          <label style={labelStyle}>Assignation (poste, spécialité, secteur…)</label>
          <input value={assignation} onChange={(e) => setAssignation(e.target.value)} placeholder="Ex : Freins et suspension" style={champStyle} />
          <label style={labelStyle}>Numéro d'employé</label>
          <input value={numeroEmploye} onChange={(e) => setNumeroEmploye(e.target.value)} style={champStyle} />
          <label style={labelStyle}>Date d'embauche</label>
          <input type="date" value={dateEmbauche} onChange={(e) => setDateEmbauche(e.target.value)} style={champStyle} />
          <label style={labelStyle}>Nouveau mot de passe (laisse vide pour ne pas changer)</label>
          <input type="password" value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)} style={champStyle} />

          <SectionTitre>Configuration de paie</SectionTitre>
          <label style={labelStyle}>Type de rémunération</label>
          <select value={typeRemuneration} onChange={(e) => setTypeRemuneration(e.target.value)} style={champStyle}>
            <option value="HORAIRE">Payé à l'heure</option>
            <option value="SALAIRE">Salarié (montant fixe)</option>
          </select>
          {typeRemuneration === "HORAIRE" ? (
            <>
              <label style={labelStyle}>Taux horaire spécifique (vide = taux global des Paramètres)</label>
              <input type="number" min={0} step="0.01" value={tauxHoraireEmploye} onChange={(e) => setTauxHoraireEmploye(e.target.value)} style={champStyle} />
            </>
          ) : (
            <>
              <label style={labelStyle}>Salaire annuel</label>
              <input type="number" min={0} step="0.01" value={salaireAnnuel} onChange={(e) => setSalaireAnnuel(e.target.value)} style={champStyle} />
            </>
          )}
          <label style={labelStyle}>Fréquence de paie</label>
          <select value={frequencePaie} onChange={(e) => setFrequencePaie(e.target.value)} style={champStyle}>
            <option value="HEBDOMADAIRE">Chaque semaine</option>
            <option value="BIHEBDOMADAIRE">Aux 2 semaines</option>
            <option value="BIMENSUEL">2 fois par mois</option>
            <option value="MENSUEL">Chaque mois</option>
          </select>
          <label style={labelStyle}>Taux de vacances (%) — minimum légal QC : 4% (ou 6% après 3 ans)</label>
          <input type="number" min={0} step="0.1" value={tauxVacances} onChange={(e) => setTauxVacances(e.target.value)} style={{ ...champStyle, marginBottom: 12 }} />

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={sauvegarder} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              {enCours ? "…" : "Sauvegarder"}
            </button>
            <button onClick={() => setModeEdition(false)} className="bouton-3d-sombre" style={{ flex: 1, padding: 11, borderRadius: 10, fontSize: 13 }}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <SectionTitre>Coordonnées</SectionTitre>
            <Champ label="Téléphone" valeur={employe.telephone} />
            <Champ label="Adresse" valeur={employe.adresse} />
            <Champ label="Assignation" valeur={employe.assignation} />
            <Champ label="Numéro d'employé" valeur={employe.numeroEmploye} />
            <Champ label="Date d'embauche" valeur={employe.dateEmbauche ? new Date(employe.dateEmbauche).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" }) : null} />
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <SectionTitre>Rémunération</SectionTitre>
            <Champ label="Type" valeur={employe.typeRemuneration === "SALAIRE" ? "Salarié (montant fixe)" : "Payé à l'heure"} />
            {employe.typeRemuneration === "SALAIRE" ? (
              <Champ label="Salaire annuel" valeur={employe.salaireAnnuel ? `${employe.salaireAnnuel.toFixed(2)} $` : null} />
            ) : (
              <Champ label="Taux horaire" valeur={employe.tauxHoraireEmploye ? `${employe.tauxHoraireEmploye.toFixed(2)} $/h (spécifique)` : "Taux global des Paramètres"} />
            )}
            <Champ label="Fréquence de paie" valeur={{ HEBDOMADAIRE: "Chaque semaine", BIHEBDOMADAIRE: "Aux 2 semaines", BIMENSUEL: "2 fois par mois", MENSUEL: "Chaque mois" }[employe.frequencePaie]} />
            <Champ label="Taux de vacances" valeur={`${employe.tauxVacances}%`} />
          </div>

          {paieActif && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <SectionTitre>Vacances</SectionTitre>
              <Champ label="Solde accumulé à ce jour" valeur={`${soldeVacances.toFixed(2)} $`} />
            </div>
          )}

          {paieActif && paies.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <SectionTitre>Paies récentes</SectionTitre>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {paies.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: p.statut === "CORRIGEE" ? 0.5 : 1 }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {new Date(p.periodeFin).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
                      {p.statut === "CORRIGEE" && " — corrigée"}
                    </span>
                    <span style={{ fontWeight: 600, textDecoration: p.statut === "CORRIGEE" ? "line-through" : "none" }}>{p.salaireNet.toFixed(2)} $</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setModeEdition(true)} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              ✏️ Modifier
            </button>
            {!estMoi && (
              <button onClick={toggleActif} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13, color: employe.actif ? "var(--danger)" : "var(--success)" }}>
                {employe.actif ? "Désactiver" : "Réactiver"}
              </button>
            )}
            {!estMoi && (
              <button onClick={supprimer} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13 }}>
                🗑️
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SectionTitre({ children }) {
  return <div style={{ fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.04em", marginBottom: 10 }}>{children}</div>;
}

function Champ({ label, valeur }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, gap: 12 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{valeur || "—"}</span>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, marginTop: 8 };
const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box",
};
