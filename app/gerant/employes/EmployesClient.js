"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import BoutonImporterFichier from "../../components/BoutonImporterFichier";
import SelectProvince from "../../components/SelectProvince";
import { ChampAdresse, ChampVille, ChampCodePostal, remplisseurAdresse } from "../../components/ChampsAdresse";
import { useOrdreFiches } from "../../components/NavigationFiches";
import { PROVINCE_DEFAUT } from "@/lib/adresse";
import { formaterTelephone } from "@/lib/telephone";
import { correspondRecherche } from "@/lib/recherche";
import { Icone, TEINTES, CarteChiffre, GrilleChiffres, BoutonPlein, BoutonAction, GroupeLiens, Panneau, Pastille, TitrePanneau, stylePanneau } from "../../components/StyleSection";

export default function EmployesClient({ employes, moi, nomsRoles, rolesAssignables, peutImporter }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [afficherFormulaire, setAfficherFormulaire] = useState(searchParams.get("nouveau") === "1");
  const [recherche, setRecherche] = useState("");
  const [voirInactifs, setVoirInactifs] = useState(false);

  const terme = recherche.trim().toLowerCase();
  const filtres = employes.filter((e) => correspondRecherche(terme, e.nom, nomsRoles[e.role], e.assignation, e.courriel, e.telephone, e.numeroEmploye));
  const actifs = filtres.filter((e) => e.actif);
  const inactifs = filtres.filter((e) => !e.actif);
  useOrdreFiches("employes", [...actifs, ...(voirInactifs ? inactifs : [])].map((e) => e.id));

  // Une teinte par rôle (dans l'ordre où ils apparaissent), pour les repérer
  const tousActifs = employes.filter((e) => e.actif);
  const rolesPresents = [...new Set(employes.map((e) => e.role))];
  const PALETTE = [TEINTES.ambre, TEINTES.bleu, TEINTES.vert, TEINTES.rouge, TEINTES.neutre];
  const teinteRole = (role) => PALETTE[rolesPresents.indexOf(role) % PALETTE.length];
  const parRole = rolesPresents
    .map((r) => [r, tousActifs.filter((e) => e.role === r).length])
    .filter(([, n]) => n > 0)
    .map(([r, n]) => `${nomsRoles[r] || r} → ${n}`)
    .join(" · ");
  const nbInactifs = employes.length - tousActifs.length;

  return (
    <div className="conteneur-page">
      <BandeauSection icone="👥" titre="Gestion des employés" sousTitre="Touche un employé pour voir sa fiche complète — coordonnées, rémunération, historique de paie." />

      {/* Formulaire ouvert : il a son propre bouton Annuler */}
      {afficherFormulaire ? (
        <div style={{ marginBottom: 20 }}>
          <FormulaireCreation onCree={() => { setAfficherFormulaire(false); router.refresh(); }} onAnnuler={() => setAfficherFormulaire(false)} nomsRoles={nomsRoles} rolesAssignables={rolesAssignables} />
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <BoutonPlein icone="utilisateurPlus" onClick={() => setAfficherFormulaire(true)}>Nouveau compte</BoutonPlein>
          {peutImporter && <BoutonImporterFichier apiUrl="/api/employes/importer" libelle="depuis Excel" libellePluriel="employé" />}
        </div>
      )}

      <GrilleChiffres>
        <CarteChiffre
          titre="Employés actifs" montant={String(tousActifs.length)} teinte="var(--bleu)"
          note={parRole || "Aucun compte actif"}
        />
        {nbInactifs > 0 && (
          <CarteChiffre
            titre="Comptes désactivés" montant={String(nbInactifs)} couleur="var(--text-muted)" teinte="var(--text-muted)"
            actif={voirInactifs}
            onClick={() => setVoirInactifs((v) => !v)}
            note={voirInactifs ? "Affichés dans la liste · touche pour les cacher" : "Touche pour les voir dans la liste"}
          />
        )}
      </GrilleChiffres>

      <GroupeLiens
        titre="Rapports" teinte={TEINTES.vert}
        liens={[
          { href: "/gerant/comptabilite/rapports/employes", target: "_blank", icone: "imprimante", label: "Liste des employés", detail: "PDF, Excel ou imprimer" },
        ]}
      />

      <Panneau titre="Équipe">
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
            <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
          </span>
          <input
            type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom, rôle, assignation, courriel, téléphone…"
            style={{ ...champStyle, marginBottom: 0, padding: "11px 12px 11px 40px", fontSize: 14, borderRadius: 12 }}
          />
        </div>

        {actifs.length > 0 && <EnteteListe titre={`${actifs.length} actif${actifs.length > 1 ? "s" : ""}`} droite="Rôle" />}
        {actifs.map((e, i) => <CarteEmploye key={e.id} employe={e} moi={moi} nomsRoles={nomsRoles} teinte={teinteRole(e.role)} premier={i === 0} />)}
        {employes.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucun employé encore.</p>}
        {employes.length > 0 && actifs.length === 0 && inactifs.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucun employé ne correspond à « {recherche} ».</p>
        )}

        {inactifs.length > 0 && (
          <>
            <button
              onClick={() => setVoirInactifs((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <span style={{ display: "inline-flex", transform: voirInactifs || terme ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                <Icone nom="chevron" taille={16} />
              </span>
              Comptes désactivés ({inactifs.length})
            </button>
            {(voirInactifs || terme) && (
              <>
                <EnteteListe titre="Désactivés" droite="Rôle" couleur="var(--border)" />
                {inactifs.map((e, i) => <CarteEmploye key={e.id} employe={e} moi={moi} nomsRoles={nomsRoles} teinte={teinteRole(e.role)} premier={i === 0} />)}
              </>
            )}
          </>
        )}
      </Panneau>
    </div>
  );
}

function EnteteListe({ titre, droite, couleur = "var(--accent)" }) {
  return (
    <div style={{ display: "flex", padding: "0 6px 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", borderBottom: `2px solid ${couleur}` }}>
      <span style={{ flex: 1 }}>{titre}</span>
      <span>{droite}</span>
    </div>
  );
}

function CarteEmploye({ employe: e, moi, nomsRoles, teinte, premier }) {
  return (
    <Link href={`/gerant/employes/${e.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 6px", borderTop: premier ? "none" : "1px solid var(--border)", opacity: e.actif ? 1 : 0.55 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: teinte.fond,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: teinte.couleur,
        }}>
          {e.nom.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {e.nom} {e.id === moi && <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>(toi)</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {e.numeroEmploye && <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>#{e.numeroEmploye}{" · "}</span>}
            {[e.assignation, e.telephone].filter(Boolean).join(" · ") || e.courriel}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <Pastille couleur={teinte.couleur} fond={teinte.fond}>{nomsRoles[e.role] || e.role}</Pastille>
          {!e.actif && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--danger)" }}>Désactivé</span>}
        </div>
        <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
      </div>
    </Link>
  );
}

function FormulaireCreation({ onCree, onAnnuler, nomsRoles, rolesAssignables }) {
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
  const remplir = remplisseurAdresse({ ville, setAdresse, setVille, setProvince, setCodePostal });
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
    <form onSubmit={creer}>
      <div style={{ ...stylePanneau, border: "1.5px solid var(--accent)" }}>
        <TitrePanneau icone="cadenas" teinte={TEINTES.ambre} titre="Nouveau compte" sousTitre="Ce qu'il faut pour se connecter à l'appli." />
        <label style={labelStyle}>Nom complet *</label>
        <input required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Marc Lévesque" style={champStyle} />
        <div className="grille-deux" style={{ gap: "0 12px" }}>
          <div>
            <label style={labelStyle}>Courriel *</label>
            <input required type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
          </div>
          <div>
            <label style={labelStyle}>Mot de passe * (4 à 12 caractères)</label>
            <input required type="password" minLength={4} maxLength={12} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} style={champStyle} />
          </div>
          <div>
            <label style={labelStyle}>Rôle</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={champStyle}>
              {rolesAssignables.map((r) => (
                <option key={r} value={r}>{nomsRoles[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>NIP (4 chiffres, optionnel)</label>
            <input inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" style={{ ...champStyle, letterSpacing: "0.2em" }} />
          </div>
        </div>
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="personne" teinte={TEINTES.bleu} titre="Coordonnées" sousTitre="Optionnelles — utiles pour la paie et les relevés." />
        <div className="grille-deux" style={{ gap: "0 12px" }}>
          <div>
            <label style={labelStyle}>Téléphone</label>
            <input value={telephone} type="tel" onChange={(e) => setTelephone(e.target.value)} onBlur={(e) => setTelephone(formaterTelephone(e.target.value))} style={champStyle} />
          </div>
          <div>
            <label style={labelStyle}>Assignation</label>
            <input value={assignation} onChange={(e) => setAssignation(e.target.value)} placeholder="Poste, spécialité, secteur…" style={champStyle} />
          </div>
        </div>
        <label style={labelStyle}>Adresse</label>
        <ChampAdresse valeur={adresse} onChange={setAdresse} onChoisir={remplir.onChoisir} style={champStyle} />
        <label style={labelStyle}>Ville</label>
        <ChampVille valeur={ville} onChange={setVille} codePostal={codePostal} style={champStyle} />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Province</label>
            <SelectProvince valeur={province} onChange={setProvince} style={champStyle} />
          </div>
          <div style={{ width: 120 }}>
            <label style={labelStyle}>Code postal</label>
            <ChampCodePostal valeur={codePostal} onChange={setCodePostal} onSecteur={remplir.onSecteur} style={champStyle} />
          </div>
        </div>
        <label style={labelStyle}>Date d'embauche</label>
        <input type="date" max="9999-12-31" value={dateEmbauche} onChange={(e) => setDateEmbauche(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="banque" teinte={TEINTES.vert} titre="Paie" sousTitre="Modifiable ensuite dans la fiche de l'employé." />
        <label style={labelStyle}>Type de rémunération</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg)", marginBottom: 8 }}>
          {[["HORAIRE", "Payé à l'heure"], ["SALAIRE", "Salarié"]].map(([code, libelle]) => {
            const actif = typeRemuneration === code;
            return (
              <button key={code} type="button" onClick={() => setTypeRemuneration(code)} style={{ padding: "9px 6px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, background: actif ? "var(--accent)" : "transparent", color: actif ? "#221f18" : "var(--text-muted)" }}>
                {libelle}
              </button>
            );
          })}
        </div>
        <div className="grille-deux" style={{ gap: "0 12px" }}>
          {typeRemuneration === "HORAIRE" ? (
            <div>
              <label style={labelStyle}>Taux horaire ($/h) — vide = taux global</label>
              <input type="number" min={0} step="0.01" value={tauxHoraireEmploye} onChange={(e) => setTauxHoraireEmploye(e.target.value)} className="champ-sans-fleches" style={champStyle} />
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Salaire annuel ($)</label>
              <input type="number" min={0} step="0.01" value={salaireAnnuel} onChange={(e) => setSalaireAnnuel(e.target.value)} className="champ-sans-fleches" style={champStyle} />
            </div>
          )}
          <div>
            <label style={labelStyle}>Fréquence de paie</label>
            <select value={frequencePaie} onChange={(e) => setFrequencePaie(e.target.value)} style={champStyle}>
              <option value="HEBDOMADAIRE">Chaque semaine</option>
              <option value="BIHEBDOMADAIRE">Aux 2 semaines</option>
              <option value="BIMENSUEL">2 fois par mois</option>
              <option value="MENSUEL">Chaque mois</option>
            </select>
          </div>
        </div>
        <label style={labelStyle}>Taux de vacances (%)</label>
        <input type="number" min={0} step="0.1" value={tauxVacances} onChange={(e) => setTauxVacances(e.target.value)} className="champ-sans-fleches" style={{ ...champStyle, marginBottom: 6 }} />
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Minimum légal au Québec : 4 %, ou 6 % après 3 ans de service.</p>
      </div>

      {erreur && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--danger-fond)", border: "1px solid var(--danger)", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
          <Icone nom="alerte" taille={16} couleur="var(--danger)" /> {erreur}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: onAnnuler ? "1fr 1fr" : "1fr", gap: 8 }}>
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14 }}>
          {enCours ? "Création…" : "Créer le compte"}
        </button>
        {onAnnuler && <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={onAnnuler}>Annuler</BoutonAction>}
      </div>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4, marginTop: 10 };
