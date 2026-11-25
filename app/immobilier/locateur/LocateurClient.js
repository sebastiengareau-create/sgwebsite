"use client";

// Fiche du locateur : les lignes de la section A du bail (lib/locateurImmo.js)

import { useState } from "react";
import { useRouter } from "next/navigation";
import BandeauSection from "../../components/BandeauSection";
import { TEINTES } from "../../components/StyleSection";
import { NavImmo, Panneau, ChampsFormulaire, Erreur, boutonPrincipal, useApi, RetourArriere } from "../ui";

// Par blocs, comme la fiche du locataire (ChampsFormulaire : groupe)
const champs = (n) => [
  { nom: "nom", label: n === 0 ? "Nom du locateur (personne ou entreprise)" : "Nom du 2e locateur", pleineLargeur: true, groupe: "Nom" },
  { nom: "no", label: "N° civique", groupe: "Adresse" },
  { nom: "app", label: "App." },
  { nom: "rue", label: "Rue", pleineLargeur: true },
  { nom: "ville", label: "Municipalité" },
  { nom: "codePostal", label: "Code postal" },
  { nom: "telephone", label: "N° de téléphone", typeHtml: "tel", groupe: "Pour le joindre" },
  { nom: "telephone2", label: "Autre n° (cellulaire)", typeHtml: "tel" },
  { nom: "courriel", label: "Adresse de courriel", pleineLargeur: true },
];
const vide = () => Object.fromEntries(champs(0).map((c) => [c.nom, ""]));

export default function LocateurClient({ locateur }) {
  const router = useRouter();
  const { appeler, enCours, erreur } = useApi();
  const [l1, setL1] = useState({ ...vide(), ...locateur.locateurs[0] });
  const [l2, setL2] = useState(locateur.locateurs[1] ? { ...vide(), ...locateur.locateurs[1] } : null);
  const [representant, setRepresentant] = useState(locateur.representant || "");
  const [fait, setFait] = useState(false);
  const maj = (set) => (nom, x) => { setFait(false); set((o) => ({ ...o, [nom]: x })); };

  async function enregistrer() {
    const r = await appeler("/api/immobilier/locateur", "POST", { locateurs: [l1, ...(l2 ? [l2] : [])], representant });
    if (r) { setFait(true); router.refresh(); }
  }

  return (
    <div className="conteneur-page">
      <RetourArriere href="/immobilier" />
      <BandeauSection icone="🧑‍💼" titre="Locateur" sousTitre="Qui loue les logements : les lignes de la section A du bail." />
      <NavImmo actif="/immobilier/locateur" />
      {!locateur.enregistre && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>Reprise des informations de l'entreprise (Administrateur) : vérifie, complète et enregistre.</p>
      )}
      <Panneau icone="personne" teinte={TEINTES.ambre} titre="Locateur" sousTitre="Le propriétaire, tel qu'il signe le bail">
        <ChampsFormulaire champs={champs(0)} valeurs={l1} maj={maj(setL1)} />
      </Panneau>
      <Panneau
        icone="utilisateurs" teinte={TEINTES.bleu} titre="2e locateur" sousTitre="Copropriétaire de l'immeuble, s'il signe aussi le bail"
        droite={<button type="button" onClick={() => { setFait(false); setL2((v) => (v ? null : vide())); }} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, cursor: "pointer", font: "inherit", fontSize: 13 }}>{l2 ? "Retirer" : "+ Ajouter"}</button>}
      >
        {l2 ? <ChampsFormulaire champs={champs(1)} valeurs={l2} maj={maj(setL2)} /> : <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun.</p>}
      </Panneau>
      <Panneau icone="presse" teinte={TEINTES.neutre} titre="Représenté par" sousTitre="S'il y a lieu : gestionnaire ou mandataire qui signe pour le locateur">
        <ChampsFormulaire champs={[{ nom: "representant", label: "Nom du représentant", pleineLargeur: true }]} valeurs={{ representant }} maj={(_, x) => { setFait(false); setRepresentant(x); }} />
      </Panneau>
      <Erreur texte={erreur} />
      <button type="button" onClick={enregistrer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "Enregistrement…" : fait ? "✓ Enregistré" : "Enregistrer"}</button>
    </div>
  );
}
