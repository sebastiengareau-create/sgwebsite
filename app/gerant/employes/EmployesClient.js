"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import BoutonImporterFichier from "../../components/BoutonImporterFichier";
import SelectProvince from "../../components/SelectProvince";
import { PROVINCE_DEFAUT } from "@/lib/adresse";

export default function EmployesClient({ employes, moi, nomsRoles, rolesAssignables, peutImporter }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [afficherFormulaire, setAfficherFormulaire] = useState(searchParams.get("nouveau") === "1");
  const [recherche, setRecherche] = useState("");
  const [voirInactifs, setVoirInactifs] = useState(false);

  const terme = recherche.trim().toLowerCase();
  const filtres = employes.filter((e) => !terme || [e.nom, nomsRoles[e.role], e.assignation, e.courriel, e.telephone, e.numeroEmploye]
    .some((champ) => champ && champ.toLowerCase().includes(terme)));
  const actifs = filtres.filter((e) => e.actif);
  const inactifs = filtres.filter((e) => !e.actif);

  return (
    <div className="conteneur-page">
      <BandeauSection icone="👥" titre="Gestion des employés" sousTitre="Touche un employé pour voir sa fiche complète — coordonnées, rémunération, historique de paie." />

      <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {peutImporter && <BoutonImporterFichier apiUrl="/api/employes/importer" libelle="depuis Excel" libellePluriel="employé" />}
        <button
          onClick={() => setAfficherFormulaire((v) => !v)}
          className="bouton-3d"
          style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}
        >
          {afficherFormulaire ? "Annuler" : "+ Nouveau compte"}
        </button>
      </div>

      <Link
        href="/gerant/comptabilite/rapports/employes"
        target="_blank"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 16 }}
      >
        📄 Liste des employés (PDF / Excel / imprimer)
      </Link>

      {afficherFormulaire && (
        <FormulaireCreation onCree={() => { setAfficherFormulaire(false); router.refresh(); }} nomsRoles={nomsRoles} rolesAssignables={rolesAssignables} />
      )}

      <input
        type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Rechercher par nom, rôle, assignation, courriel, téléphone…"
        style={{ ...champStyle, background: "var(--surface)", marginTop: 16 }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        {actifs.map((e) => <CarteEmploye key={e.id} employe={e} moi={moi} nomsRoles={nomsRoles} />)}
        {employes.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun employé encore.</p>}
        {employes.length > 0 && actifs.length === 0 && inactifs.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun employé ne correspond à "{recherche}".</p>
        )}
      </div>

      {inactifs.length > 0 && (
        <>
          <button
            onClick={() => setVoirInactifs((v) => !v)}
            style={{ marginTop: 20, marginBottom: 8, fontSize: 12, fontWeight: 700, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {voirInactifs || terme ? "▾" : "▸"} Comptes désactivés ({inactifs.length})
          </button>
          {(voirInactifs || terme) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {inactifs.map((e) => <CarteEmploye key={e.id} employe={e} moi={moi} nomsRoles={nomsRoles} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CarteEmploye({ employe: e, moi, nomsRoles }) {
  return (
    <Link href={`/gerant/employes/${e.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        className="bouton-3d-sombre"
        style={{ borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12, opacity: e.actif ? 1 : 0.55 }}
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
            {e.numeroEmploye && <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>#{e.numeroEmploye}</span>}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[e.assignation, e.telephone].filter(Boolean).join(" · ") || e.courriel}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent)" }}>{nomsRoles[e.role] || e.role}</span>
          {!e.actif && <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--danger)" }}>Désactivé</span>}
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: 16 }}>›</span>
      </div>
    </Link>
  );
}

function FormulaireCreation({ onCree, nomsRoles, rolesAssignables }) {
  const [nom, setNom] = useState("");
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [role, setRole] = useState("MECANICIEN");
  const [pin, setPin] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ville, setVille] = useState("");
  const [province, setProvince] = useState(PROVINCE_DEFAUT);
  const [codePostal, setCodePostal] = useState("");
  const [assignation, setAssignation] = useState("");
  const [dateEmbauche, setDateEmbauche] = useState("");
  const [typeRemuneration, setTypeRemuneration] = useState("HORAIRE");
  const [tauxHoraireEmploye, setTauxHoraireEmploye] = useState("");
  const [salaireAnnuel, setSalaireAnnuel] = useState("");
  const [frequencePaie, setFrequencePaie] = useState("BIHEBDOMADAIRE");
  const [tauxVacances, setTauxVacances] = useState(4);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/utilisateurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom, courriel, motDePasse, role, pin: pin || undefined,
        telephone, adresse, ville, province, codePostal, assignation, dateEmbauche,
        typeRemuneration, tauxHoraireEmploye, salaireAnnuel, frequencePaie, tauxVacances,
      }),
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
    <form onSubmit={creer} className="carte" style={{ marginBottom: 4 }}>
      <SectionTitreForm>Profil</SectionTitreForm>
      <input required placeholder="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
      <input required type="email" placeholder="Courriel" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
      <input required type="password" minLength={4} maxLength={12} placeholder="Mot de passe (4 à 12 caractères)" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} style={champStyle} />
      <select value={role} onChange={(e) => setRole(e.target.value)} style={champStyle}>
        {rolesAssignables.map((r) => (
          <option key={r} value={r}>{nomsRoles[r]}</option>
        ))}
      </select>
      <input placeholder="NIP (optionnel, 4 chiffres)" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} style={champStyle} />
      <input placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} style={champStyle} />
      <input placeholder="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} style={champStyle} />
      <input placeholder="Ville" value={ville} onChange={(e) => setVille(e.target.value)} style={champStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <SelectProvince valeur={province} onChange={setProvince} style={{ ...champStyle, flex: 1 }} />
        <input placeholder="Code postal" value={codePostal} onChange={(e) => setCodePostal(e.target.value.toUpperCase())} maxLength={7} style={{ ...champStyle, width: 110 }} />
      </div>
      <input placeholder="Assignation (poste, spécialité, secteur…)" value={assignation} onChange={(e) => setAssignation(e.target.value)} style={champStyle} />
      <label style={labelStyle}>Date d'embauche</label>
      <input type="date" value={dateEmbauche} onChange={(e) => setDateEmbauche(e.target.value)} style={champStyle} />

      <SectionTitreForm>Configuration de paie</SectionTitreForm>
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
      <input type="number" min={0} step="0.1" value={tauxVacances} onChange={(e) => setTauxVacances(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", marginTop: 10, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
        {enCours ? "Création…" : "Créer le compte"}
      </button>
    </form>
  );
}

function SectionTitreForm({ children }) {
  return <div style={{ fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.04em", marginTop: 12, marginBottom: 8 }}>{children}</div>;
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 };
