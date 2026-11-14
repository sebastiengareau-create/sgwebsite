"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, BoutonAction, LigneDetail, stylePanneau } from "../../../components/StyleSection";
import SelectProvince from "../../../components/SelectProvince";
import { ChampAdresse, ChampVille, ChampCodePostal, remplisseurAdresse } from "../../../components/ChampsAdresse";
import { ligneVille } from "@/lib/adresse";
import { formaterTelephone } from "@/lib/telephone";
import { formaterNas, masquerNas } from "@/lib/nas";
import { argent } from "@/lib/format";

export default function EmployeDetailClient({ employe, paies, estMoi, paieActif, soldeVacances, heures, nomsRoles, peutModifierTheme, rolesAssignables, peutGererEmploye, peutRedigerLettre, peutVoirNas, activite }) {
  const router = useRouter();
  const [modeEdition, setModeEdition] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const [nom, setNom] = useState(employe.nom);
  const [courriel, setCourriel] = useState(employe.courriel || "");
  const [role, setRole] = useState(employe.role);
  const [telephone, setTelephone] = useState(employe.telephone || "");
  const [adresse, setAdresse] = useState(employe.adresse || "");
  const [ville, setVille] = useState(employe.ville || "");
  const [province, setProvince] = useState(employe.province || "");
  const [codePostal, setCodePostal] = useState(employe.codePostal || "");
  const remplir = remplisseurAdresse({ ville, setAdresse, setVille, setProvince, setCodePostal });
  const [assignation, setAssignation] = useState(employe.assignation || "");
  const [nas, setNas] = useState(formaterNas(employe.nas || ""));
  const [dateEmbauche, setDateEmbauche] = useState(employe.dateEmbauche ? new Date(employe.dateEmbauche).toISOString().slice(0, 10) : "");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [nouveauPin, setNouveauPin] = useState("");
  const [retirerPin, setRetirerPin] = useState(false);
  const [typeRemuneration, setTypeRemuneration] = useState(employe.typeRemuneration || "HORAIRE");
  const [tauxHoraireEmploye, setTauxHoraireEmploye] = useState(employe.tauxHoraireEmploye ?? "");
  const [salaireAnnuel, setSalaireAnnuel] = useState(employe.salaireAnnuel ?? "");
  const [frequencePaie, setFrequencePaie] = useState(employe.frequencePaie || "BIHEBDOMADAIRE");
  const [tauxVacances, setTauxVacances] = useState(employe.tauxVacances ?? 4);
  const [montantTd1, setMontantTd1] = useState(employe.montantTd1 ?? "");
  const [dateNaissance, setDateNaissance] = useState(employe.dateNaissance ? new Date(employe.dateNaissance).toISOString().slice(0, 10) : "");
  const [exemptionAE, setExemptionAE] = useState(!!employe.exemptionAE);
  const [exemptionRRQ, setExemptionRRQ] = useState(!!employe.exemptionRRQ);
  const [exemptionCNESST, setExemptionCNESST] = useState(!!employe.exemptionCNESST);
  const [montantTp10153, setMontantTp10153] = useState(employe.montantTp10153 ?? "");
  const [theme, setTheme] = useState(employe.theme || "clair");
  const [tailleTexte, setTailleTexte] = useState(employe.tailleTexte || "normal");

  async function sauvegarder() {
    setErreur("");
    setEnCours(true);
    const body = { nom, courriel, role, telephone, adresse, ville, province, codePostal, assignation, dateEmbauche, typeRemuneration, tauxHoraireEmploye, salaireAnnuel, frequencePaie, tauxVacances, montantTd1, montantTp10153, dateNaissance, exemptionAE, exemptionRRQ, exemptionCNESST };
    if (peutModifierTheme) { body.theme = theme; body.tailleTexte = tailleTexte; }
    if (peutVoirNas) body.nas = nas;
    if (nouveauMotDePasse) body.motDePasse = nouveauMotDePasse;
    if (retirerPin) body.pin = "";
    else if (nouveauPin) body.pin = nouveauPin;
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
    setNouveauPin("");
    setRetirerPin(false);
    router.refresh();
  }

  async function toggleActif() {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/utilisateurs/${employe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !employe.actif }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur — le statut n'a pas été changé.");
      return;
    }
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

  const contacts = [
    employe.telephone && { href: `tel:${employe.telephone.replace(/[^\d+]/g, "")}`, icone: "telephone", label: "Appeler" },
    employe.courriel && { href: `mailto:${employe.courriel}`, icone: "courriel", label: "Écrire" },
    peutRedigerLettre && { href: `/gerant/documents?destinataire=EMPLOYE&pour=${employe.id}`, icone: "document", label: "Lettre" },
  ].filter(Boolean);
  const couleurProfil = employe.actif ? "var(--accent)" : "var(--text-muted)";
  const remuneration = employe.typeRemuneration === "SALAIRE"
    ? { titre: "Salaire annuel", montant: employe.salaireAnnuel ? argent(employe.salaireAnnuel) : "—", note: "Salarié (montant fixe)" }
    : { titre: "Taux horaire", montant: employe.tauxHoraireEmploye ? `${argent(employe.tauxHoraireEmploye)}/h` : "Global", note: employe.tauxHoraireEmploye ? "Taux propre à cet employé" : "Taux global des Paramètres" };
  const cartes = [
    { titre: "Cette semaine", montant: formaterHeures(heures.semaine), teinte: "var(--bleu)", note: "Depuis lundi" },
    paieActif && heures.depuisDernierePaie !== null
      ? { titre: "Depuis la dernière paie", montant: formaterHeures(heures.depuisDernierePaie), teinte: "var(--accent)", note: `Paie terminée le ${dateCourte(heures.dernierePaieFin)}` }
      : { ...remuneration, teinte: "var(--accent)" },
    paieActif
      ? { titre: "Vacances accumulées", montant: argent(soldeVacances), teinte: "var(--success)", couleur: "var(--success)", note: `Taux de ${employe.tauxVacances} %` }
      : { titre: "Ancienneté", montant: anciennete(employe.dateEmbauche), teinte: "var(--success)", note: employe.dateEmbauche ? `Embauche le ${dateCourte(employe.dateEmbauche)}` : "Date d'embauche non saisie" },
  ];

  return (
    <div className="conteneur-page">
      <Link href="/gerant/employes" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux employés</Link>

      {/* Carte profil */}
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px 20px 20px 24px", marginTop: 10, marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: couleurProfil }} />
        <span style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: "50%", background: couleurProfil, opacity: 0.08 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: TEINTES.ambre.fond, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: TEINTES.ambre.couleur, flexShrink: 0 }}>
            {employe.nom.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em" }}>
              {employe.nom} {estMoi && <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>(toi)</span>}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {employe.numeroEmploye && <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", marginRight: 6 }}>#{employe.numeroEmploye}</span>}
              {employe.assignation || (employe.dateEmbauche ? `Embauché le ${dateCourte(employe.dateEmbauche)}` : "")}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>{nomsRoles[employe.role] || employe.role}</Pastille>
              {!employe.actif && <Pastille couleur="var(--danger)" fond="var(--danger-fond)">Désactivé</Pastille>}
              {heures.poinconActif && <Pastille couleur="var(--success)" fond="var(--success-fond)">Poinçonné en ce moment</Pastille>}
            </div>
          </div>
        </div>
        {contacts.length > 0 && (
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${contacts.length}, 1fr)`, gap: 8, marginTop: 16 }}>
            {contacts.map((c) => <BoutonAction key={c.label} href={c.href} icone={c.icone}>{c.label}</BoutonAction>)}
          </div>
        )}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {modeEdition ? (
        <>
          <div style={stylePanneau}>
            <TitrePanneau icone="personne" teinte={TEINTES.bleu} titre="Profil" />
            <label className="etiquette">Nom</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className="champ" />
            <label className="etiquette">Courriel</label>
            <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} className="champ" />
            <label className="etiquette">Rôle</label>
            {peutGererEmploye ? (
              <select value={role} onChange={(e) => setRole(e.target.value)} className="champ">
                {rolesAssignables.map((r) => (
                  <option key={r} value={r}>{nomsRoles[r]}</option>
                ))}
              </select>
            ) : (
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 0, marginBottom: 8 }}>
                {nomsRoles[employe.role] || employe.role} — niveau de sécurité plus élevé que le tien, non modifiable.
              </p>
            )}
            <label className="etiquette">Téléphone</label>
            <input value={telephone} type="tel" onChange={(e) => setTelephone(e.target.value)} onBlur={(e) => setTelephone(formaterTelephone(e.target.value))} className="champ" />
            <label className="etiquette">Adresse</label>
            <ChampAdresse valeur={adresse} onChange={setAdresse} onChoisir={remplir.onChoisir} className="champ" />
            <label className="etiquette">Ville</label>
            <ChampVille valeur={ville} onChange={setVille} codePostal={codePostal} className="champ" />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="etiquette">Province</label>
                <SelectProvince valeur={province} onChange={setProvince} className="champ" />
              </div>
              <div style={{ width: 110 }}>
                <label className="etiquette">Code postal</label>
                <ChampCodePostal valeur={codePostal} onChange={setCodePostal} onSecteur={remplir.onSecteur} className="champ" />
              </div>
            </div>
            <label className="etiquette">Assignation (poste, spécialité, secteur…)</label>
            <input value={assignation} onChange={(e) => setAssignation(e.target.value)} placeholder="Ex : Freins et suspension" className="champ" />
            <label className="etiquette">Date d'embauche</label>
            <input type="date" max="9999-12-31" value={dateEmbauche} onChange={(e) => setDateEmbauche(e.target.value)} className="champ" />
            {peutVoirNas && (
              <>
                <label className="etiquette">NAS — numéro d'assurance sociale (pour les T4 et RL-1)</label>
                <input value={nas} onChange={(e) => setNas(e.target.value)} onBlur={(e) => setNas(formaterNas(e.target.value))} inputMode="numeric" autoComplete="off" placeholder="123 456 789" className="champ" />
              </>
            )}
            <label className="etiquette">NIP ({employe.pin ? "défini" : "aucun"}) — 4 chiffres, laisse vide pour ne pas changer</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                inputMode="numeric" maxLength={4} value={nouveauPin} disabled={retirerPin}
                onChange={(e) => setNouveauPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Nouveau NIP" className="champ" style={{ flex: 1 }}
              />
              {employe.pin && (
                <label style={{ fontSize: 12.5, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap", marginBottom: 8 }}>
                  <input type="checkbox" checked={retirerPin} onChange={(e) => setRetirerPin(e.target.checked)} /> Retirer
                </label>
              )}
            </div>
            <label className="etiquette">Nouveau mot de passe (laisse vide pour ne pas changer)</label>
            <input type="password" minLength={4} maxLength={12} value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)} className="champ" style={{ marginBottom: 0 }} />
          </div>

          <div style={stylePanneau}>
            <TitrePanneau icone="calculatrice" teinte={TEINTES.vert} titre="Configuration de paie" />
            <label className="etiquette">Type de rémunération</label>
            <select value={typeRemuneration} onChange={(e) => setTypeRemuneration(e.target.value)} className="champ">
              <option value="HORAIRE">Payé à l'heure</option>
              <option value="SALAIRE">Salarié (montant fixe)</option>
            </select>
            {typeRemuneration === "HORAIRE" ? (
              <>
                <label className="etiquette">Taux horaire spécifique (vide = taux global des Paramètres)</label>
                <input type="number" min={0} step="0.01" value={tauxHoraireEmploye} onChange={(e) => setTauxHoraireEmploye(e.target.value)} className="champ" />
              </>
            ) : (
              <>
                <label className="etiquette">Salaire annuel</label>
                <input type="number" min={0} step="0.01" value={salaireAnnuel} onChange={(e) => setSalaireAnnuel(e.target.value)} className="champ" />
              </>
            )}
            <label className="etiquette">Fréquence de paie</label>
            <select value={frequencePaie} onChange={(e) => setFrequencePaie(e.target.value)} className="champ">
              <option value="HEBDOMADAIRE">Chaque semaine</option>
              <option value="BIHEBDOMADAIRE">Aux 2 semaines</option>
              <option value="BIMENSUEL">2 fois par mois</option>
              <option value="MENSUEL">Chaque mois</option>
            </select>
            <label className="etiquette">Taux de vacances (%) — minimum légal QC : 4% (ou 6% après 3 ans)</label>
            <input type="number" min={0} step="0.1" value={tauxVacances} onChange={(e) => setTauxVacances(e.target.value)} className="champ" />
            <label className="etiquette">Montant du TD1 fédéral — « montant total de la demande » (vide = montant de base)</label>
            <input type="number" min={0} step="1" value={montantTd1} onChange={(e) => setMontantTd1(e.target.value)} className="champ" />
            <label className="etiquette">Montant du TP-1015.3 du Québec — ligne 10 (vide = montant de base)</label>
            <input type="number" min={0} step="1" value={montantTp10153} onChange={(e) => setMontantTp10153(e.target.value)} className="champ" style={{ marginBottom: 0 }} />
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "6px 0 0", lineHeight: 1.45 }}>
              Ces montants servent au calcul de l'impôt retenu. Un montant inscrit ne s'indexe pas tout seul : à revoir chaque année, ou à vider pour revenir au montant de base.
            </p>

            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", margin: "16px 0 8px" }}>Exemptions de cotisations</div>
            <label className="etiquette">Date de naissance (RRQ selon l'âge)</label>
            <input type="date" max="9999-12-31" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} className="champ" />
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "-4px 0 10px", lineHeight: 1.45 }}>
              Aucune cotisation au RRQ avant la fin du mois des 18 ans, ni à partir de l'année où l'employé a 73 ans au 31 décembre. Vide : il cotise normalement.
            </p>
            {[
              [exemptionRRQ, setExemptionRRQ, "A choisi de cesser de cotiser au RRQ", "65 ans ou plus avec une rente de retraite — il t'a remis le formulaire RR-50."],
              [exemptionAE, setExemptionAE, "Emploi non assurable à l'assurance-emploi", "Propriétaire qui contrôle plus de 40 % des actions votantes, ou lien de dépendance avec l'employeur. Le RQAP continue de s'appliquer."],
              [exemptionCNESST, setExemptionCNESST, "Dirigeant non couvert par la CNESST", "Administrateur ou dirigeant sans protection personnelle : aucune prime sur son salaire."],
            ].map(([valeur, changer, titre, detail]) => (
              <label key={titre} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13, margin: "0 0 10px", cursor: "pointer" }}>
                <input type="checkbox" checked={valeur} onChange={(e) => changer(e.target.checked)} style={{ marginTop: 3 }} />
                <span>
                  <span style={{ fontWeight: 700 }}>{titre}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45 }}>{detail}</span>
                </span>
              </label>
            ))}
          </div>

          {peutModifierTheme && (
            <div style={stylePanneau}>
              <TitrePanneau
                icone="reglages" teinte={TEINTES.ambre} titre="Affichage"
                sousTitre={`Réglable seulement par un gérant — appliqué automatiquement à la prochaine connexion de ${estMoi ? "toi-même" : employe.nom}.`}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <Choix actif={theme === "sombre"} onClick={() => setTheme("sombre")}>🌙 Sombre</Choix>
                <Choix actif={theme !== "sombre"} onClick={() => setTheme("clair")}>☀️ Clair</Choix>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Choix actif={tailleTexte !== "grand"} onClick={() => setTailleTexte("normal")}>Texte normal</Choix>
                <Choix actif={tailleTexte === "grand"} onClick={() => setTailleTexte("grand")} grand>Texte plus gros</Choix>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <button onClick={sauvegarder} disabled={enCours} className="bouton-3d" style={{ padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14 }}>
              {enCours ? "…" : "Sauvegarder"}
            </button>
            <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={() => setModeEdition(false)}>Annuler</BoutonAction>
          </div>
        </>
      ) : (
        <>
          <div className="grille-trois" style={{ marginBottom: 24 }}>
            {cartes.map((c) => <CarteChiffre key={c.titre} titre={c.titre} montant={c.montant} teinte={c.teinte} couleur={c.couleur} note={c.note} />)}
          </div>

          <div style={stylePanneau}>
            <TitrePanneau icone="personne" teinte={TEINTES.bleu} titre="Coordonnées" />
            <LigneDetail label="Numéro d'employé" valeur={employe.numeroEmploye} premiere />
            <LigneDetail label="Téléphone" valeur={employe.telephone && <a href={`tel:${employe.telephone.replace(/[^\d+]/g, "")}`} style={{ color: "inherit" }}>{employe.telephone}</a>} />
            <LigneDetail label="Courriel" valeur={employe.courriel && <a href={`mailto:${employe.courriel}`} style={{ color: "inherit" }}>{employe.courriel}</a>} />
            <LigneDetail label="Adresse" valeur={employe.adresse} />
            <LigneDetail label="Ville" valeur={ligneVille(employe) || null} />
            {activite && <LigneDetail label="Dernière activité" valeur={activite} />}
          </div>

          <div style={stylePanneau}>
            <TitrePanneau icone="outils" teinte={TEINTES.ambre} titre="Emploi et accès" />
            <LigneDetail label="Rôle" valeur={nomsRoles[employe.role] || employe.role} premiere />
            <LigneDetail label="Assignation" valeur={employe.assignation} />
            <LigneDetail label="Date d'embauche" valeur={employe.dateEmbauche ? dateCourte(employe.dateEmbauche) : null} />
            <LigneDetail label="NIP" valeur={employe.pin ? "Défini" : "Aucun"} />
            {peutVoirNas && <LigneDetail label="NAS" valeur={masquerNas(employe.nas) || null} />}
            <LigneDetail label="Affichage" valeur={`${employe.theme === "sombre" ? "🌙 Sombre" : "☀️ Clair"} · ${employe.tailleTexte === "grand" ? "Texte plus gros" : "Texte normal"}`} />
          </div>

          <div style={stylePanneau}>
            <TitrePanneau icone="calculatrice" teinte={TEINTES.vert} titre="Rémunération" />
            <LigneDetail label="Type" valeur={employe.typeRemuneration === "SALAIRE" ? "Salarié (montant fixe)" : "Payé à l'heure"} premiere />
            {employe.typeRemuneration === "SALAIRE" ? (
              <LigneDetail label="Salaire annuel" valeur={employe.salaireAnnuel ? argent(employe.salaireAnnuel) : null} />
            ) : (
              <LigneDetail label="Taux horaire" valeur={employe.tauxHoraireEmploye ? `${argent(employe.tauxHoraireEmploye)}/h (spécifique)` : "Taux global des Paramètres"} />
            )}
            <LigneDetail label="Fréquence de paie" valeur={{ HEBDOMADAIRE: "Chaque semaine", BIHEBDOMADAIRE: "Aux 2 semaines", BIMENSUEL: "2 fois par mois", MENSUEL: "Chaque mois" }[employe.frequencePaie]} />
            <LigneDetail label="Taux de vacances" valeur={`${employe.tauxVacances} %`} />
            <LigneDetail label="TD1 fédéral" valeur={employe.montantTd1 != null ? argent(employe.montantTd1) : "Montant de base"} />
            <LigneDetail label="TP-1015.3 Québec" valeur={employe.montantTp10153 != null ? argent(employe.montantTp10153) : "Montant de base"} />
            <LigneDetail
              label="Exemptions"
              valeur={[employe.exemptionRRQ && "RRQ (choix de l'employé)", employe.exemptionAE && "Assurance-emploi", employe.exemptionCNESST && "CNESST"].filter(Boolean).join(", ") || "Aucune"}
            />
            {employe.dateNaissance && <LigneDetail label="Date de naissance" valeur={dateCourte(employe.dateNaissance)} />}
          </div>

          {paieActif && paies.length > 0 && (
            <div style={stylePanneau}>
              <TitrePanneau icone="banque" teinte={TEINTES.vert} titre="Paies récentes" sousTitre="Touche une paie pour voir son talon." />
              {paies.map((p, i) => {
                const corrigee = p.statut === "CORRIGEE";
                return (
                  <Link key={p.id} href={`/gerant/paie/${p.id}/talon`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)", textDecoration: "none", color: "var(--text)", opacity: corrigee ? 0.6 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>Période au {dateCourte(p.periodeFin)}</span>
                      {p.typePaie === "VACANCES" && <Pastille couleur="var(--success)" fond="var(--success-fond)">Vacances</Pastille>}
                      {corrigee && <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">Corrigée</Pastille>}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", textDecoration: corrigee ? "line-through" : "none" }}>{argent(p.salaireNet)}</span>
                    <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
                  </Link>
                );
              })}
            </div>
          )}

          {peutGererEmploye ? (
            <div style={{ display: "grid", gridTemplateColumns: estMoi ? "1fr" : "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
              <BoutonAction icone="crayon" onClick={() => setModeEdition(true)}>Modifier</BoutonAction>
              {!estMoi && (
                <BoutonAction icone={employe.actif ? "bloque" : "crochet"} couleur={employe.actif ? "var(--avertissement)" : "var(--success)"} onClick={toggleActif} disabled={enCours}>
                  {employe.actif ? "Désactiver" : "Réactiver"}
                </BoutonAction>
              )}
              {!estMoi && <BoutonAction icone="poubelle" couleur="var(--danger)" onClick={supprimer} disabled={enCours}>Supprimer</BoutonAction>}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>Tu n'as pas le niveau requis pour modifier cette fiche.</p>
          )}
        </>
      )}
    </div>
  );
}

// Bouton de choix (thème, taille du texte) : doré quand il est choisi
function Choix({ actif, onClick, grand, children }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        padding: "10px 8px", borderRadius: 12, fontSize: grand ? 15 : 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        color: actif ? "#221f18" : "var(--text)", background: actif ? "var(--accent)" : "var(--surface)",
        border: `1.5px solid ${actif ? "var(--accent)" : "var(--border)"}`,
      }}
    >
      {children}
    </button>
  );
}

const dateCourte = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });

// Depuis la date d'embauche : « 3 ans 4 mois », « 7 mois »
function anciennete(dateEmbauche) {
  if (!dateEmbauche) return "—";
  const debut = new Date(dateEmbauche);
  const maintenant = new Date();
  let mois = (maintenant.getFullYear() - debut.getFullYear()) * 12 + (maintenant.getMonth() - debut.getMonth());
  if (maintenant.getDate() < debut.getDate()) mois -= 1;
  mois = Math.max(0, mois);
  const ans = Math.floor(mois / 12);
  const reste = mois % 12;
  if (ans === 0) return `${reste} mois`;
  return reste ? `${ans} an${ans > 1 ? "s" : ""} ${reste} mois` : `${ans} an${ans > 1 ? "s" : ""}`;
}

// 7.5 → « 7 h 30 »
function formaterHeures(h) {
  const minutes = Math.round(h * 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}
