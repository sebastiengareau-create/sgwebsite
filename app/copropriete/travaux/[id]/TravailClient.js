"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LigneInfo } from "../../../components/ui";
import { PRIORITES, STATUTS_TRAVAIL, STATUTS_DEMANDE, CATEGORIES_TRAVAUX, argent, libelle, dateLisible, frequenceLisible } from "@/lib/coproprieteCalculs";
import { champsTravail, champsCloture } from "../../entretien/champs";
import {
  Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, PastilleCode, Vide, valeursDe, useApi, Erreur, EnvoiFichiers, ListeFichiers, champStyle, aujourdhui, Endroit,
} from "../../ui";

export default function TravailClient({ travail: t, unites, batiments, fournisseurs }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const champs = champsTravail({ unites, batiments, fournisseurs });
  const demandeur = t.demande?.coproprietaire;
  return (
    <div className="conteneur-page">
      <Retour href="/copropriete/entretien?onglet=TRAVAUX">Bons de travail</Retour>
      <div style={{ margin: "10px 0 14px" }}>
        <h1 style={{ fontSize: 21, margin: "0 0 6px" }}>🧾 {t.numero} — {t.titre}</h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><PastilleCode liste={STATUTS_TRAVAIL} code={t.statut} /><PastilleCode liste={PRIORITES} code={t.priorite} /></div>
      </div>

      <Progression t={t} demandeur={demandeur} />

      <Section titre="Bon de travail" droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
        {edition ? (
          <>
            <Formulaire cadre={false} champs={champs} initial={valeursDe(t, champs)} url={`/api/copropriete/travaux/${t.id}`} methode="PATCH" onFini={() => setEdition(false)} />
            <div style={{ marginTop: 10 }}><BoutonSupprimer url={`/api/copropriete/travaux/${t.id}`} confirmation={`Supprimer le bon ${t.numero}, son suivi et ses photos ?`} onFini={() => router.push("/copropriete/entretien?onglet=TRAVAUX")}>Supprimer le bon</BoutonSupprimer></div>
          </>
        ) : (
          <>
            <LigneInfo label="Fournisseur" valeur={t.fournisseur && <Link href={`/gerant/fournisseurs/${t.fournisseur.id}`} style={{ color: "var(--accent)" }}>{t.fournisseur.nom}</Link>} />
            {t.fournisseur?.telephone && <LigneInfo label="Téléphone" valeur={<a href={`tel:${t.fournisseur.telephone}`} style={{ color: "var(--accent)" }}>{t.fournisseur.telephone}</a>} />}
            <LigneInfo label="Endroit" valeur={<Endroit x={t} />} />
            <LigneInfo label="Catégorie" valeur={t.categorie && libelle(CATEGORIES_TRAVAUX, t.categorie)} />
            <LigneInfo label="Date prévue" valeur={t.datePrevue && dateLisible(t.datePrevue)} />
            <LigneInfo label="Coût estimé" valeur={t.coutEstime != null && argent(t.coutEstime)} />
            {t.demande && <LigneInfo label="Demande d'origine" valeur={<Link href={`/copropriete/demandes/${t.demande.id}`} style={{ color: "var(--accent)" }}>{t.demande.numero} — {t.demande.titre} ({libelle(STATUTS_DEMANDE, t.demande.statut).toLowerCase()})</Link>} />}
            {t.entretien && <LigneInfo label="Entretien préventif" valeur={`${t.entretien.titre} · ${frequenceLisible(t.entretien.frequenceMois).toLowerCase()}`} />}
            <LigneInfo label="Créé le" valeur={`${dateLisible(t.creeLe)}${t.creePar ? ` par ${t.creePar}` : ""}`} />
            {t.description && <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap", margin: "10px 0 0" }}>{t.description}</p>}
          </>
        )}
      </Section>

      <Cloture t={t} />

      <Section titre="Photos, soumissions et factures">
        <ListeFichiers fichiers={t.fichiers} />
        <EnvoiFichiers url="/api/copropriete/fichiers" champsFixes={{ travailId: t.id }} />
      </Section>

      <Suivi t={t} demandeur={demandeur} />
    </div>
  );
}

// Faire avancer le bon : chaque étape est notée au suivi, fait avancer la
// demande d'origine et en avise le copropriétaire
function Progression({ t, demandeur }) {
  const [note, setNote] = useState("");
  const [publique, setPublique] = useState(true);
  const { appeler, enCours, erreur } = useApi();
  async function changer(statut) {
    const extra = statut === "TERMINE" && !t.dateFin ? { dateFin: aujourdhui() } : {};
    if (await appeler(`/api/copropriete/travaux/${t.id}`, "PATCH", { statut, noteStatut: note, notePublique: publique, ...extra })) setNote("");
  }
  return (
    <Section titre="Progression">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {STATUTS_TRAVAIL.filter((s) => s.code !== t.statut).map((s) => (
          <button key={s.code} type="button" disabled={enCours} onClick={() => changer(s.code)}
            style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 10px", borderRadius: 9, cursor: "pointer", border: `1px solid ${s.couleur}`, background: "transparent", color: s.couleur }}>
            → {s.label}
          </button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note jointe au changement (facultatif)" style={{ ...champStyle, resize: "vertical" }} />
      {demandeur && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
          <input type="checkbox" checked={publique} onChange={(e) => setPublique(e.target.checked)} />
          Aviser {demandeur.nom}{demandeur.courriel && demandeur.avisCourriel ? " (portail et courriel)" : " (portail)"}
        </label>
      )}
      <Erreur texte={erreur} />
    </Section>
  );
}

function Cloture({ t }) {
  const [edition, setEdition] = useState(false);
  const termine = t.statut === "TERMINE";
  return (
    <Section titre="Coûts et garantie" droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
      {edition ? (
        <Formulaire cadre={false} champs={champsCloture} initial={valeursDe(t, champsCloture)} url={`/api/copropriete/travaux/${t.id}`} methode="PATCH" onFini={() => setEdition(false)} />
      ) : (
        <>
          <LigneInfo label="Coût réel" valeur={t.coutReel != null && <strong>{argent(t.coutReel)}</strong>} />
          {t.coutReel != null && t.coutEstime != null && <LigneInfo label="Écart avec l'estimé" valeur={argent(t.coutReel - t.coutEstime)} />}
          <LigneInfo label="Facture du fournisseur" valeur={t.numeroFacture} />
          <LigneInfo label="Terminé le" valeur={t.dateFin && dateLisible(t.dateFin)} />
          <LigneInfo label="Garantie jusqu'au" valeur={t.garantieFin && dateLisible(t.garantieFin)} />
          {termine && t.coutReel == null && <p style={{ fontSize: 12.5, color: "var(--accent)", margin: "8px 0 0" }}>Entre le coût réel pour tenir l'historique des réparations (et le carnet d'entretien) à jour.</p>}
        </>
      )}
    </Section>
  );
}

function Suivi({ t, demandeur }) {
  const [texte, setTexte] = useState("");
  const [publique, setPublique] = useState(false);
  const { appeler, enCours, erreur } = useApi();
  async function ajouter() {
    if (await appeler(`/api/copropriete/travaux/${t.id}/suivis`, "POST", { texte, public: publique })) setTexte("");
  }
  return (
    <Section titre="Suivi des travaux">
      <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={2} placeholder="Ajouter une note : appel au fournisseur, visite, pièce commandée…" style={{ ...champStyle, resize: "vertical" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        {demandeur ? (
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
            <input type="checkbox" checked={publique} onChange={(e) => setPublique(e.target.checked)} /> Visible par {demandeur.nom} (et envoyée)
          </label>
        ) : <span />}
        <button type="button" onClick={ajouter} disabled={enCours || !texte.trim()} className="bouton-3d" style={{ padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>Ajouter</button>
      </div>
      <Erreur texte={erreur} />
      {t.suivis.length === 0 ? <Vide>Aucune note.</Vide> : t.suivis.map((s) => (
        <div key={s.id} style={{ borderLeft: `3px solid ${s.statut ? "var(--accent)" : "var(--border)"}`, padding: "4px 0 4px 10px", marginBottom: 8 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>{new Date(s.date).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" })}{s.auteur && ` · ${s.auteur}`}{demandeur && (s.public ? " · 👁️ visible par le demandeur" : " · interne")}</span>
            <BoutonSupprimer url={`/api/copropriete/travaux/${t.id}/suivis?suivi=${s.id}`} confirmation="Supprimer cette note ?">✕</BoutonSupprimer>
          </div>
          <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{s.texte}</div>
        </div>
      ))}
    </Section>
  );
}
